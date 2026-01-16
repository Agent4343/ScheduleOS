import { POSITION_COLORS } from "./schedule-constants"

/**
 * Get all days in a year as an array of Date objects
 */
export function getDaysInYear(year: number): Date[] {
  const days: Date[] = []
  const date = new Date(year, 0, 1)
  while (date.getFullYear() === year) {
    days.push(new Date(date))
    date.setDate(date.getDate() + 1)
  }
  return days
}

/**
 * Get month name abbreviation (e.g., "Jan", "Feb")
 */
export function getMonthName(month: number): string {
  return new Date(2024, month, 1).toLocaleDateString("en-US", { month: "short" })
}

/**
 * Get position color class for a worker's position
 */
export function getPositionColor(position: string | null): string {
  if (!position) return POSITION_COLORS.default

  // Check for exact match first
  if (POSITION_COLORS[position]) return POSITION_COLORS[position]

  // Check for partial match
  for (const [key, value] of Object.entries(POSITION_COLORS)) {
    if (position.toLowerCase().includes(key.toLowerCase())) {
      return value
    }
  }

  return POSITION_COLORS.default
}

/**
 * Format a Date to YYYY-MM-DD string (local date, no timezone issues)
 */
export function formatDateKey(day: Date): string {
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
}

/**
 * Group days by month for calendar header display
 */
export function groupDaysByMonth(yearDays: Date[]): { month: number; days: Date[] }[] {
  const groups: { month: number; days: Date[] }[] = []
  let currentMonth = -1
  let currentGroup: Date[] = []

  for (const day of yearDays) {
    if (day.getMonth() !== currentMonth) {
      if (currentGroup.length > 0) {
        groups.push({ month: currentMonth, days: currentGroup })
      }
      currentMonth = day.getMonth()
      currentGroup = []
    }
    currentGroup.push(day)
  }
  if (currentGroup.length > 0) {
    groups.push({ month: currentMonth, days: currentGroup })
  }

  return groups
}
