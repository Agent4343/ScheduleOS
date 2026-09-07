import { ShiftType, TimeOffType } from "@prisma/client"
import { addDaysUTC, daysDifference, normalizeToUTCMidnight } from "./timezone"

/**
 * Rotation engine.
 *
 * A rotation pattern is a repeating cycle of `daysOn` working days followed by
 * `daysOff` days off. Where a worker is in that cycle on a given date is fixed
 * by an ANCHOR: a date, the phase (day-in-cycle, 0-based) on that date, and the
 * shift of the first working block on or after it. Everything else is derived,
 * so generating March–May and then April–June always agree on April.
 *
 * All dates are UTC-midnight `Date`s (see ./timezone).
 */

export interface RotationPattern {
  daysOn: number
  daysOff: number
  includesNights: boolean
  nightsAtStart: boolean
  nightDays: number
  /** When true, whole working blocks alternate DAY / NIGHT / DAY / … */
  alternatesShifts?: boolean
}

export type WorkingShift = "DAY" | "NIGHT"

export interface RotationAnchor {
  /** A date on which the phase is known. */
  anchorDate: Date
  /** Day-in-cycle on `anchorDate`, 0 = first working day. */
  anchorPhase: number
  /**
   * Shift worked by the first working block on or after `anchorDate`.
   * Only matters for patterns with `alternatesShifts`.
   */
  anchorShift: WorkingShift
}

export interface GeneratedSchedule {
  date: Date
  shiftType: ShiftType
}

/** Positive modulo: mod(-1, 28) === 27 */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

export function cycleLength(pattern: RotationPattern): number {
  return pattern.daysOn + pattern.daysOff
}

export function assertValidPattern(pattern: RotationPattern): void {
  if (!Number.isInteger(pattern.daysOn) || pattern.daysOn < 1) {
    throw new Error("Rotation pattern needs at least one working day")
  }
  if (!Number.isInteger(pattern.daysOff) || pattern.daysOff < 0) {
    throw new Error("Rotation pattern daysOff must be 0 or more")
  }
  if (pattern.includesNights && (pattern.nightDays < 0 || pattern.nightDays > pattern.daysOn)) {
    throw new Error("nightDays must be between 0 and daysOn")
  }
}

/**
 * Where a date sits relative to the anchor.
 *
 * `cycleIndex` counts working blocks from the one containing the anchor
 * (0 = the anchor's own cycle; negative for dates before it).
 */
export function positionInRotation(
  pattern: RotationPattern,
  anchor: RotationAnchor,
  date: Date
): { dayInCycle: number; cycleIndex: number } {
  const total = cycleLength(pattern)
  const anchorPhase = mod(anchor.anchorPhase, total)
  const absoluteDay =
    daysDifference(normalizeToUTCMidnight(anchor.anchorDate), normalizeToUTCMidnight(date)) +
    anchorPhase
  return {
    dayInCycle: mod(absoluteDay, total),
    cycleIndex: Math.floor(absoluteDay / total),
  }
}

/** Day-in-cycle (0-based) for a date. */
export function phaseAt(pattern: RotationPattern, anchor: RotationAnchor, date: Date): number {
  return positionInRotation(pattern, anchor, date).dayInCycle
}

/**
 * The shift a worker on this rotation has on `date`.
 */
export function shiftTypeAt(
  pattern: RotationPattern,
  anchor: RotationAnchor,
  date: Date
): ShiftType {
  const { dayInCycle, cycleIndex } = positionInRotation(pattern, anchor, date)

  if (dayInCycle >= pattern.daysOn) {
    return ShiftType.OFF
  }

  if (pattern.alternatesShifts) {
    // `anchorShift` describes the first WORKING block on or after the anchor.
    // If the anchor falls in an off block, that is the next cycle, not this one.
    const total = cycleLength(pattern)
    const anchorInOffBlock = mod(anchor.anchorPhase, total) >= pattern.daysOn
    const firstWorkingCycle = anchorInOffBlock ? 1 : 0
    const sameParity = mod(cycleIndex - firstWorkingCycle, 2) === 0
    const isDay = sameParity === (anchor.anchorShift === "DAY")
    return isDay ? ShiftType.DAY : ShiftType.NIGHT
  }

  if (pattern.includesNights) {
    if (pattern.nightsAtStart) {
      return dayInCycle < pattern.nightDays ? ShiftType.NIGHT : ShiftType.DAY
    }
    const dayShifts = pattern.daysOn - pattern.nightDays
    return dayInCycle < dayShifts ? ShiftType.DAY : ShiftType.NIGHT
  }

  return ShiftType.DAY
}

/**
 * Generate one entry per day from `startDate` to `endDate` inclusive,
 * derived from the anchor. Safe to call for any range, any number of times.
 */
export function generateFromAnchor(
  pattern: RotationPattern,
  anchor: RotationAnchor,
  startDate: Date,
  endDate: Date
): GeneratedSchedule[] {
  assertValidPattern(pattern)
  const schedules: GeneratedSchedule[] = []
  let current = normalizeToUTCMidnight(startDate)
  const end = normalizeToUTCMidnight(endDate)

  while (current <= end) {
    schedules.push({ date: current, shiftType: shiftTypeAt(pattern, anchor, current) })
    current = addDaysUTC(current, 1)
  }

  return schedules
}

/**
 * Generate a schedule where the rotation is anchored at `startDate` itself.
 *
 * @param startPhase - day-in-cycle on `startDate` (0 = first working day)
 * @param startingShift - shift of the first working block on or after `startDate`
 */
export function generateRotationSchedule(
  pattern: RotationPattern,
  startDate: Date,
  endDate: Date,
  startPhase: number = 0,
  startingShift: WorkingShift = "DAY"
): GeneratedSchedule[] {
  return generateFromAnchor(
    pattern,
    { anchorDate: startDate, anchorPhase: startPhase, anchorShift: startingShift },
    startDate,
    endDate
  )
}

/**
 * How an approved time-off request shows on the schedule.
 * Shared by the REST approval path and the AI assistant so they agree.
 */
export function timeOffTypeToShiftType(type: TimeOffType): ShiftType {
  switch (type) {
    case TimeOffType.VACATION:
      return ShiftType.VACATION
    case TimeOffType.SICK:
      return ShiftType.SICK
    default:
      // PERSONAL, BEREAVEMENT, JURY_DUTY, OTHER: distinguishable from a
      // rotation OFF day on the calendar.
      return ShiftType.LEAVE
  }
}
