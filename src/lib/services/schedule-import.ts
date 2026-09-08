import ExcelJS from "exceljs"
import { toDateString } from "../timezone"

/**
 * Importing an operations roster workbook.
 *
 * The layout these sheets use is conventional rather than formal: a header
 * row of dates, then blocks of people under a heading naming their position
 * group, an asterisk on a name meaning a qualification, and short codes in
 * the cells. Nothing declares where any of that is, so the parser works it
 * out and reports what it decided — the preview, not the parser, is what
 * keeps a mis-read sheet from being imported.
 *
 * `parseScheduleGrid` is pure (a 2-D array in, a description out) so the
 * interpretation can be tested without a real file.
 */

export type Cell = string | number | Date | null | undefined

export interface ParsedPerson {
  name: string
  /** The heading this person appeared under, if any */
  group: string | null
  /** Derived from name decoration, e.g. a trailing "*" */
  qualifications: string[]
  /** Position within the sheet, preserved as roster order */
  rosterOrder: number
}

export interface ParsedShift {
  name: string
  /** YYYY-MM-DD */
  date: string
  /** Normalised cell text, e.g. "D", "OCR-D" */
  code: string
}

export interface ParsedSheet {
  sheetName: string
  dates: string[]
  groups: string[]
  people: ParsedPerson[]
  shifts: ParsedShift[]
  /** Distinct codes found, with how often each occurs */
  codes: { code: string; count: number }[]
  warnings: string[]
}

/** Marks the end of the roster; anything after it is ignored. */
const END_MARKER = /^\s*<.*>\s*$/

/** A trailing asterisk on a name is the workbook's "CCR trained" mark. */
const STAR_QUALIFICATION = "CCR"

function asDate(cell: Cell): Date | null {
  if (cell instanceof Date) return cell
  // Excel sometimes hands back an ISO string for a date-formatted cell
  if (typeof cell === "string") {
    const m = /^\d{4}-\d{2}-\d{2}/.exec(cell.trim())
    if (m) {
      const d = new Date(`${m[0]}T00:00:00.000Z`)
      return Number.isNaN(d.getTime()) ? null : d
    }
  }
  return null
}

/**
 * Reduce a raw ExcelJS cell value to something the parser can read.
 *
 * Formula cells are the reason this exists. ExcelJS returns
 * `{ formula, result }` — but when the formula evaluates to an empty string
 * it returns `{ formula }` with no `result` key at all. Checking for the key
 * and otherwise falling through means the *object* becomes the cell value,
 * and a template full of formula-driven days off imports every one of them as
 * a shift code reading "[OBJECT OBJECT]".
 */
export function normaliseCellValue(raw: unknown): Cell {
  if (raw === null || raw === undefined) return null
  if (raw instanceof Date) return raw
  if (typeof raw === "string" || typeof raw === "number") return raw
  if (typeof raw === "boolean") return String(raw)

  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>
    // A formula: take its last computed value, whatever shape that is
    if ("formula" in o || "sharedFormula" in o) return normaliseCellValue(o.result)
    // #N/A and friends are not data
    if ("error" in o) return null
    // Formatted text arrives in runs
    if (Array.isArray(o.richText)) return o.richText.map((r) => String((r as { text?: string }).text ?? "")).join("")
    // A hyperlink cell keeps its label under `text`
    if (typeof o.text === "string") return o.text
    return null
  }
  return null
}

function text(cell: Cell): string {
  if (cell === null || cell === undefined) return ""
  if (cell instanceof Date) return ""
  return String(cell).trim()
}

/** Uppercase and collapse inner whitespace, so "OCR - D" and "OCR-D" agree. */
export function normaliseCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s*-\s*/g, "-").replace(/\s+/g, " ")
}

/**
 * Work out the structure of a roster sheet.
 *
 * @param grid row-major cells; `grid[0]` is the first row of the sheet
 */
