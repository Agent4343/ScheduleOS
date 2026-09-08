import { describe, it, expect, vi, beforeAll } from "vitest"
import { execFileSync } from "child_process"
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

vi.mock("../prisma", () => ({
  prisma: {
    positionGroup: { findMany: async () => [{ name: "Ops Techs" }] },
    customShiftType: { findMany: async () => [] },
    qualification: { findMany: async () => [] },
  },
}))

import ExcelJS from "exceljs"
import { buildImportTemplate } from "../services/import-template"
import { normaliseCellValue } from "../services/schedule-import"

/**
 * The template fills the year in with Excel formulas, so the only honest way
 * to test them is to make a spreadsheet program work them out. LibreOffice
 * recalculates on load, which is enough.
 *
 * Skipped where LibreOffice is not installed (CI runners, most laptops)
 * rather than failing — the rest of the template's tests do not need it.
 */
const soffice = ["/usr/bin/soffice", "/usr/local/bin/soffice", "/Applications/LibreOffice.app/Contents/MacOS/soffice"]
  .find((p) => existsSync(p))

describe.skipIf(!soffice)("the rotation formulas, worked out by a real spreadsheet", () => {
  let pattern: (name: string) => string

  beforeAll(async () => {
    const wb = await buildImportTemplate("org1", { start: new Date("2026-03-02T00:00:00.000Z"), days: 60 })
    const ws = wb.getWorksheet("Roster")!
    const person = (row: number, name: string, rotation: string, start: string, shift: string) => {
      ws.getCell(row, 1).value = name
      ws.getCell(row, 2).value = "Ops Techs"
      ws.getCell(row, 4).value = rotation
      ws.getCell(row, 5).value = new Date(`${start}T00:00:00.000Z`)
      ws.getCell(row, 6).value = shift
    }
    person(4, "Worker One", "3 & 3 alternating", "2026-03-02", "D")
    person(5, "Worker Two", "3 & 3 alternating", "2026-03-02", "N")
    person(6, "Worker Three", "1 & 1 alternating", "2026-03-02", "D")
    person(7, "Worker Four", "2 & 2 days only", "2026-03-02", "D")
    person(8, "Worker Five", "3 & 3 alternating", "2026-03-09", "D") // starts a week later

    const dir = mkdtempSync(join(tmpdir(), "shiftsync-tpl-"))
    const outDir = join(dir, "recalculated")
    mkdirSync(outDir)
    const src = join(dir, "filled.xlsx")
    writeFileSync(src, Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer))
    // Must be a different directory: converting onto the source path leaves
    // the file untouched, and every day then reads as blank.
    execFileSync(soffice!, ["--headless", "--calc", "--convert-to", "xlsx", "--outdir", outDir, src], { stdio: "ignore" })

    const out = new ExcelJS.Workbook()
    await out.xlsx.readFile(join(outDir, "filled.xlsx"))
    const sheet = out.getWorksheet("Roster")!

    pattern = (name: string) => {
      let row = -1
      sheet.eachRow((r, n) => { if (String(r.getCell(1).value ?? "") === name) row = n })
      expect(row).toBeGreaterThan(0)
      let out = ""
      for (let i = 0; i < 24; i++) {
        // The same coercion the importer uses, so this tests what really happens
        const v = normaliseCellValue(sheet.getRow(row).getCell(7 + i).value)
        out += v ? String(v) : "."
      }
      return out
    }
  }, 180000)

  it("alternates days and nights each swing", () => {
    expect(pattern("Worker One")).toBe("DDD...NNN...DDD...NNN...")
  })

  it("mirrors for the crew starting on nights", () => {
    expect(pattern("Worker Two")).toBe("NNN...DDD...NNN...DDD...")
  })

  it("handles a longer swing", () => {
    expect(pattern("Worker Three")).toBe("DDDDDDD.......NNNNNNN...")
  })

  it("never flips a rotation that does not alternate", () => {
    expect(pattern("Worker Four")).toBe("DDDDDDDDDDDDDD..........")
  })

  it("leaves everything before the start date blank", () => {
    // Starts a week after the calendar does
    expect(pattern("Worker Five")).toBe(".......DDD...NNN...DDD..")
  })
})
