import { describe, it, expect } from "vitest"
import {
  generateRotationSchedule,
  generateFromAnchor,
  shiftTypeAt,
  phaseAt,
  timeOffTypeToShiftType,
  assertValidPattern,
  type RotationPattern,
  type RotationAnchor,
} from "../scheduling"
import { toUTCDate, daysDifference } from "../timezone"

const d = toUTCDate

const fourteenFourteen: RotationPattern = {
  daysOn: 14, daysOff: 14, includesNights: false, nightsAtStart: false, nightDays: 0,
}
const threeThreeNights: RotationPattern = {
  daysOn: 3, daysOff: 3, includesNights: true, nightsAtStart: true, nightDays: 2,
}
const twoTwoNightsAtEnd: RotationPattern = {
  daysOn: 2, daysOff: 2, includesNights: true, nightsAtStart: false, nightDays: 1,
}
const sevenSevenAlternating: RotationPattern = {
  daysOn: 7, daysOff: 7, includesNights: false, nightsAtStart: false, nightDays: 0, alternatesShifts: true,
}

/** Compact string of one letter per day: D, N, O */
function tape(schedules: { shiftType: string }[]): string {
  return schedules.map((s) => s.shiftType[0]).join("")
}

describe("timezone sanity", () => {
  it("runs the suite west of UTC so local-getter bugs surface", () => {
    expect(process.env.TZ).toBe("America/St_Johns")
    expect(new Date("2026-03-01T00:00:00Z").getDate()).toBe(28) // Feb 28 local
  })

  it("daysDifference uses UTC calendar days", () => {
    expect(daysDifference(d("2026-03-01"), d("2026-03-02"))).toBe(1)
    expect(daysDifference(d("2026-03-02"), d("2026-03-01"))).toBe(-1)
    // Across the March DST change
    expect(daysDifference(d("2026-03-07"), d("2026-03-09"))).toBe(2)
    expect(daysDifference(d("2026-01-01"), d("2026-12-31"))).toBe(364)
  })
})

describe("generateRotationSchedule — golden tables", () => {
  it("14/14 from phase 0: 14 days on, 14 off, inclusive end date", () => {
    const out = generateRotationSchedule(fourteenFourteen, d("2026-03-01"), d("2026-03-31"))
    expect(out).toHaveLength(31)
    expect(tape(out)).toBe("D".repeat(14) + "O".repeat(14) + "DDD")
    expect(out[0].date.toISOString()).toBe("2026-03-01T00:00:00.000Z")
    expect(out[30].date.toISOString()).toBe("2026-03-31T00:00:00.000Z")
  })

  it("covers a full year with exactly 365 rows", () => {
    const out = generateRotationSchedule(fourteenFourteen, d("2026-01-01"), d("2026-12-31"))
    expect(out).toHaveLength(365)
  })

  it("3/3 with two nights first: N N D O O O", () => {
    const out = generateRotationSchedule(threeThreeNights, d("2026-03-01"), d("2026-03-12"))
    expect(tape(out)).toBe("NNDOOO".repeat(2))
  })

  it("2/2 with one night at the end: D N O O", () => {
    const out = generateRotationSchedule(twoTwoNightsAtEnd, d("2026-03-01"), d("2026-03-08"))
    expect(tape(out)).toBe("DNOO".repeat(2))
  })

  it("startPhase shifts where in the cycle the start date falls", () => {
    // Phase 12 of a 14/14: two more working days, then 14 off
    const out = generateRotationSchedule(fourteenFourteen, d("2026-03-01"), d("2026-03-18"), 12)
    expect(tape(out)).toBe("DD" + "O".repeat(14) + "DD")
  })

  it("startPhase wraps modulo the cycle length", () => {
    const a = generateRotationSchedule(fourteenFourteen, d("2026-03-01"), d("2026-03-31"), 5)
    const b = generateRotationSchedule(fourteenFourteen, d("2026-03-01"), d("2026-03-31"), 5 + 28)
    expect(tape(a)).toBe(tape(b))
  })
})

describe("alternating shifts", () => {
  it("blocks alternate DAY, NIGHT, DAY from phase 0", () => {
    const out = generateRotationSchedule(sevenSevenAlternating, d("2026-03-01"), d("2026-04-11"))
    expect(tape(out)).toBe("DDDDDDD" + "OOOOOOO" + "NNNNNNN" + "OOOOOOO" + "DDDDDDD" + "OOOOOOO")
  })

  it("startingShift NIGHT makes the first block NIGHT", () => {
    const out = generateRotationSchedule(sevenSevenAlternating, d("2026-03-01"), d("2026-03-21"), 0, "NIGHT")
    expect(tape(out)).toBe("NNNNNNN" + "OOOOOOO" + "DDDDDDD")
  })

  it("startingShift describes the first WORKING block even when the start lands in an off block", () => {
    // Phase 10 of a 7/7: 4 more off days, then the first working block.
    // The old implementation flipped the shift when the off block wrapped,
    // producing NIGHT here despite startingShift = DAY.
    const out = generateRotationSchedule(sevenSevenAlternating, d("2026-03-01"), d("2026-03-25"), 10, "DAY")
    expect(tape(out)).toBe("OOOO" + "DDDDDDD" + "OOOOOOO" + "NNNNNNN")
  })
})