export function parseScheduleGrid(grid: Cell[][], sheetName = "Sheet1"): ParsedSheet {
  const warnings: string[] = []

  // 1. The header row is whichever row holds the most dates
  let headerRow = -1
  let best = 0
  grid.forEach((row, i) => {
    const count = row.filter((c) => asDate(c) !== null).length
    if (count > best) {
      best = count
      headerRow = i
    }
  })
  if (headerRow === -1 || best < 5) {
    return {
      sheetName, dates: [], groups: [], people: [], shifts: [], codes: [],
      warnings: ["No row of dates was found, so this does not look like a roster sheet."],
    }
  }

  // 2. Date columns — but only the calendar itself.
  //
  // Sheets often carry a stray date elsewhere on the header row (a "printed
  // on" cell, say). Taking every date cell would drag that column into the
  // calendar and, if it sits left of the names, shift the whole read. So keep
  // only the longest run of adjacent date columns; an isolated cell drops out.
  const allDateCells: { col: number; date: string }[] = []
  grid[headerRow].forEach((cell, col) => {
    const d = asDate(cell)
    if (d) allDateCells.push({ col, date: toDateString(d) })
  })

  // A calendar is adjacent columns whose dates run forwards. Either a wide
  // column gap or a date going backwards starts a new run, which is what
  // separates a stray "printed on" date from the calendar proper.
  const runs: { col: number; date: string }[][] = []
  for (const cell of allDateCells) {
    const current = runs[runs.length - 1]
    const previous = current?.[current.length - 1]
    const adjacent = previous !== undefined && cell.col - previous.col <= 2
    const forwards = previous !== undefined && cell.date > previous.date
    if (current && adjacent && forwards) current.push(cell)
    else runs.push([cell])
  }
  const dateColumns = runs.reduce((longest, run) => (run.length > longest.length ? run : longest), [])

  if (dateColumns.length < 5) {
    return {
      sheetName, dates: [], groups: [], people: [], shifts: [], codes: [],
      warnings: ["No run of date columns was found, so this does not look like a roster sheet."],
    }
  }
  if (dateColumns.length < allDateCells.length) {
    warnings.push(`Ignored ${allDateCells.length - dateColumns.length} stray date cell(s) outside the calendar.`)
  }
  const firstDateCol = dateColumns[0].col

  // 3. Labelled columns, if the sheet has them.
  //
  // Two shapes are supported. Existing operations workbooks label nothing and
  // group people under heading rows, which has to be inferred. The template
  // this app hands out instead labels its columns — Name, Position group,
  // Sign-offs — which removes the guessing entirely, and in particular the
  // ambiguity where a person with no shifts yet is indistinguishable from a
  // group heading.
  const label = (col: number) => text(grid[headerRow]?.[col]).toLowerCase().replace(/[^a-z ]/g, "").trim()
  let nameCol = -1
  let groupCol = -1
  let qualCol = -1
  for (let col = 0; col < firstDateCol; col++) {
    const l = label(col)
    if (nameCol === -1 && /^(name|full name|worker|person|employee)$/.test(l)) nameCol = col
    else if (groupCol === -1 && /^(position group|group|section|department)$/.test(l)) groupCol = col
    else if (qualCol === -1 && /^(sign ?offs?|qualifications?|training|tickets?)$/.test(l)) qualCol = col
  }
  const labelled = nameCol !== -1

  // Otherwise: the leftmost column with text below the header
  if (!labelled) {
    nameCol = 0
    for (let col = 0; col < firstDateCol; col++) {
      const populated = grid.slice(headerRow + 1).filter((r) => text(r?.[col]) !== "").length
      if (populated >= 3) {
        nameCol = col
        break
      }
    }
  }

  // 4. Walk the rows: headings set the current group, everything else is a person
  const people: ParsedPerson[] = []
  const shifts: ParsedShift[] = []
  const groups: string[] = []
  const codeCounts = new Map<string, number>()
  const seenNames = new Set<string>()
  let group: string | null = null

  for (let i = headerRow + 1; i < grid.length; i++) {
    const row = grid[i] ?? []
    const cellLabel = text(row[nameCol])
    if (!cellLabel) continue
    if (END_MARKER.test(cellLabel)) break

    const filled = dateColumns.filter(({ col }) => text(row[col]) !== "")

    // With a Position group column there are no heading rows to detect: every
    // named row is a person, whether or not they have any shifts yet.
    if (!labelled) {
      // A row with a label but no shifts is *probably* a group heading — except
      // that a person rostered nowhere looks identical. What separates them is
      // the other columns: a person carries data there (a crew code, an ID), a
      // heading is bare. Without this, a vacant "TBA" row becomes a heading and
      // silently adopts everybody listed below it.
      const carriesPersonData = row.some(
        (cell, col) => col < firstDateCol && col !== nameCol && text(cell) !== ""
      )

      if (filled.length === 0 && !carriesPersonData) {
        group = cellLabel
        if (!groups.includes(cellLabel)) groups.push(cellLabel)
        continue
      }
    }

    const starred = cellLabel.endsWith("*")
    const name = (starred ? cellLabel.slice(0, -1) : cellLabel).trim()
    if (!name) continue

    if (labelled) {
      // Blank means "same as the person above", which is how people fill these in
      const stated = groupCol === -1 ? "" : text(row[groupCol])
      if (stated) {
        group = stated
        if (!groups.includes(stated)) groups.push(stated)
      }
    }

    if (seenNames.has(name.toLowerCase())) {
      warnings.push(`"${name}" appears more than once; only the first block of shifts was used.`)
      continue
    }
    seenNames.add(name.toLowerCase())

    // Sign-offs come from a Sign-offs column when there is one, and from the
    // trailing-asterisk convention otherwise. Both, if a sheet uses both.
    const stated = qualCol === -1 ? [] : text(row[qualCol]).split(/[,;/|]+|\s{2,}/).map((q) => q.trim().toUpperCase()).filter(Boolean)
    const qualifications = Array.from(new Set([...(starred ? [STAR_QUALIFICATION] : []), ...stated]))

    people.push({
      name,
      group,
      qualifications,
      rosterOrder: people.length + 1,
    })

    for (const { col, date } of filled) {
      const code = normaliseCode(text(row[col]))
      if (!code) continue
      shifts.push({ name, date, code })
      codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1)
    }
  }

  if (people.length === 0) warnings.push("No people were found under the date row.")
  if (groups.length === 0) warnings.push("No position group headings were found; everyone will be imported without a group.")

  // A person with no shifts at all reads exactly like a heading. Headings that
  // nobody sits under are the tell-tale, so name them rather than silently
  // creating an empty group.
  const used = new Set(people.map((p) => p.group).filter(Boolean))
  const empty = groups.filter((g) => !used.has(g))
  for (const g of empty) {
    warnings.push(`"${g}" was read as a position group heading, but no one follows it. If it is a person with no shifts, they will be skipped.`)
  }

  return {
    sheetName,
    dates: dateColumns.map((d) => d.date),
    groups: groups.filter((g) => used.has(g)),
    people,
    shifts,
    codes: Array.from(codeCounts.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count),
    warnings,
  }
}

