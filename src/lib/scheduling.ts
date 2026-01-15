import { ShiftType } from "@prisma/client"
import { addDays, isSameDay } from "./utils"

export interface RotationPattern {
  daysOn: number
  daysOff: number
  includesNights: boolean
  nightsAtStart: boolean
  nightDays: number
}

export interface GeneratedSchedule {
  date: Date
  shiftType: ShiftType
}

/**
 * Generate a schedule for a worker based on a rotation pattern
 *
 * @param pattern - The rotation pattern configuration
 * @param startDate - The start date for schedule generation
 * @param endDate - The end date for schedule generation
 * @param startPhase - The starting phase offset (0 = beginning of rotation)
 * @param startOnNights - If true, first rotation is nights, then alternates
 * @returns Array of generated schedules
 */
export function generateRotationSchedule(
  pattern: RotationPattern,
  startDate: Date,
  endDate: Date,
  startPhase: number = 0,
  startOnNights: boolean = false
): GeneratedSchedule[] {
  const schedules: GeneratedSchedule[] = []
  const totalCycleDays = pattern.daysOn + pattern.daysOff

  let currentDate = new Date(startDate)
  let dayInCycle = startPhase % totalCycleDays
  let rotationCount = 0 // Track which rotation we're in

  while (currentDate <= endDate) {
    let shiftType: ShiftType

    if (dayInCycle < pattern.daysOn) {
      // Working days - determine if this rotation is days or nights
      if (pattern.includesNights) {
        // Alternating full rotations: entire rotation is days OR nights
        const isNightRotation = startOnNights ? (rotationCount % 2 === 0) : (rotationCount % 2 === 1)
        shiftType = isNightRotation ? ShiftType.NIGHT : ShiftType.DAY
      } else {
        // No nights in pattern, just use DAY
        shiftType = ShiftType.DAY
      }
    } else {
      // Off days
      shiftType = ShiftType.OFF
    }

    schedules.push({
      date: new Date(currentDate),
      shiftType,
    })

    currentDate = addDays(currentDate, 1)
    const prevDayInCycle = dayInCycle
    dayInCycle = (dayInCycle + 1) % totalCycleDays

    // Track when we complete a full cycle (rotation)
    if (dayInCycle === 0 || (prevDayInCycle >= pattern.daysOn && dayInCycle < pattern.daysOn)) {
      rotationCount++
    }
  }

  return schedules
}

/**
 * Calculate the current phase in a rotation pattern for a given date
 *
 * @param rotationStartDate - When the rotation cycle began
 * @param targetDate - The date to calculate the phase for
 * @param pattern - The rotation pattern
 * @returns The current phase (day in cycle)
 */
export function calculateCurrentPhase(
  rotationStartDate: Date,
  targetDate: Date,
  pattern: RotationPattern
): number {
  const totalCycleDays = pattern.daysOn + pattern.daysOff
  const daysDiff = Math.floor(
    (targetDate.getTime() - rotationStartDate.getTime()) / (1000 * 60 * 60 * 24)
  )
  return ((daysDiff % totalCycleDays) + totalCycleDays) % totalCycleDays
}

/**
 * Get the crew offset for synchronized crew rotations
 * This ensures crews alternate their on/off cycles
 *
 * @param crewIndex - The index of the crew (0, 1, 2, 3 for A, B, C, D)
 * @param pattern - The rotation pattern
 * @returns The phase offset for this crew
 */
export function getCrewPhaseOffset(
  crewIndex: number,
  pattern: RotationPattern
): number {
  const totalCycleDays = pattern.daysOn + pattern.daysOff
  // Offset each crew by a fraction of the total cycle
  return Math.floor((crewIndex * totalCycleDays) / 2) % totalCycleDays
}

/**
 * Standard rotation patterns
 */
