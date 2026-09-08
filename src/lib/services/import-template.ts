import ExcelJS from "exceljs"
import { prisma } from "../prisma"
import { addDaysUTC, normalizeToUTCMidnight } from "../timezone"

/**
 * The blank roster workbook the app hands out.
 *
 * Two things make it worth generating rather than shipping as a static file:
 *
 * 1. It is built from the organization's own setup — its position groups and
 *    duty codes become the dropdowns, and the guide names its actual codes. A
 *    fixed template sends people back with codes the app does not know.
 *
 * 2. It fills itself in. You describe your rotations once on the Rotations
 *    sheet, then for each person give a rotation, a first day and whether they
 *    start on days or nights; Excel generates the rest of the year. Typing a
 *    year of D and N by hand is where this kind of setup usually dies.
 *
 * It uses the labelled-column shape the parser prefers (Name / Position group
 * / Sign-offs), so nothing about the layout has to be inferred — including a
 * person added before they have any shifts, who in the heading-row shape is
 * indistinguishable from a group heading.
 */

const SHEET = "Roster"
const GUIDE = "How to fill this in"
const ROTATIONS = "Rotations"

/** Columns before the calendar. The parser reads the first three by label. */
const NAME_COL = 1
const GROUP_COL = 2
const QUAL_COL = 3
const ROTATION_COL = 4
const START_COL = 5
const STARTING_SHIFT_COL = 6
const FIRST_DATE_COL = 7
const HEADER_ROW = 3
const FIRST_DATA_ROW = HEADER_ROW + 1
const ROSTER_ROWS = 60

/** Rotations sheet layout */
const ROT_HEADER_ROW = 3
const ROT_FIRST_ROW = 4
const ROT_LAST_ROW = 23

