import { describe, it, expect, vi } from "vitest"

// The template is built from the organization's own setup, so stand one in
vi.mock("../prisma", () => ({
  prisma: {
    positionGroup: { findMany: async () => [{ name: "OIM" }, { name: "OCR Ops" }, { name: "Ops Techs" }] },
    customShiftType: {
      findMany: async () => [
        { code: "OCR-D", name: "Control Room – Day", coverageShift: "DAY", isBackfill: false },
        { code: "CCR-N", name: "CCR – Night", coverageShift: "NIGHT", isBackfill: false },
        { code: "SL", name: "Sick Leave", coverageShift: null, isBackfill: false },
      ],
    },
    qualification: {
      findMany: async () => [
        { code: "UTIL", name: "Utilities Operator" },
        { code: "GAS", name: "Gas Operator" },
      ],
    },
  },
}))

import ExcelJS from "exceljs"
import { buildImportTemplate } from "../services/import-template"
import { parseWorkbook } from "../services/schedule-import"

async function buildAndParse(fill?: (ws: ExcelJS.Worksheet) => void) {
  const wb = await buildImportTemplate("org1", { start: new Date("2026-03-02T00:00:00.000Z"), days: 30 })
  const ws = wb.getWorksheet("Roster")!
  fill?.(ws)
  const buffer = await wb.xlsx.writeBuffer()
  return parseWorkbook(buffer as ArrayBuffer)
}

describe("the roster template", () => {
  it("is a workbook the importer reads without guessing", async () => {
    const parsed = await buildAndParse()
    expect(parsed.sheetName).toBe("Roster")
    expect(parsed.dates).toHaveLength(30)
    expect(parsed.dates[0]).toBe("2026-03-02")
    expect(parsed.dates[29]).toBe("2026-03-31")
    // The guide sheet must not be mistaken for the roster
    expect(parsed.availableSheets).toContain("How to fill this in")
  })

  it("starts with an empty roster — no example row to accidentally keep", async () => {
    // An example row with shifts pre-filled is a trap: overwrite its name
    // instead of deleting the row and you import a fortnight of invented
    // shifts. The worked example lives on the guide sheet instead.
    const parsed = await buildAndParse()
    expect(parsed.people).toEqual([])
    expect(parsed.shifts).toEqual([])
  })

  it("round-trips people filled into it", async () => {
    const parsed = await buildAndParse((ws) => {
      const write = (row: number, name: string, group: string, quals: string, codes: string[]) => {
        ws.getCell(row, 1).value = name
        ws.getCell(row, 2).value = group
        ws.getCell(row, 3).value = quals
        codes.forEach((c, i) => { if (c) ws.getCell(row, 4 + i).value = c })
      }
      write(4, "Steve Ennis", "Ops Techs", "UTIL", ["D", "D", "N", "", "SL"])
      write(5, "Rod Nippard", "", "GAS, UTIL", ["N", "N", "D"])          // blank group = same as above
      write(6, "Matt Harris", "OCR Ops", "", ["OCR-D", "OCR-D"])
    })

    expect(parsed.people.map((p) => p.name)).toEqual(["Steve Ennis", "Rod Nippard", "Matt Harris"])
    expect(parsed.people.map((p) => p.group)).toEqual(["Ops Techs", "Ops Techs", "OCR Ops"])
    expect(parsed.people[0].qualifications).toEqual(["UTIL"])
    expect(parsed.people[1].qualifications).toEqual(["GAS", "UTIL"])
    expect(parsed.people.map((p) => p.rosterOrder)).toEqual([1, 2, 3])
    expect(parsed.groups).toEqual(["Ops Techs", "OCR Ops"])

    const steve = parsed.shifts.filter((s) => s.name === "Steve Ennis")
    expect(steve.map((s) => s.code)).toEqual(["D", "D", "N", "SL"])
    expect(steve[0].date).toBe("2026-03-02")
    expect(parsed.warnings).toEqual([])
  })

  it("keeps a person who has no shifts yet, rather than reading them as a heading", async () => {
    // This is exactly why the template labels its columns: in the heading-row
    // shape, a person with an empty row is indistinguishable from a heading,
    // and would silently adopt everyone listed below them.
    const parsed = await buildAndParse((ws) => {
      ws.getCell(4, 1).value = "New Starter"
      ws.getCell(4, 2).value = "Ops Techs"
      ws.getCell(5, 1).value = "Steve Ennis"
      ws.getCell(5, 2).value = "Ops Techs"
      ws.getCell(5, 4).value = "D"
      ws.getCell(5, 5).value = "D"
    })

    expect(parsed.people.map((p) => p.name)).toEqual(["New Starter", "Steve Ennis"])
    expect(parsed.people[0].group).toBe("Ops Techs")
    expect(parsed.groups).toEqual(["Ops Techs"])
    expect(parsed.warnings).toEqual([])
  })

  it("stops at the end marker, so notes below the roster are ignored", async () => {
    const parsed = await buildAndParse((ws) => {
      ws.getCell(4, 1).value = "Steve Ennis"
      ws.getCell(4, 2).value = "Ops Techs"
      ws.getCell(4, 4).value = "D"
      ws.getCell(70, 1).value = "Remember to check nights"
    })
    expect(parsed.people.map((p) => p.name)).toEqual(["Steve Ennis"])
  })

  it("lists the organization's own duty codes in the guide", async () => {
    const wb = await buildImportTemplate("org1", { days: 14 })
    const guide = wb.getWorksheet("How to fill this in")!
    const text: string[] = []
    guide.eachRow((row) => row.eachCell((c) => text.push(String(c.value ?? ""))))
    const all = text.join(" | ")
    expect(all).toContain("OCR-D")
    expect(all).toContain("Control Room – Day")
    expect(all).toContain("UTIL")
    expect(all).toContain("Ops Techs")
  })
})
