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

// --- Sign-offs: one person can only do one job ---------------------------

import { matchSignOffs, type CoverageRequirementDef } from "../services/coverage"

const opsReqs: CoverageRequirementDef[] = [
  { coverageRoleId: "ops", code: "UTIL", name: "Utilities Operator", countDay: 1, countNight: 1 },
  { coverageRoleId: "ops", code: "OIL", name: "Oil Operator", countDay: 1, countNight: 1 },
  { coverageRoleId: "ops", code: "GAS", name: "Gas Operator", countDay: 1, countNight: 1 },
]

const signOff = (day: ReturnType<typeof evaluateCoverageDay>, role: string, shift: "DAY" | "NIGHT", code: string) =>
  line(day, role, shift).signOffs.find((s) => s.code === code)!

describe("matchSignOffs", () => {
  it("gives each slot a different person", () => {
    const people = [{ qualifications: ["UTIL", "OIL"] }, { qualifications: ["OIL"] }]
    const result = matchSignOffs(["UTIL", "OIL"], people)
    expect(result).toEqual([0, 1])
  })

  it("reshuffles an earlier assignment to fit a later slot", () => {
    // The only GAS holder also holds OIL and gets taken by OIL first;
    // the algorithm must move them and give OIL to somebody else.
    const people = [{ qualifications: ["OIL", "GAS"] }, { qualifications: ["OIL"] }]
    const result = matchSignOffs(["OIL", "GAS"], people)
    expect(result[1]).toBe(0)
    expect(result[0]).toBe(1)
  })

  it("leaves a slot unfilled when nobody is left to fill it", () => {
    const people = [{ qualifications: ["OIL", "GAS"] }]
    expect(matchSignOffs(["OIL", "GAS"], people)).toEqual([0, null])
  })
})

describe("sign-off requirements on a line", () => {
  it("passes when three different operators hold the three sign-offs", () => {
    const day = evaluateCoverageDay(
      D,
      [
        row("DAY", "g-tech", null, ["UTIL"]),
        row("DAY", "g-tech", null, ["OIL"]),
        row("DAY", "g-tech", null, ["GAS"]),
      ],
      roles, groups, codes, opsReqs
    )
    const l = line(day, "ops", "DAY")
    expect(l.signOffShortfall).toBe(false)
    expect(l.signOffs.map((s) => s.filled)).toEqual([1, 1, 1])
    // Each person is used exactly once
    const used = l.signOffs.flatMap((s) => s.by.map((b) => b.userId))
    expect(new Set(used).size).toBe(3)
  })

  it("fails when one person holds two sign-offs and nobody else covers them", () => {
    const day = evaluateCoverageDay(
      D,
      [
        row("DAY", "g-tech", null, ["OIL", "GAS"]),
        row("DAY", "g-tech", null, ["UTIL"]),
        row("DAY", "g-tech", null, []),
      ],
      roles, groups, codes, opsReqs
    )
    const l = line(day, "ops", "DAY")
    // Headcount is fine — three bodies, minimum three
    expect(l.have).toBe(3)
    // …but oil and gas cannot both be covered by the same person
    expect(l.signOffShortfall).toBe(true)
    expect(l.status).toBe("red")
    expect(signOff(day, "ops", "DAY", "OIL").filled + signOff(day, "ops", "DAY", "GAS").filled).toBe(1)
  })

  it("a full crew is still short if a sign-off is missing entirely", () => {
    const day = evaluateCoverageDay(
      D,
      [
        row("DAY", "g-tech", null, ["UTIL"]),
        row("DAY", "g-tech", null, ["OIL"]),
        row("DAY", "g-tech", null, ["OIL"]),
        row("DAY", "g-tech", null, ["OIL"]),
      ],
      roles, groups, codes, opsReqs
    )
    const l = line(day, "ops", "DAY")
    expect(l.have).toBe(4) // at target
    expect(signOff(day, "ops", "DAY", "GAS")).toMatchObject({ need: 1, filled: 0 })
    expect(l.status).toBe("red")
  })

  it("does not count someone who moved to the control room on a duty code", () => {
    // The gas operator is on CCR-D, so they are not an outside op that shift
    const day = evaluateCoverageDay(
      D,
      [
        row("CUSTOM", "g-tech", "CCR-D", ["GAS"]),
        row("DAY", "g-tech", null, ["UTIL"]),
        row("DAY", "g-tech", null, ["OIL"]),
      ],
      roles, groups, codes, opsReqs
    )
    expect(signOff(day, "ops", "DAY", "GAS").filled).toBe(0)
    expect(line(day, "ops", "DAY").signOffShortfall).toBe(true)
  })

  it("reports no sign-offs for roles that have no requirements", () => {
    const day = evaluateCoverageDay(D, [row("DAY", "g-ocr", null, [])], roles, groups, codes, opsReqs)
    expect(line(day, "ocr", "DAY").signOffs).toEqual([])
    expect(line(day, "ocr", "DAY").signOffShortfall).toBe(false)
  })
})