export const standardPatterns: Record<string, RotationPattern> = {
  "3on3off": {
    daysOn: 3,
    daysOff: 3,
    includesNights: false,
    nightsAtStart: false,
    nightDays: 0,
  },
  "3on3off-nights": {
    daysOn: 3,
    daysOff: 3,
    includesNights: true,
    nightsAtStart: true,
    nightDays: 2,
  },
  "2on2off": {
    daysOn: 2,
    daysOff: 2,
    includesNights: false,
    nightsAtStart: false,
    nightDays: 0,
  },
  "2on2off-nights": {
    daysOn: 2,
    daysOff: 2,
    includesNights: true,
    nightsAtStart: true,
    nightDays: 1,
  },
  "7on7off": {
    daysOn: 7,
    daysOff: 7,
    includesNights: false,
    nightsAtStart: false,
    nightDays: 0,
  },
  "14on14off": {
    daysOn: 14,
    daysOff: 14,
    includesNights: false,
    nightsAtStart: false,
    nightDays: 0,
  },
  "14on14off-nights": {
    daysOn: 14,
    daysOff: 14,
    includesNights: true,
    nightsAtStart: true,
    nightDays: 7,
  },
  "21on21off": {
    daysOn: 21,
    daysOff: 21,
    includesNights: false,
    nightsAtStart: false,
    nightDays: 0,
  },
}

/**
 * Calculate staffing levels for a given date
 */
export interface StaffingLevel {
  date: Date
  dayShift: number
  nightShift: number
  total: number
}

export function calculateStaffingLevels(
  schedules: Array<{ date: Date; shiftType: ShiftType }>,
  startDate: Date,
  endDate: Date
): StaffingLevel[] {
  const levels: StaffingLevel[] = []
  let currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    const daySchedules = schedules.filter(s => isSameDay(s.date, currentDate))

    const dayShift = daySchedules.filter(s => s.shiftType === ShiftType.DAY).length
    const nightShift = daySchedules.filter(s => s.shiftType === ShiftType.NIGHT).length

    levels.push({
      date: new Date(currentDate),
      dayShift,
      nightShift,
      total: dayShift + nightShift,
    })

    currentDate = addDays(currentDate, 1)
  }

  return levels
}

/**
 * Check for staffing gaps against minimum requirements
 */
export interface StaffingGap {
  date: Date
  shiftType: "DAY" | "NIGHT"
  required: number
  actual: number
  shortage: number
}

export function findStaffingGaps(
  levels: StaffingLevel[],
  minDayStaff: number,
  minNightStaff: number
): StaffingGap[] {
  const gaps: StaffingGap[] = []

  for (const level of levels) {
    if (level.dayShift < minDayStaff) {
      gaps.push({
        date: level.date,
        shiftType: "DAY",
        required: minDayStaff,
        actual: level.dayShift,
        shortage: minDayStaff - level.dayShift,
      })
    }

    if (level.nightShift < minNightStaff) {
      gaps.push({
        date: level.date,
        shiftType: "NIGHT",
        required: minNightStaff,
        actual: level.nightShift,
        shortage: minNightStaff - level.nightShift,
      })
    }
  }

  return gaps
}

/**
 * Calculate onboarding date for a new worker to sync with their crew
 */
export function calculateOnboardingSync(
  crewCurrentPhase: number,
  pattern: RotationPattern,
  targetStartDate: Date
): { syncedStartDate: Date; adjustmentDays: number } {
  const totalCycleDays = pattern.daysOn + pattern.daysOff

  // Find the next day 0 (start of work cycle) from target date
  const daysUntilCycleStart = (totalCycleDays - crewCurrentPhase) % totalCycleDays

  const syncedStartDate = addDays(targetStartDate, daysUntilCycleStart)

  return {
    syncedStartDate,
    adjustmentDays: daysUntilCycleStart,
  }
}

/**
 * Apply shutdown period to schedules
 */
export function applyShutdown(
  schedules: GeneratedSchedule[],
  shutdownStart: Date,
  shutdownEnd: Date
): GeneratedSchedule[] {
  return schedules.map(schedule => {
    if (schedule.date >= shutdownStart && schedule.date <= shutdownEnd) {
      return {
        ...schedule,
        shiftType: ShiftType.SHUTDOWN,
      }
    }
    return schedule
  })
}