describe("anchoring", () => {
  const anchor: RotationAnchor = { anchorDate: d("2026-03-01"), anchorPhase: 0, anchorShift: "DAY" }

  it("phaseAt counts forward from the anchor", () => {
    expect(phaseAt(fourteenFourteen, anchor, d("2026-03-01"))).toBe(0)
    expect(phaseAt(fourteenFourteen, anchor, d("2026-03-15"))).toBe(14)
    expect(phaseAt(fourteenFourteen, anchor, d("2026-03-29"))).toBe(0)
  })

  it("phaseAt works for dates before the anchor", () => {
    expect(phaseAt(fourteenFourteen, anchor, d("2026-02-28"))).toBe(27)
    expect(phaseAt(fourteenFourteen, anchor, d("2026-02-01"))).toBe(0)
    expect(shiftTypeAt(fourteenFourteen, anchor, d("2026-02-28"))).toBe("OFF")
    expect(shiftTypeAt(fourteenFourteen, anchor, d("2026-02-14"))).toBe("DAY")
  })

  it("overlapping regenerations agree on every shared date (the C5 bug)", () => {
    const first = generateFromAnchor(fourteenFourteen, anchor, d("2026-03-01"), d("2026-05-31"))
    const second = generateFromAnchor(fourteenFourteen, anchor, d("2026-03-15"), d("2026-06-15"))
    const byDate = new Map(first.map((s) => [s.date.toISOString(), s.shiftType]))
    let compared = 0
    for (const s of second) {
      const prior = byDate.get(s.date.toISOString())
      if (prior !== undefined) {
        expect(s.shiftType).toBe(prior)
        compared++
      }
    }
    expect(compared).toBe(78) // Mar 15 .. May 31
  })

  it("overlapping regenerations agree for alternating patterns too", () => {
    const alt: RotationAnchor = { anchorDate: d("2026-03-01"), anchorPhase: 10, anchorShift: "DAY" }
    const first = generateFromAnchor(sevenSevenAlternating, alt, d("2026-03-01"), d("2026-04-30"))
    const second = generateFromAnchor(sevenSevenAlternating, alt, d("2026-04-01"), d("2026-05-31"))
    const byDate = new Map(first.map((s) => [s.date.toISOString(), s.shiftType]))
    for (const s of second) {
      const prior = byDate.get(s.date.toISOString())
      if (prior !== undefined) expect(s.shiftType).toBe(prior)
    }
  })

  it("an anchor expressed on a later date is equivalent to the original", () => {
    // Same rotation described from March 1 (phase 0) and from March 20 (phase 19)
    const later: RotationAnchor = { anchorDate: d("2026-03-20"), anchorPhase: 19, anchorShift: "DAY" }
    const a = generateFromAnchor(fourteenFourteen, anchor, d("2026-04-01"), d("2026-04-30"))
    const b = generateFromAnchor(fourteenFourteen, later, d("2026-04-01"), d("2026-04-30"))
    expect(tape(a)).toBe(tape(b))
  })

  it("four crews offset by a quarter cycle always have exactly one crew on shift", () => {
    // Classic 4-crew 7/7 style coverage with a 14-day cycle: A,B,C,D at phases 0,7,... would
    // overlap; use 3/3 pairs (6-day cycle) with offsets 0 and 3 for two crews.
    const pattern: RotationPattern = { daysOn: 3, daysOff: 3, includesNights: false, nightsAtStart: false, nightDays: 0 }
    const crewA: RotationAnchor = { anchorDate: d("2026-03-01"), anchorPhase: 0, anchorShift: "DAY" }
    const crewB: RotationAnchor = { anchorDate: d("2026-03-01"), anchorPhase: 3, anchorShift: "DAY" }
    for (let i = 0; i < 60; i++) {
      const date = new Date(Date.UTC(2026, 2, 1 + i))
      const a = shiftTypeAt(pattern, crewA, date)
      const b = shiftTypeAt(pattern, crewB, date)
      expect([a, b].filter((s) => s === "DAY")).toHaveLength(1)
    }
  })
})

describe("pattern validation", () => {
  it("rejects a pattern with no working days (would divide by zero)", () => {
    expect(() =>
      assertValidPattern({ daysOn: 0, daysOff: 0, includesNights: false, nightsAtStart: false, nightDays: 0 })
    ).toThrow(/working day/)
  })

  it("rejects more night days than working days", () => {
    expect(() =>
      assertValidPattern({ daysOn: 2, daysOff: 2, includesNights: true, nightsAtStart: true, nightDays: 3 })
    ).toThrow(/nightDays/)
  })
})

describe("timeOffTypeToShiftType", () => {
  it("maps vacation and sick to their own shift types, everything else to LEAVE", () => {
    expect(timeOffTypeToShiftType("VACATION")).toBe("VACATION")
    expect(timeOffTypeToShiftType("SICK")).toBe("SICK")
    expect(timeOffTypeToShiftType("PERSONAL")).toBe("LEAVE")
    expect(timeOffTypeToShiftType("BEREAVEMENT")).toBe("LEAVE")
    expect(timeOffTypeToShiftType("JURY_DUTY")).toBe("LEAVE")
    expect(timeOffTypeToShiftType("OTHER")).toBe("LEAVE")
  })
})
