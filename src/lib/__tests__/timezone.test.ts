import { describe, it, expect } from "vitest"
import {
  businessDateInTimeZone,
  getTodayUTC,
  isValidTimeZone,
  normalizeToUTCMidnight,
  toUTCDate,
} from "../timezone"

const iso = (d: Date) => d.toISOString()

describe("businessDateInTimeZone", () => {
  // Newfoundland is UTC-3:30 in winter (NST) and UTC-2:30 in summer (NDT)
  it("keeps an evening Newfoundland check-in on its own calendar day even though UTC has rolled over", () => {
    // 21:00 NST on March 2 == 00:30 UTC March 3
    const instant = new Date("2026-03-03T00:30:00Z")
    expect(iso(businessDateInTimeZone(instant, "America/St_Johns"))).toBe("2026-03-02T00:00:00.000Z")
  })

  it("puts the next morning's check-out on the next day", () => {
    // 07:00 NST March 3 == 10:30 UTC March 3
    const instant = new Date("2026-03-03T10:30:00Z")
    expect(iso(businessDateInTimeZone(instant, "America/St_Johns"))).toBe("2026-03-03T00:00:00.000Z")
  })

  it("handles daylight time (NDT, UTC-2:30)", () => {
    // 22:00 NDT July 10 == 00:30 UTC July 11
    const instant = new Date("2026-07-11T00:30:00Z")
    expect(iso(businessDateInTimeZone(instant, "America/St_Johns"))).toBe("2026-07-10T00:00:00.000Z")
  })

  it("works east of UTC", () => {
    // 05:00 JST March 3 == 20:00 UTC March 2
    const instant = new Date("2026-03-02T20:00:00Z")
    expect(iso(businessDateInTimeZone(instant, "Asia/Tokyo"))).toBe("2026-03-03T00:00:00.000Z")
    expect(iso(businessDateInTimeZone(instant, "UTC"))).toBe("2026-03-02T00:00:00.000Z")
  })

  it("falls back to UTC for an unknown timezone", () => {
    const instant = new Date("2026-03-03T00:30:00Z")
    expect(iso(businessDateInTimeZone(instant, "Mars/Olympus_Mons"))).toBe("2026-03-03T00:00:00.000Z")
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false)
    expect(isValidTimeZone("America/St_Johns")).toBe(true)
  })

  it("returns a UTC-midnight Date suitable for a DATE column", () => {
    const out = businessDateInTimeZone(new Date("2026-03-03T00:30:00Z"), "America/St_Johns")
    expect(out.getUTCHours()).toBe(0)
    expect(out.getTime()).toBe(normalizeToUTCMidnight(out).getTime())
    expect(out.getTime()).toBe(toUTCDate("2026-03-02").getTime())
  })
})

describe("getTodayUTC", () => {
  it("is the UTC calendar date regardless of the process timezone", () => {
    const today = getTodayUTC()
    expect(today.toISOString().slice(11)).toBe("00:00:00.000Z")
    expect(today.toISOString().slice(0, 10)).toBe(new Date().toISOString().slice(0, 10))
  })
})
