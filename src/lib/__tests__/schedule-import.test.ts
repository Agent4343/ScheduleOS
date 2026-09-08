import { describe, it, expect, vi } from "vitest"

vi.mock("../prisma", () => ({ prisma: {} }))

import { parseScheduleGrid, normaliseCode, normaliseCellValue, type Cell } from "../services/schedule-import"

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

/** A miniature roster in the shape these workbooks use. */
function grid(): Cell[][] {
  return [
    [null, null, null, null, null, null, null],
    [null, null, "M", "T", "W", "T", "F"],
    [null, null, d("2026-03-02"), d("2026-03-03"), d("2026-03-04"), d("2026-03-05"), d("2026-03-06")],
    ["OIM", null, null, null, null, null, null],
    ["Jeremy Baldwin", 151, "D", "D", "D", "D", "D"],
    ["Ops Techs", null, null, null, null, null, null],
    ["Steve Ennis", 151, "D", "D", "D", "N", "N"],
    ["Jordan Riggs*", 352, "D", "D", "SL", "D", "D"],
    ["Mitch Scott", 352, "OCR-D", "OCR - D", null, "L", "D"],
    ["<End of Personnel>", null, null, null, null, null, null],
    ["Days (Outside Ops)", null, 2, 2, 1, 1, 1],
  ]
}

describe("normaliseCode", () => {
  it("upper-cases and closes up spacing around dashes", () => {
    expect(normaliseCode(" ocr - d ")).toBe("OCR-D")
    expect(normaliseCode("bccr-n")).toBe("BCCR-N")
  })
})

describe("parseScheduleGrid", () => {
  it("reads dates, groups, people and shifts", () => {
    const p = parseScheduleGrid(grid(), "ShiftSked")
    expect(p.dates).toEqual(["2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06"])
    expect(p.groups).toEqual(["OIM", "Ops Techs"])
    expect(p.people.map((x) => x.name)).toEqual(["Jeremy Baldwin", "Steve Ennis", "Jordan Riggs", "Mitch Scott"])
    expect(p.people.map((x) => x.group)).toEqual(["OIM", "Ops Techs", "Ops Techs", "Ops Techs"])
    expect(p.shifts).toHaveLength(19)
  })

  it("keeps sheet order as roster order", () => {
    const p = parseScheduleGrid(grid())
    expect(p.people.map((x) => x.rosterOrder)).toEqual([1, 2, 3, 4])
  })

  it("turns a trailing asterisk into the CCR sign-off", () => {
    const p = parseScheduleGrid(grid())
    expect(p.people.find((x) => x.name === "Jordan Riggs")!.qualifications).toEqual(["CCR"])
    expect(p.people.find((x) => x.name === "Steve Ennis")!.qualifications).toEqual([])
  })

  it("normalises codes and stops at the end marker", () => {
    const p = parseScheduleGrid(grid())
    const mitch = p.shifts.filter((s) => s.name === "Mitch Scott").map((s) => s.code)
    expect(mitch).toEqual(["OCR-D", "OCR-D", "L", "D"]) // "OCR - D" folded in
    // The count row below <End of Personnel> must not become a person
    expect(p.people.some((x) => x.name.startsWith("Days ("))).toBe(false)
  })

  it("ignores a stray date outside the calendar", () => {
    // A "printed on" date sitting in column A, left of the calendar and later
    // than it — this used to be taken for a date column, which shifted the
    // whole read one column and turned names into shift codes.
    const g = grid()
    g[2][0] = d("2026-09-07")
    const p = parseScheduleGrid(g)
    expect(p.dates).toEqual(["2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06"])
    expect(p.people.map((x) => x.name)).toContain("Steve Ennis")
    expect(p.warnings.some((w) => /stray date/i.test(w))).toBe(true)
  })

  it("treats a vacant row carrying a crew code as a person, not a heading", () => {
    // A placeholder like "TBA" has no shifts all year and reads exactly like a
    // group heading — and would then adopt everyone listed below it.
    const g = grid()
    g.splice(8, 0, ["TBA", 451, null, null, null, null, null])
    const p = parseScheduleGrid(g)
    expect(p.groups).toEqual(["OIM", "Ops Techs"])
    expect(p.people.find((x) => x.name === "TBA")!.group).toBe("Ops Techs")
    // Everyone after it stays in Ops Techs
    expect(p.people.find((x) => x.name === "Mitch Scott")!.group).toBe("Ops Techs")
  })

  it("flags a bare vacant row, which is genuinely ambiguous", () => {
    const g = grid()
    g.splice(9, 0, ["Someone Absent", null, null, null, null, null, null])
    const p = parseScheduleGrid(g)
    expect(p.warnings.some((w) => w.includes("Someone Absent"))).toBe(true)
    expect(p.groups).not.toContain("Someone Absent")
  })

  it("reports a sheet with no calendar rather than guessing", () => {
    const p = parseScheduleGrid([["Name", "Notes"], ["Steve", "hello"]])
    expect(p.people).toEqual([])
    expect(p.warnings[0]).toMatch(/does not look like a roster/i)
  })

  it("counts distinct codes, most common first", () => {
    const p = parseScheduleGrid(grid())
    expect(p.codes[0]).toEqual({ code: "D", count: 13 })
    expect(p.codes.map((c) => c.code)).toContain("SL")
  })
})

describe("normaliseCellValue", () => {
  it("takes a formula's computed value", () => {
    expect(normaliseCellValue({ formula: 'IF(1,"D","")', result: "D" })).toBe("D")
    expect(normaliseCellValue({ sharedFormula: "G4", result: "N" })).toBe("N")
  })

  it("treats a formula with no result as empty, not as an object", () => {
    // ExcelJS omits `result` entirely when a formula evaluates to "". Reading
    // the object instead would import every formula-driven day off as a shift
    // code spelled "[OBJECT OBJECT]".
    expect(normaliseCellValue({ formula: 'IF(0,"D","")' })).toBe(null)
    expect(normaliseCellValue({ formula: 'IF(0,"D","")', result: "" })).toBe("")
  })

  it("ignores formula errors", () => {
    expect(normaliseCellValue({ formula: "1/0", result: { error: "#DIV/0!" } })).toBe(null)
    expect(normaliseCellValue({ error: "#N/A" })).toBe(null)
  })

  it("flattens formatted text and hyperlink labels", () => {
    expect(normaliseCellValue({ richText: [{ text: "OCR" }, { text: "-D" }] })).toBe("OCR-D")
    expect(normaliseCellValue({ text: "Steve", hyperlink: "mailto:x@y.z" })).toBe("Steve")
  })

  it("passes plain values straight through", () => {
    const d = new Date("2026-03-02T00:00:00.000Z")
    expect(normaliseCellValue(d)).toBe(d)
    expect(normaliseCellValue("D")).toBe("D")
    expect(normaliseCellValue(151)).toBe(151)
    expect(normaliseCellValue(null)).toBe(null)
  })
})