/** A1-style column letter for a 1-based index. */
export function columnLetter(index: number): string {
  let n = index
  let out = ""
  while (n > 0) {
    const rem = (n - 1) % 26
    out = String.fromCharCode(65 + rem) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

export interface TemplateOptions {
  /** First day of the calendar; defaults to today */
  start?: Date
  /** How many day columns; defaults to 180 */
  days?: number
}

/** Rotations offered as a starting point; all of them editable. */
const EXAMPLE_ROTATIONS = [
  { name: "2 & 2 alternating", on: 14, off: 14, alternates: "Yes" },
  { name: "2 & 2 days only", on: 14, off: 14, alternates: "No" },
  { name: "2 & 3 alternating", on: 14, off: 21, alternates: "Yes" },
  { name: "1 & 1 alternating", on: 7, off: 7, alternates: "Yes" },
  { name: "3 & 3 alternating", on: 3, off: 3, alternates: "Yes" },
] as const

export async function buildImportTemplate(organizationId: string, options: TemplateOptions = {}) {
  const [groups, codes, qualifications] = await Promise.all([
    prisma.positionGroup.findMany({ where: { organizationId }, orderBy: { sortOrder: "asc" }, select: { name: true } }),
    prisma.customShiftType.findMany({
      where: { organizationId, isActive: true },
      orderBy: { code: "asc" },
      select: { code: true, name: true, coverageShift: true, isBackfill: true },
    }),
    prisma.qualification.findMany({ where: { organizationId }, orderBy: { sortOrder: "asc" }, select: { code: true, name: true } }),
  ])

  const start = normalizeToUTCMidnight(options.start ?? new Date())
  const days = Math.min(Math.max(options.days ?? 180, 7), 400)
  const dates = Array.from({ length: days }, (_, i) => addDaysUTC(start, i))

  const shiftCodes = ["D", "N", ...codes.map((c) => c.code)]
  const groupNames = groups.map((g) => g.name)

  const wb = new ExcelJS.Workbook()
  wb.creator = "ShiftSync"
  wb.created = new Date()

  // ── Guide ─────────────────────────────────────────────────────────────
  const guide = wb.addWorksheet(GUIDE)
  guide.columns = [{ width: 24 }, { width: 100 }]
  const say = (a: string, b = "") => {
    const row = guide.addRow([a, b])
    row.getCell(1).font = { bold: true }
    row.getCell(2).alignment = { wrapText: true, vertical: "top" }
  }
  const heading = (t: string) => {
    guide.addRow([])
    guide.addRow([t]).getCell(1).font = { bold: true, size: 12 }
  }

  guide.addRow(["Setting up your roster"]).getCell(1).font = { bold: true, size: 14 }
  guide.addRow([])
  say("The short version", `Describe your rotations on the "${ROTATIONS}" tab. Then on the "${SHEET}" tab give each person a rotation, the first day they start, and whether they start on days or nights. The rest of the year fills itself in. Save, then upload in ShiftSync under Settings → Import from a spreadsheet.`)
  say("Nothing is saved", "until you have seen what the app read and confirmed it. If something reads wrong, fix the sheet and upload it again.")

  heading("The Rotations tab")
  say("Rotation name", "Whatever you call it. It appears in the dropdown on the Roster tab, so name it something your supervisors would recognise.")
  say("Days on / Days off", "The length of one swing. 14 and 14 for two weeks on, two weeks off.")
  say("Alternates?", 'Yes if the crew swaps between days and nights each swing — on days for one trip, nights the next. No if they always work the same half of the day.')
  say("More than one", `Add as many rotations as you have. Different crews, different contracts, day-only staff — each gets a row, and each person on the ${SHEET} tab picks one.`)

  heading("The Roster tab")
  say("Name", "The person's full name. It is matched against people already in ShiftSync, so spell it the same way.")
  say("Position group", groupNames.length ? `One of: ${groupNames.join(", ")}. Leave blank to use the same group as the person above.` : "The block this person belongs to, e.g. Ops Techs. Leave blank to use the same group as the person above.")
  say("Sign-offs", qualifications.length ? `Any of: ${qualifications.map((q) => q.code).join(", ")}. Separate several with commas.` : "Training this person is signed off on, separated by commas. Set the list up in ShiftSync first (Settings → Coverage).")
  say("Rotation", "Pick one you defined on the Rotations tab.")
  say("First day on", "The first day of a swing you know they worked — any real start date. Everything before it is left blank, and everything after is worked out from it.")
  say("Starting shift", "D if that first swing was days, N if it was nights. If the rotation alternates, the app flips it every swing from there.")
  say("The day columns", "Fill in automatically. Type over any day to change just that one — a duty code, sick leave, anything. Your typing wins.")

  heading("What a filled-in row looks like")
  const exampleGroup = groupNames[groupNames.length - 1] ?? "Ops Techs"
  const exQuals = qualifications.slice(0, 2).map((q) => q.code).join(", ") || "UTIL, GAS"
  const exHead = guide.addRow(["Name", "Position group  |  Sign-offs  |  Rotation  |  First day on  |  Starting shift"])
  exHead.font = { bold: true }
  guide.addRow(["Worker One", `${exampleGroup}  |  ${exQuals}  |  ${EXAMPLE_ROTATIONS[0].name}  |  ${dates[0].toISOString().slice(0, 10)}  |  D`])
  guide.addRow(["Worker Two", `(blank — same group as above)  |  ${qualifications[0]?.code ?? "UTIL"}  |  ${EXAMPLE_ROTATIONS[0].name}  |  ${dates[0].toISOString().slice(0, 10)}  |  N`])
  guide.addRow(["", "Those two are the opposite halves of the same rotation: one starts on days, the other on nights, and they swap over every swing."])
  guide.getRow(guide.rowCount).getCell(2).font = { color: { argb: "FF64748B" } }
  guide.getRow(guide.rowCount).getCell(2).alignment = { wrapText: true }

  heading("Codes you can use")
  const codeRow = (code: string, meaning: string) => {
    const r = guide.addRow([code, meaning])
    r.getCell(1).font = { bold: true }
    r.getCell(2).alignment = { wrapText: true }
  }
  codeRow("D", "Working days")
  codeRow("N", "Working nights")
  for (const c of codes) {
    const shift = c.coverageShift === "DAY" ? "day" : c.coverageShift === "NIGHT" ? "night" : null
    codeRow(c.code, `${c.name}${shift ? ` — counts as a ${shift} shift` : " — not a working shift"}${c.isBackfill ? ", acting up" : ""}`)
  }
  if (codes.length === 0) {
    guide.addRow(["", "Set your duty codes up in ShiftSync first (Settings → Coverage → Offshore ops template) and download this again — the sheet will then check your codes as you type."])
  }

  heading("Worth knowing")
  say("Blank days", "A blank day means not working and nothing worth recording. You do not need to mark days off.")
  say("Adding a code", "Anything you type that ShiftSync does not know yet is created on import, and you can say what it counts toward afterwards.")
  say("Re-uploading", "Uploading again replaces the days this sheet covers, for the people on it. Days outside its date range are left alone.")
  say("Before uploading", "Open and save the file in Excel at least once, so the days it worked out are stored in the file.")

  // ── Rotations ─────────────────────────────────────────────────────────
  const rot = wb.addWorksheet(ROTATIONS)
  rot.columns = [{ width: 26 }, { width: 11 }, { width: 11 }, { width: 24 }, { width: 52 }]
  rot.getCell("A1").value = "Your rotations — edit these, add your own, delete any you do not use"
  rot.getCell("A1").font = { bold: true, size: 12 }

  const rotHeader = rot.getRow(ROT_HEADER_ROW)
  rotHeader.values = ["Rotation name", "Days on", "Days off", "Alternates days/nights?", "What this means"]
  rotHeader.font = { bold: true }
  rotHeader.border = { bottom: { style: "thin", color: { argb: "FF94A3B8" } } }

  EXAMPLE_ROTATIONS.forEach((r, i) => {
    const row = rot.getRow(ROT_FIRST_ROW + i)
    row.values = [
      r.name, r.on, r.off, r.alternates,
      r.alternates === "Yes"
        ? `${r.on} days on, ${r.off} off, then ${r.on} nights on, ${r.off} off — and repeat`
        : `${r.on} on, ${r.off} off, always the same half of the day`,
    ]
    row.getCell(5).font = { color: { argb: "FF64748B" } }
  })

  for (let r = ROT_FIRST_ROW; r <= ROT_LAST_ROW; r++) {
    rot.getCell(r, 4).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"Yes,No"'],
      showErrorMessage: true,
      errorTitle: "Yes or No",
      error: "Does this crew swap between days and nights each swing?",
    }
    for (const c of [2, 3]) {
      rot.getCell(r, c).dataValidation = {
        type: "whole",
        operator: "between",
        formulae: [1, 60],
        allowBlank: true,
        showErrorMessage: true,
        errorTitle: "Days on / days off",
        error: "Give a whole number of days, 1 to 60.",
      }
    }
  }

  // ── Roster ────────────────────────────────────────────────────────────
  const ws = wb.addWorksheet(SHEET, {
    views: [{ state: "frozen", xSplit: FIRST_DATE_COL - 1, ySplit: HEADER_ROW }],
  })

  ws.getCell(1, NAME_COL).value = "Roster — one person per row. Fill in the first six columns; the days work themselves out."
  ws.getCell(1, NAME_COL).font = { bold: true, size: 12 }

  const weekday = ws.getRow(HEADER_ROW - 1)
  const header = ws.getRow(HEADER_ROW)
  header.getCell(NAME_COL).value = "Name"
  header.getCell(GROUP_COL).value = "Position group"
  header.getCell(QUAL_COL).value = "Sign-offs"
  header.getCell(ROTATION_COL).value = "Rotation"
  header.getCell(START_COL).value = "First day on"
  header.getCell(STARTING_SHIFT_COL).value = "Starting shift"

  const lastDateCol = FIRST_DATE_COL + days - 1
  dates.forEach((d, i) => {
    const col = FIRST_DATE_COL + i
    const wc = weekday.getCell(col)
    wc.value = ["S", "M", "T", "W", "T", "F", "S"][d.getUTCDay()]
    wc.alignment = { horizontal: "center" }
    wc.font = { size: 8, color: { argb: "FF64748B" } }

    const hc = header.getCell(col)
    hc.value = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    hc.numFmt = "d mmm"
    hc.alignment = { horizontal: "center" }
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
      const fill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF1F5F9" } }
      hc.fill = fill
      wc.fill = fill
    }
    ws.getColumn(col).width = 5
  })

  header.font = { bold: true }
  header.border = { bottom: { style: "thin", color: { argb: "FF94A3B8" } } }
  ws.getColumn(NAME_COL).width = 26
  ws.getColumn(GROUP_COL).width = 20
  ws.getColumn(QUAL_COL).width = 18
  ws.getColumn(ROTATION_COL).width = 20
  ws.getColumn(START_COL).width = 14
  ws.getColumn(STARTING_SHIFT_COL).width = 13

  // Helper columns, past the end of the calendar so they are out of the way
  // and out of the parser's date run. Hidden, but present if anyone wants to
  // see why a day came out the way it did.
  const H_ON = lastDateCol + 2
  const H_OFF = H_ON + 1
  const H_ALT = H_OFF + 1
  const H_CYCLE = H_ALT + 1
  const H_OTHER = H_CYCLE + 1
  const helpers: [number, string][] = [
    [H_ON, "Days on"], [H_OFF, "Days off"], [H_ALT, "Alternates"], [H_CYCLE, "Cycle length"], [H_OTHER, "Other shift"],
  ]
  for (const [col, label] of helpers) {
    header.getCell(col).value = label
    ws.getColumn(col).hidden = true
    ws.getColumn(col).width = 12
  }

  const L = columnLetter
  const rotLookup = `${ROTATIONS}!$A$${ROT_FIRST_ROW}:$D$${ROT_LAST_ROW}`

  for (let r = FIRST_DATA_ROW; r < FIRST_DATA_ROW + ROSTER_ROWS; r++) {
    const rotCell = `$${L(ROTATION_COL)}${r}`
    const startCell = `$${L(START_COL)}${r}`
    const shiftCell = `$${L(STARTING_SHIFT_COL)}${r}`
    const on = `$${L(H_ON)}${r}`
    const off = `$${L(H_OFF)}${r}`
    const alt = `$${L(H_ALT)}${r}`
    const cycle = `$${L(H_CYCLE)}${r}`
    const other = `$${L(H_OTHER)}${r}`

    // Look the rotation's numbers up once per person, not once per day
    ws.getCell(r, H_ON).value = { formula: `IF(${rotCell}="","",IFERROR(VLOOKUP(${rotCell},${rotLookup},2,FALSE),""))`, date1904: false }
    ws.getCell(r, H_OFF).value = { formula: `IF(${rotCell}="","",IFERROR(VLOOKUP(${rotCell},${rotLookup},3,FALSE),""))`, date1904: false }
    ws.getCell(r, H_ALT).value = { formula: `IF(${rotCell}="","No",IFERROR(VLOOKUP(${rotCell},${rotLookup},4,FALSE),"No"))`, date1904: false }
    ws.getCell(r, H_CYCLE).value = { formula: `IF(${on}="","",IF(${alt}="Yes",2*(${on}+${off}),${on}+${off}))`, date1904: false }
    ws.getCell(r, H_OTHER).value = { formula: `IF(${shiftCell}="D","N","D")`, date1904: false }

    // Dropdowns on the columns people type into
    if (groupNames.length > 0) {
      ws.getCell(r, GROUP_COL).dataValidation = {
        type: "list", allowBlank: true,
        formulae: [`"${groupNames.join(",").slice(0, 250)}"`],
        showErrorMessage: true, errorTitle: "Not a position group",
        error: `Use one of: ${groupNames.join(", ")}`,
      }
    }
    ws.getCell(r, ROTATION_COL).dataValidation = {
      type: "list", allowBlank: true,
      formulae: [`${ROTATIONS}!$A$${ROT_FIRST_ROW}:$A$${ROT_LAST_ROW}`],
      showErrorMessage: true, errorTitle: "Unknown rotation",
      error: `Pick one from the ${ROTATIONS} tab, or add it there first.`,
    }
    ws.getCell(r, START_COL).numFmt = "yyyy-mm-dd"
    ws.getCell(r, STARTING_SHIFT_COL).dataValidation = {
      type: "list", allowBlank: true, formulae: ['"D,N"'],
      showErrorMessage: true, errorTitle: "Days or nights",
      error: "D if that first swing was days, N if it was nights.",
    }
    ws.getCell(r, STARTING_SHIFT_COL).alignment = { horizontal: "center" }

    for (let i = 0; i < days; i++) {
      const col = FIRST_DATE_COL + i
      const date = `${L(col)}$${HEADER_ROW}`
      const elapsed = `MOD(${date}-${startCell},${cycle})`

      // Blank until they start; then: on-swing = starting shift, off-swing =
      // blank, and for an alternating rotation the second swing is the other
      // half of the day before it repeats.
      const formula =
        `IF(OR(${rotCell}="",${startCell}="",${cycle}="",${date}<${startCell}),"",` +
        `IF(${alt}="Yes",` +
        `IF(${elapsed}<${on},${shiftCell},` +
        `IF(${elapsed}<${on}+${off},"",` +
        `IF(${elapsed}<2*${on}+${off},${other},""))),` +
        `IF(${elapsed}<${on},${shiftCell},"")))`

      const cell = ws.getCell(r, col)
      cell.value = { formula, date1904: false }
      cell.alignment = { horizontal: "center" }

      const list = shiftCodes.join(",")
      if (list.length <= 250) {
        cell.dataValidation = {
          type: "list", allowBlank: true, formulae: [`"${list}"`],
          // A hard error would fight anyone pasting a block of days in
          showErrorMessage: false,
        }
      }
    }
  }

  // The marker the parser stops at, so notes below the roster are ignored
  const end = ws.getCell(FIRST_DATA_ROW + ROSTER_ROWS, NAME_COL)
  end.value = "<End of personnel>"
  end.font = { italic: true, color: { argb: "FF94A3B8" } }

  return wb
}

export function templateFileName(start: Date): string {
  return `shiftsync-roster-${start.toISOString().slice(0, 10)}.xlsx`
}