/**
 * Score how much a sheet looks like the roster (rather than, say, a derived
 * view holding names in its cells). Short repeated codes score well.
 */
function scoreSheet(parsed: ParsedSheet): number {
  // A sheet with a calendar is a roster even before anyone is on it — which
  // is exactly the state a blank template arrives in. Without this, an empty
  // template loses to whatever sheet happens to come first.
  if (parsed.dates.length === 0) return 0
  const hasCalendar = parsed.dates.length * 0.001
  if (parsed.shifts.length === 0) return hasCalendar
  const shortCodes = parsed.shifts.filter((s) => s.code.length <= 8).length / parsed.shifts.length
  const distinctRatio = parsed.codes.length / parsed.shifts.length
  // Mostly-short values that repeat a lot: a code sheet. Long, near-unique
  // values: a sheet of names.
  return hasCalendar + shortCodes * (1 - Math.min(distinctRatio, 1)) * parsed.shifts.length
}

export interface WorkbookParse extends ParsedSheet {
  /** Every sheet in the file, so the caller can offer a different one */
  availableSheets: string[]
}

/** Read a workbook buffer and parse the sheet that looks most like a roster. */
export async function parseWorkbook(buffer: ArrayBuffer, sheetName?: string): Promise<WorkbookParse> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)

  const available = wb.worksheets.map((ws) => ws.name)
  if (available.length === 0) throw new Error("The workbook has no sheets")

  const gridOf = (ws: ExcelJS.Worksheet): Cell[][] => {
    const grid: Cell[][] = []
    ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const cells: Cell[] = []
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cells[colNumber - 1] = normaliseCellValue(cell.value)
      })
      grid[rowNumber - 1] = cells
    })
    return grid
  }

  if (sheetName) {
    const ws = wb.getWorksheet(sheetName)
    if (!ws) throw new Error(`The workbook has no sheet called "${sheetName}"`)
    return { ...parseScheduleGrid(gridOf(ws), ws.name), availableSheets: available }
  }

  let chosen: ParsedSheet | null = null
  let bestScore = -1
  for (const ws of wb.worksheets) {
    const parsed = parseScheduleGrid(gridOf(ws), ws.name)
    const score = scoreSheet(parsed)
    if (score > bestScore) {
      bestScore = score
      chosen = parsed
    }
  }
  return { ...chosen!, availableSheets: available }
}

