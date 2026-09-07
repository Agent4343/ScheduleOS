import { describe, it, expect, vi } from "vitest"

vi.mock("../prisma", () => ({ prisma: {} }))

import {
  evaluateCoverageDay,
  evaluateCoverage,
  type CoverageRoleDef,
  type CoverageGroupDef,
  type DutyCodeDef,
  type CoverageScheduleRow,
} from "../services/coverage"
import { toUTCDate } from "../timezone"

// The operations spreadsheet's rules, expressed as configuration
const roles: CoverageRoleDef[] = [
  { id: "oim", name: "OIM", sortOrder: 1, minDay: 1, targetDay: 1, minNight: 0, targetNight: 0 },
  { id: "lead", name: "Production Lead", sortOrder: 2, minDay: 1, targetDay: 1, minNight: 1, targetNight: 1 },
  { id: "ocr", name: "Control Room", sortOrder: 3, minDay: 2, targetDay: 2, minNight: 2, targetNight: 2, requiredQualification: null },
  { id: "ops", name: "Outside Ops", sortOrder: 4, minDay: 3, targetDay: 4, minNight: 3, targetNight: 4 },
]
const groups: CoverageGroupDef[] = [
  { id: "g-oim", name: "OIM", sortOrder: 1, defaultCoverageRoleId: "oim" },
  { id: "g-lead", name: "Production Leads", sortOrder: 3, defaultCoverageRoleId: "lead" },
  { id: "g-ocr", name: "OCR Ops", sortOrder: 4, defaultCoverageRoleId: "ocr" },
  { id: "g-tech", name: "Ops Techs", sortOrder: 5, defaultCoverageRoleId: "ops" },
]
const codes: DutyCodeDef[] = [
  { code: "OCR-D", coverageShift: "DAY", coverageRoleId: "ocr", isBackfill: false },
  { code: "OCR-N", coverageShift: "NIGHT", coverageRoleId: "ocr", isBackfill: false },
  { code: "CCR-D", coverageShift: "DAY", coverageRoleId: "ocr", isBackfill: false },
  { code: "BCCR-D", coverageShift: "DAY", coverageRoleId: "ops", isBackfill: true },
  { code: "PL-D", coverageShift: "DAY", coverageRoleId: "lead", isBackfill: true },
  { code: "SL", coverageShift: null, coverageRoleId: null, isBackfill: false },
]

const D = toUTCDate("2026-03-02")
let n = 0
const row = (
  shiftType: string,
  group: string | null,
  code: string | null = null,
  qualifications: string[] = []
): CoverageScheduleRow => ({
  date: D,
  shiftType,
  customShiftCode: code,
  user: { id: `u${++n}`, name: `Worker ${n}`, positionGroupId: group, qualifications },
})

const line = (day: ReturnType<typeof evaluateCoverageDay>, role: string, shift: "DAY" | "NIGHT") =>
  day.lines.find((l) => l.roleId === role && l.shift === shift)!

describe("evaluateCoverageDay", () => {
  it("counts plain D/N shifts toward the worker's group default role", () => {
    const day = evaluateCoverageDay(
      D,
      [row("DAY", "g-tech"), row("DAY", "g-tech"), row("DAY", "g-tech"), row("NIGHT", "g-tech"), row("DAY", "g-ocr"), row("DAY", "g-ocr")],
      roles, groups, codes
    )
    expect(line(day, "ops", "DAY")).toMatchObject({ have: 3, min: 3, target: 4, status: "amber" })
    expect(line(day, "ops", "NIGHT")).toMatchObject({ have: 1, status: "red" })
    expect(line(day, "ocr", "DAY")).toMatchObject({ have: 2, status: "ok" })
  })

  it("a duty code moves a worker to another role regardless of their group", () => {
    // An Ops Tech on CCR-D counts as Control Room, not Outside Ops
    const day = evaluateCoverageDay(D, [row("CUSTOM", "g-tech", "CCR-D"), row("CUSTOM", "g-ocr", "OCR-D")], roles, groups, codes)
    expect(line(day, "ocr", "DAY").have).toBe(2)
    expect(line(day, "ops", "DAY").have).toBe(0)
    expect(line(day, "ocr", "DAY").roster.map((r) => r.via)).toEqual(["CCR-D", "OCR-D"])
  })

  it("backfill codes count and are flagged", () => {
    const day = evaluateCoverageDay(D, [row("CUSTOM", "g-tech", "PL-D")], roles, groups, codes)
    const l = line(day, "lead", "DAY")
    expect(l.have).toBe(1)
    expect(l.roster[0].isBackfill).toBe(true)
  })

  it("management is excluded from ops counts because it has its own role", () => {
    const day = evaluateCoverageDay(D, [row("DAY", "g-oim"), row("DAY", "g-lead"), row("DAY", "g-tech")], roles, groups, codes)
    expect(line(day, "ops", "DAY").have).toBe(1)
    expect(line(day, "oim", "DAY")).toMatchObject({ have: 1, status: "ok" })
  })

  it("workers in a group with no default role, and non-working codes, are ignored", () => {
    const day = evaluateCoverageDay(D, [row("DAY", null), row("CUSTOM", "g-tech", "SL"), row("VACATION", "g-tech")], roles, groups, codes)
    expect(line(day, "ops", "DAY").have).toBe(0)
  })

  it("an unqualified worker is listed but not counted when the role requires a qualification", () => {
    const ccrRoles = roles.map((r) => (r.id === "ocr" ? { ...r, requiredQualification: "CCR" } : r))
    const day = evaluateCoverageDay(
      D,
      [row("CUSTOM", "g-tech", "CCR-D", ["CCR"]), row("CUSTOM", "g-tech", "CCR-D", [])],
      ccrRoles, groups, codes
    )
    const l = line(day, "ocr", "DAY")
    expect(l.have).toBe(1)
    expect(l.roster.map((r) => r.unqualified)).toEqual([false, true])
  })

  it("omits lines with no requirement and reports the worst status for the day", () => {
    const day = evaluateCoverageDay(D, [], roles, groups, codes)
    expect(day.lines.some((l) => l.roleId === "oim" && l.shift === "NIGHT")).toBe(false)
    expect(day.status).toBe("red")
  })
})

describe("evaluateCoverage over a range", () => {
  it("returns one entry per day, including empty days", () => {
    const days = evaluateCoverage(toUTCDate("2026-03-01"), toUTCDate("2026-03-03"), [row("DAY", "g-tech")], roles, groups, codes)
    expect(days.map((d) => d.date)).toEqual(["2026-03-01", "2026-03-02", "2026-03-03"])
    expect(days[1].lines.find((l) => l.roleId === "ops" && l.shift === "DAY")!.have).toBe(1)
  })
})
