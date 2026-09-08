import ExcelJS from "exceljs"
import { prisma } from "../prisma"
import { addDaysUTC, normalizeToUTCMidnight } from "../timezone"

/**
 * The blank roster workbook the app hands out.
 *
 * Generated rather than shipped as a static file, and generated from the
 * organization's own coverage setup: the position groups it offers and the
 * duty codes it validates against are the ones that organization actually
 * has. A fixed template would send people back with codes the app does not
 * know, which is exactly the friction it is meant to remove.
 *
 * It uses the labelled-column shape the parser prefers (Name / Position group
 * / Sign-offs), so nothing about the layout has to be inferred — including a
 * person added before they have any shifts, who in the heading-row shape is
 * indistinguishable from a group heading.
 */

const SHEET = "Roster"
const GUIDE = "How to fill this in"

/** Columns before the calendar. Order matters; the parser reads the labels. */
const NAME_COL = 1
const GROUP_COL = 2
const QUAL_COL = 3
const FIRST_DATE_COL = 4
const HEADER_ROW = 3

export interface TemplateOptions {
  /** First day of the calendar; defaults to today */
  start?: Date
  /** How many day columns; defaults to 90 */
  days?: number
}

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
  const days = Math.min(Math.max(options.days ?? 90, 7), 400)
  const dates = Array.from({ length: days }, (_, i) => addDaysUTC(start, i))

  // D and N are built in; the rest are this organization's duty codes
  const shiftCodes = ["D", "N", ...codes.map((c) => c.code)]
  const groupNames = groups.map((g) => g.name)

  const wb = new ExcelJS.Workbook()
  wb.creator = "ShiftSync"
  wb.created = new Date()

  // ── The guide sheet, first so it opens on it ──────────────────────────
  const guide = wb.addWorksheet(GUIDE)
  guide.columns = [{ width: 22 }, { width: 96 }]

  const say = (a: string, b = "", bold = false) => {
    const row = guide.addRow([a, b])
    row.getCell(1).font = { bold: true }
    row.getCell(2).alignment = { wrapText: true, vertical: "top" }
    if (bold) row.getCell(2).font = { bold: true }
    return row
  }

  guide.addRow(["Filling in the roster"]).getCell(1).font = { bold: true, size: 14 }
  guide.addRow([])
  say("What to do", `Open the "${SHEET}" tab. Put one person per row. Fill in the days they work. Save, then upload it in ShiftSync under Settings → Import from a spreadsheet.`)
  say("Nothing is saved", "until you have seen what the app read and confirmed it. If it reads something wrong, fix the sheet and upload it again.")
  guide.addRow([])
  say("Name", "The person's full name. It is matched against people already in ShiftSync, so spell it the same way.")
  say("Position group", groupNames.length ? `One of: ${groupNames.join(", ")}. Leave blank to use the same group as the person above.` : "The block this person belongs to, e.g. Ops Techs. Leave blank to use the same group as the person above.")
  say("Sign-offs", qualifications.length ? `Any of: ${qualifications.map((q) => q.code).join(", ")}. Separate several with commas.` : "Training this person is signed off on, separated by commas. Set the list up in ShiftSync first (Settings → Coverage).")
  say("The day columns", "One letter or code per day. Leave a day blank if they are not working and it is not worth recording.")
  guide.addRow([])

  guide.addRow(["What a filled-in row looks like"]).getCell(1).font = { bold: true, size: 12 }
  const exampleHead = guide.addRow(["Name", "Position group   |   Sign-offs   |   Mon Tue Wed Thu Fri Sat Sun"])
  exampleHead.font = { bold: true }
  // The last group, not the first: these lists start with management, and an
  // example putting an operator in the OIM row teaches the wrong thing.
  const exampleGroup = groupNames[groupNames.length - 1] ?? "Ops Techs"
  guide.addRow(["Steve Ennis", `${exampleGroup}   |   ${qualifications.slice(0, 2).map((q) => q.code).join(", ") || "UTIL, GAS"}   |   D   D   D   N   N`])
  guide.addRow(["Rod Nippard", `(blank — same group as above)   |   ${qualifications[0]?.code ?? "UTIL"}   |   N   N   D   D`])
  guide.addRow([])

  guide.addRow(["Codes you can use"]).getCell(1).font = { bold: true, size: 12 }
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
  guide.addRow([])
  say("Adding a code", "Anything you type that ShiftSync does not know yet is created on import, and you can say what it counts toward afterwards.")
  say("Re-uploading", "Uploading again replaces the days this sheet covers, for the people on it. Days outside its date range are left alone.")

  // ── The roster sheet ──────────────────────────────────────────────────
  const ws = wb.addWorksheet(SHEET, {
    views: [{ state: "frozen", xSplit: FIRST_DATE_COL - 1, ySplit: HEADER_ROW }],
  })

  ws.getRow(1).getCell(NAME_COL).value = "Roster — fill in one person per row, then upload in ShiftSync"
  ws.getRow(1).getCell(NAME_COL).font = { bold: true, size: 12 }

  // Row 2: weekday letters, so the eye can find weekends
  // Row 3: the dates themselves — this is the row the parser reads
  const weekday = ws.getRow(HEADER_ROW - 1)
  const header = ws.getRow(HEADER_ROW)
  header.getCell(NAME_COL).value = "Name"
  header.getCell(GROUP_COL).value = "Position group"
  header.getCell(QUAL_COL).value = "Sign-offs"

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
    const weekendDay = d.getUTCDay() === 0 || d.getUTCDay() === 6
    if (weekendDay) {
      hc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } }
      wc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } }
    }
    ws.getColumn(col).width = 5
  })

  header.font = { bold: true }
  header.border = { bottom: { style: "thin", color: { argb: "FF94A3B8" } } }

  ws.getColumn(NAME_COL).width = 26
  ws.getColumn(GROUP_COL).width = 22
  ws.getColumn(QUAL_COL).width = 20

  // No example row on this sheet, deliberately. An example with shifts
  // pre-filled is a trap: type your own name over it rather than deleting the
  // row and you inherit a fortnight of shifts that were never real. The
  // worked example lives on the guide sheet instead, where it cannot be
  // mistaken for data.
  const firstDataRow = HEADER_ROW + 1
  const LAST_ROW = firstDataRow + 60

  // Dropdowns, so a typo is caught in Excel rather than on upload
  for (let r = firstDataRow; r <= LAST_ROW; r++) {
    if (groupNames.length > 0) {
      ws.getCell(r, GROUP_COL).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${groupNames.join(",").slice(0, 250)}"`],
        showErrorMessage: true,
        errorTitle: "Not a position group",
        error: `Use one of: ${groupNames.join(", ")}`,
      }
    }
    for (let i = 0; i < days; i++) {
      ws.getCell(r, FIRST_DATE_COL + i).alignment = { horizontal: "center" }
      // Excel caps an inline list at 255 characters; skip it rather than
      // produce a file Excel refuses to open.
      const list = shiftCodes.join(",")
      if (list.length <= 250) {
        ws.getCell(r, FIRST_DATE_COL + i).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`"${list}"`],
          showErrorMessage: false, // a warning would fight anyone pasting a year in
        }
      }
    }
  }

  // The marker the parser stops at, so anything below is free for notes
  const end = ws.getRow(LAST_ROW + 1)
  end.getCell(NAME_COL).value = "<End of personnel>"
  end.getCell(NAME_COL).font = { italic: true, color: { argb: "FF94A3B8" } }

  return wb
}

export function templateFileName(start: Date): string {
  return `shiftsync-roster-${start.toISOString().slice(0, 10)}.xlsx`
}