// --- Applying a parse to the database ------------------------------------

import { prisma } from "../prisma"
import { toUTCDate } from "../timezone"
import { ServiceError } from "./errors"
import type { Actor } from "./schedules"

export interface ImportOptions {
  /** Create workers that are not already in the organization */
  createMissingPeople: boolean
  /**
   * Replace every existing shift in the imported date range for the people
   * matched, rather than leaving untouched days alone. The workbook is the
   * source of truth for the range it covers, so this defaults on.
   */
  replaceRange: boolean
}

export interface ImportPlan {
  sheetName: string
  availableSheets: string[]
  dateRange: { start: string; end: string; days: number } | null
  groups: { name: string; existing: boolean; members: number }[]
  people: {
    name: string
    group: string | null
    qualifications: string[]
    /** Existing worker id, or null when they would have to be created */
    matchedId: string | null
    shifts: number
  }[]
  codes: { code: string; count: number; known: boolean }[]
  shiftCount: number
  warnings: string[]
}

/** Placeholder address for a worker created by an import. */
export function placeholderEmail(name: string, organizationId: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "") || "worker"
  return `${slug}.${organizationId.slice(-6)}@imported.local`
}

/**
 * Describe what an import would do, without doing any of it. The route runs
 * this first and the user confirms it — the parser guesses at structure, so
 * nothing is written until a human has seen what it decided.
 */
export async function planImport(organizationId: string, parsed: WorkbookParse): Promise<ImportPlan> {
  const [existingPeople, existingGroups, existingCodes] = await Promise.all([
    prisma.user.findMany({ where: { organizationId }, select: { id: true, name: true } }),
    prisma.positionGroup.findMany({ where: { organizationId }, select: { name: true } }),
    prisma.customShiftType.findMany({ where: { organizationId }, select: { code: true } }),
  ])

  const byName = new Map(existingPeople.filter((p) => p.name).map((p) => [p.name!.trim().toLowerCase(), p.id]))
  const groupNames = new Set(existingGroups.map((g) => g.name.toLowerCase()))
  const knownCodes = new Set(existingCodes.map((c) => c.code.toUpperCase()))

  const shiftsPerPerson = new Map<string, number>()
  for (const s of parsed.shifts) shiftsPerPerson.set(s.name, (shiftsPerPerson.get(s.name) ?? 0) + 1)

  return {
    sheetName: parsed.sheetName,
    availableSheets: parsed.availableSheets,
    dateRange: parsed.dates.length
      ? { start: parsed.dates[0], end: parsed.dates[parsed.dates.length - 1], days: parsed.dates.length }
      : null,
    groups: parsed.groups.map((name) => ({
      name,
      existing: groupNames.has(name.toLowerCase()),
      members: parsed.people.filter((p) => p.group === name).length,
    })),
    people: parsed.people.map((p) => ({
      name: p.name,
      group: p.group,
      qualifications: p.qualifications,
      matchedId: byName.get(p.name.toLowerCase()) ?? null,
      shifts: shiftsPerPerson.get(p.name) ?? 0,
    })),
    codes: parsed.codes
      .filter((c) => c.code !== "D" && c.code !== "N")
      .map((c) => ({ ...c, known: knownCodes.has(c.code) })),
    shiftCount: parsed.shifts.length,
    warnings: parsed.warnings,
  }
}

export interface ImportResult {
  groupsCreated: number
  peopleCreated: number
  peopleUpdated: number
  codesCreated: number
  shiftsWritten: number
  shiftsReplaced: number
  skipped: string[]
}

/**
 * Apply a parsed workbook. Everything happens in one transaction: a partial
 * import would leave the roster in a state nobody could reason about.
 */
