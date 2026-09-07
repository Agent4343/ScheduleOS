import { describe, it, expect } from "vitest"
import {
  addDaysKey,
  addMonthsKey,
  formatDateOnly,
  formatDateRange,
  monthEndKey,
  monthStartKey,
  parseDateOnly,
  toDateKey,
} from "../dates"

// The suite runs with TZ=America/St_Johns (see setup.ts), which is exactly
// where `new Date("2026-03-02T00:00:00.000Z").toLocaleDateString()` shows March 1.

describe("browser date-only helpers", () => {
  it("toDateKey takes the calendar date from an API timestamp without shifting it", () => {
    expect(toDateKey("2026-03-02T00:00:00.000Z")).toBe("2026-03-02")
    expect(toDateKey("2026-03-02")).toBe("2026-03-02")
    expect(toDateKey(new Date("2026-03-02T00:00:00.000Z"))).toBe("2026-03-02")
  })

  it("parseDateOnly gives a local date whose getters match the calendar date", () => {
    const d = parseDateOnly("2026-03-02T00:00:00.000Z")
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(2)
    expect(d.getDate()).toBe(2)
    expect(d.getDay()).toBe(1) // Monday
    // The naive version is wrong here
    expect(new Date("2026-03-02T00:00:00.000Z").getDate()).toBe(1)
  })

  it("formatDateOnly never shows the previous day", () => {
    expect(formatDateOnly("2026-03-02T00:00:00.000Z", "short")).toMatch(/3\/2\/2026|2026-03-02|02\/03\/2026/)
    expect(formatDateOnly(null)).toBe("—")
  })

  it("formatDateRange collapses a single-day range", () => {
    expect(formatDateRange("2026-03-02", "2026-03-02")).toBe(formatDateOnly("2026-03-02"))
    expect(formatDateRange("2026-03-02", "2026-03-06")).toContain("–")
  })

  it("adds days and months as calendar arithmetic", () => {
    expect(addDaysKey("2026-02-28", 1)).toBe("2026-03-01")
    expect(addDaysKey("2026-03-08", 1)).toBe("2026-03-09") // across DST
    expect(addMonthsKey("2026-01-31", 1)).toBe("2026-02-28") // clamps
    expect(addMonthsKey("2026-03-15", 3)).toBe("2026-06-15")
    expect(monthStartKey("2026-03-15")).toBe("2026-03-01")
    expect(monthEndKey("2026-02-10")).toBe("2026-02-28")
  })
})
