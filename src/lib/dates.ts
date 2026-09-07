/**
 * Date-only values in the browser.
 *
 * The API stores calendar dates as UTC midnight and serialises them as
 * "2026-03-02T00:00:00.000Z". Feeding that to `new Date(str).toLocaleDateString()`
 * shows March 1 anywhere west of UTC (the default org timezone is
 * Newfoundland). Everything here treats the first ten characters as the
 * calendar date and never lets the browser's timezone shift it.
 *
 * Use these for anything that is a *date* (schedule days, hire dates,
 * holidays, time-off ranges). Real instants (check-in times, createdAt)
 * are fine to format with toLocaleString().
 */

export type DateInput = string | Date

/** "YYYY-MM-DD" from a date-only string, an ISO timestamp, or a Date (UTC parts). */
export function toDateKey(value: DateInput): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return value.slice(0, 10)
}

/** A local-time Date at midnight for the calendar date. Safe to call getDay()/getDate() on. */
export function parseDateOnly(value: DateInput): Date {
  const [y, m, d] = toDateKey(value).split("-").map(Number)
  return new Date(y, m - 1, d)
}

/** Today's calendar date in the browser's timezone as "YYYY-MM-DD". */
export function todayKey(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** Add days to a date key without touching timezones. */
export function addDaysKey(value: DateInput, days: number): string {
  const d = parseDateOnly(value)
  d.setDate(d.getDate() + days)
  return keyOf(d)
}

function keyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** Add calendar months (clamps to the last day of the target month). */
export function addMonthsKey(value: DateInput, months: number): string {
  const d = parseDateOnly(value)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDay))
  return keyOf(d)
}

export function monthStartKey(value: DateInput): string {
  const d = parseDateOnly(value)
  return keyOf(new Date(d.getFullYear(), d.getMonth(), 1))
}

export function monthEndKey(value: DateInput): string {
  const d = parseDateOnly(value)
  return keyOf(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

export type DateStyle = "short" | "medium" | "long" | "weekday"

const STYLES: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { month: "numeric", day: "numeric", year: "numeric" },
  medium: { month: "short", day: "numeric", year: "numeric" },
  long: { month: "long", day: "numeric", year: "numeric" },
  weekday: { weekday: "short", month: "short", day: "numeric" },
}

/** Format a date-only value for display. Never off by one. */
export function formatDateOnly(value: DateInput | null | undefined, style: DateStyle = "medium"): string {
  if (!value) return "—"
  return parseDateOnly(value).toLocaleDateString(undefined, STYLES[style])
}

/** "Mar 2 – Mar 6, 2026" style range. */
export function formatDateRange(start: DateInput, end: DateInput): string {
  const s = toDateKey(start)
  const e = toDateKey(end)
  if (s === e) return formatDateOnly(s)
  return `${parseDateOnly(s).toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${formatDateOnly(e)}`
}