export async function applyImport(
  actor: Actor,
  parsed: WorkbookParse,
  options: ImportOptions
): Promise<ImportResult> {
  const organizationId = actor.organizationId
  if (parsed.people.length === 0 || parsed.dates.length === 0) {
    throw new ServiceError("Nothing to import from this sheet", 400)
  }

  const start = toUTCDate(parsed.dates[0])
  const end = toUTCDate(parsed.dates[parsed.dates.length - 1])

  return prisma.$transaction(
    async (tx) => {
      const result: ImportResult = {
        groupsCreated: 0, peopleCreated: 0, peopleUpdated: 0,
        codesCreated: 0, shiftsWritten: 0, shiftsReplaced: 0, skipped: [],
      }

      // 1. Position groups, in sheet order
      const groupIds = new Map<string, string>()
      for (const [i, name] of Array.from(parsed.groups.entries())) {
        const existing = await tx.positionGroup.findFirst({ where: { organizationId, name } })
        if (existing) groupIds.set(name, existing.id)
        else {
          const created = await tx.positionGroup.create({ data: { name, sortOrder: i + 1, organizationId } })
          groupIds.set(name, created.id)
          result.groupsCreated++
        }
      }

      // 2. Sign-offs referenced by the sheet (the "*" convention)
      const qualificationCodes = Array.from(new Set(parsed.people.flatMap((p) => p.qualifications)))
      for (const code of qualificationCodes) {
        await tx.qualification.upsert({
          where: { organizationId_code: { organizationId, code } },
          update: {},
          create: { code, name: code === "CCR" ? "Control Room Trained" : code, organizationId },
        })
      }

      // 3. People
      const existing = await tx.user.findMany({ where: { organizationId }, select: { id: true, name: true } })
      const byName = new Map(existing.filter((p) => p.name).map((p) => [p.name!.trim().toLowerCase(), p.id]))
      const userIds = new Map<string, string>()

      for (const person of parsed.people) {
        const groupId = person.group ? groupIds.get(person.group) ?? null : null
        const matched = byName.get(person.name.toLowerCase())
        if (matched) {
          await tx.user.update({
            where: { id: matched },
            data: {
              positionGroupId: groupId,
              rosterOrder: person.rosterOrder,
              // Merge, so sign-offs recorded in the app are not lost to a sheet
              // that only knows about the asterisk convention
              qualifications: { set: Array.from(new Set([...person.qualifications])) },
            },
          })
          userIds.set(person.name, matched)
          result.peopleUpdated++
        } else if (options.createMissingPeople) {
          const created = await tx.user.create({
            data: {
              name: person.name,
              email: placeholderEmail(person.name, organizationId),
              role: "WORKER",
              status: "ACTIVE",
              organizationId,
              positionGroupId: groupId,
              rosterOrder: person.rosterOrder,
              qualifications: person.qualifications,
              // No password: the account exists on the roster but cannot sign
              // in until someone sets one.
              passwordHash: null,
            },
          })
          userIds.set(person.name, created.id)
          result.peopleCreated++
        } else {
          result.skipped.push(person.name)
        }
      }

      // 4. Shift codes the sheet uses that the organization does not have yet
      const codes = Array.from(new Set(parsed.shifts.map((s) => s.code).filter((c) => c !== "D" && c !== "N")))
      for (const code of codes) {
        const found = await tx.customShiftType.findFirst({ where: { organizationId, code } })
        if (!found) {
          await tx.customShiftType.create({
            data: {
              code,
              name: code,
              color: "#6b7280",
              textColor: "#ffffff",
              description: "Created by a spreadsheet import; set its coverage role in Settings.",
              organizationId,
            },
          })
          result.codesCreated++
        }
      }

      // 5. Shifts. Clearing the range first makes the import idempotent —
      // re-importing a corrected sheet replaces rather than layers.
      const ids = Array.from(userIds.values())
      if (ids.length > 0 && options.replaceRange) {
        const removed = await tx.schedule.deleteMany({
          where: { userId: { in: ids }, date: { gte: start, lte: end } },
        })
        result.shiftsReplaced = removed.count
      }

      const rows = parsed.shifts
        .filter((s) => userIds.has(s.name))
        .map((s) => ({
          userId: userIds.get(s.name)!,
          date: toUTCDate(s.date),
          shiftType: (s.code === "D" ? "DAY" : s.code === "N" ? "NIGHT" : "CUSTOM") as
            | "DAY" | "NIGHT" | "CUSTOM",
          customShiftCode: s.code === "D" || s.code === "N" ? null : s.code,
        }))

      if (rows.length > 0) {
        const written = await tx.schedule.createMany({ data: rows, skipDuplicates: !options.replaceRange })
        result.shiftsWritten = written.count
      }

      return result
    },
    { timeout: 120_000, maxWait: 20_000 }
  )
}
