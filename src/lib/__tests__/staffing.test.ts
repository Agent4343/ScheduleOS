import { describe, it, expect, vi } from "vitest"

// Pure evaluation only; the module also exports a DB-backed loader.
vi.mock("../prisma", () => ({ prisma: {} }))

import { evaluateStaffing, evaluateStaffingForDay, type ScheduledWorker } from "../services/staffing"
import { toUTCDate } from "../timezone"

const d = toUTCDate
const on = (
  date: string,
  shiftType: "DAY" | "NIGHT",
  positionType: "OPERATOR" | "ONSHORE_CONTROL_ROOM" | "OTHER" = "OTHER",
  crewId?: string,
  role: "ADMIN" | "SUPERVISOR" | "WORKER" = "WORKER"
): ScheduledWorker => ({ date: d(date), shiftType, user: { positionType, crewId, role } })

describe("evaluateStaffingForDay", () => {
  it("flags a shift below a plain minimum", () => {
    const gaps = evaluateStaffingForDay(
      d("2026-03-02"),
      [on("2026-03-02", "DAY"), on("2026-03-02", "DAY")],
      [{ name: "Day min", shiftType: "DAY", minWorkers: 3 }]
    )
    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toMatchObject({ shiftType: "DAY", have: 2, need: 3, shortage: 1, ruleName: "Day min" })
  })

  it("does not flag a shift that meets the minimum", () => {
    const gaps = evaluateStaffingForDay(
      d("2026-03-02"),
      [on("2026-03-02", "DAY"), on("2026-03-02", "DAY"), on("2026-03-02", "DAY")],
      [{ shiftType: "DAY", minWorkers: 3 }]
    )
    expect(gaps).toHaveLength(0)
  })

  it("a crew-scoped rule only counts that crew (review H8)", () => {
    const schedules = [on("2026-03-02", "NIGHT", "OTHER", "crewA"), on("2026-03-02", "NIGHT", "OTHER", "crewB")]
    const gaps = evaluateStaffingForDay(d("2026-03-02"), schedules, [
      { name: "Crew A nights", shiftType: "NIGHT", minWorkers: 2, crewId: "crewA" },
    ])
    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toMatchObject({ have: 1, need: 2, crewId: "crewA" })
  })

  it("a position-scoped rule only counts that position", () => {
    const schedules = [on("2026-03-02", "DAY", "OPERATOR"), on("2026-03-02", "DAY", "OTHER")]
    const gaps = evaluateStaffingForDay(d("2026-03-02"), schedules, [
      { shiftType: "DAY", minWorkers: 2, positionType: "OPERATOR" },
    ])
    expect(gaps[0]).toMatchObject({ have: 1, positionType: "OPERATOR" })
  })

  it("a role-scoped rule only counts that role", () => {
    const schedules = [on("2026-03-02", "DAY", "OTHER", undefined, "SUPERVISOR"), on("2026-03-02", "DAY")]
    const gaps = evaluateStaffingForDay(d("2026-03-02"), schedules, [
      { shiftType: "DAY", minWorkers: 2, role: "SUPERVISOR" },
    ])
    expect(gaps[0]).toMatchObject({ have: 1 })
  })

  it("position minimums from settings apply to DAY and NIGHT", () => {
    const schedules = [on("2026-03-02", "DAY", "OPERATOR")]
    const gaps = evaluateStaffingForDay(d("2026-03-02"), schedules, [], { minStaffOperators: 1 })
    // DAY has one operator (ok); NIGHT has none
    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toMatchObject({ shiftType: "NIGHT", positionType: "OPERATOR", have: 0, need: 1 })
  })

  it("no false gaps when position minimums are unset (review H8)", () => {
    const gaps = evaluateStaffingForDay(d("2026-03-02"), [on("2026-03-02", "DAY")], [])
    expect(gaps).toHaveLength(0)
  })

  it("does not double count when a rule already covers a position on a shift", () => {
    const gaps = evaluateStaffingForDay(
      d("2026-03-02"),
      [],
      [{ name: "Ops day", shiftType: "DAY", minWorkers: 2, positionType: "OPERATOR" }],
      { minStaffOperators: 1 }
    )
    const dayOperatorGaps = gaps.filter((g) => g.shiftType === "DAY" && g.positionType === "OPERATOR")
    expect(dayOperatorGaps).toHaveLength(1)
    expect(dayOperatorGaps[0].ruleName).toBe("Ops day")
    // NIGHT is still covered by the settings minimum
    expect(gaps.some((g) => g.shiftType === "NIGHT" && g.positionType === "OPERATOR")).toBe(true)
  })
})

describe("evaluateStaffing over a range", () => {
  it("evaluates every day in the range, including days with no schedules", () => {
    const schedules = [on("2026-03-02", "DAY"), on("2026-03-02", "DAY")]
    const gaps = evaluateStaffing(d("2026-03-01"), d("2026-03-03"), schedules, [{ shiftType: "DAY", minWorkers: 2 }])
    expect(gaps.map((g) => g.date.toISOString().slice(0, 10))).toEqual(["2026-03-01", "2026-03-03"])
  })
})
