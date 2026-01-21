/**
 * Timezone utilities for consistent date handling across the scheduling app.
 *
 * IMPORTANT: All dates in the database should be stored as UTC midnight.
 * This ensures consistent behavior regardless of server timezone.
 */

/**
 * Convert a date string (YYYY-MM-DD) to a UTC midnight Date object.
 * This is the standard format for storing schedule dates.
 */
export function toUTCDate(dateString: string): Date {
  // Parse as UTC to avoid timezone issues
  const [year, month, day] = dateString.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
}

/**
 * Convert a Date object to a date string (YYYY-MM-DD) in UTC.
 */
export function toDateString(date: Date): string {
  return date.toISOString().split("T")[0]
}

/**
 * Get today's date as a UTC midnight Date object.
 */
export function getTodayUTC(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0))
}

/**
 * Get today's date as a string (YYYY-MM-DD).
 */
export function getTodayString(): string {
  return toDateString(new Date())
}

/**
 * Compare two dates (ignoring time).
 * Returns true if they represent the same calendar day in UTC.
 */
export function isSameDayUTC(date1: Date, date2: Date): boolean {
  return toDateString(date1) === toDateString(date2)
}

/**
 * Add days to a date, maintaining UTC midnight.
 */
export function addDaysUTC(date: Date, days: number): Date {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

/**
 * Normalize a Date object to UTC midnight.
 * This ensures consistent date storage regardless of the input time.
 */
export function normalizeToUTCMidnight(date: Date): Date {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0, 0, 0, 0
  ))
}

/**
 * Get the start of a year in UTC.
 */
export function getYearStartUTC(year: number): Date {
  return new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0))
}

/**
 * Get the end of a year in UTC.
 */
export function getYearEndUTC(year: number): Date {
  return new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))
}

/**
 * Calculate the difference in days between two dates.
 */
export function daysDifference(date1: Date, date2: Date): number {
  const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate())
  const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate())
  return Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24))
}

/**
 * Format a date for display in the user's locale.
 * Note: This should only be used for display purposes.
 */
export function formatDisplayDate(
  date: Date,
  options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  }
): string {
  return date.toLocaleDateString("en-US", options)
}

/**
 * Get all dates in a range (inclusive).
 */
export function getDateRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = []
  let current = new Date(startDate)

  while (current <= endDate) {
    dates.push(new Date(current))
    current = addDaysUTC(current, 1)
  }

  return dates
}

/**
 * Get the start of the week (Sunday) in UTC.
 */
export function startOfWeekUTC(date: Date): Date {
  const utcDate = normalizeToUTCMidnight(date)
  const day = utcDate.getUTCDay()
  return addDaysUTC(utcDate, -day)
}

/**
 * Get the end of the week (Saturday) in UTC at midnight.
 * Note: Returns midnight of Saturday (start of day) for consistent date-only comparisons.
 */
export function endOfWeekUTC(date: Date): Date {
  const utcDate = normalizeToUTCMidnight(date)
  const day = utcDate.getUTCDay()
  return addDaysUTC(utcDate, 6 - day)
}
