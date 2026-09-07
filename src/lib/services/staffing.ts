import { PositionType, ShiftType, type UserRole } from "@prisma/client"
import { prisma } from "../prisma"
import { addDaysUTC, normalizeToUTCMidnight, toDateString } from "../timezone"

/**
 * Staffing evaluation: compare who is scheduled against the minimums.
 *
 * `evaluateStaffing` is pure so it can be unit-tested; the dashboard and the
 * assistant both call `findStaffingGaps`, which loads the data and delegates.
 */

export interface StaffingRuleLike {
  id?: string
  name?: string
  shiftType: ShiftType
  minWorkers: number
  positionType?: PositionType | null
  role?: UserRole | null
  crewId?: string | null
}

export interface ScheduledWorker {
  date: Date
  shiftType: ShiftType
  user: { positionType: PositionType; role?: UserRole; crewId?: string | null }
}

export interface PositionMinimums {
  /** Minimum OPERATORs on each DAY and NIGHT shift. Unset means no minimum. */
  minStaffOperators?: number
  /** Minimum ONSHORE_CONTROL_ROOM staff on each DAY and NIGHT shift. */
  minStaffOnshoreControlRoom?: number
}

export interface StaffingGap {
  date: Date
  shiftType: ShiftType
  have: number
  need: number
  shortage: number
  positionType?: PositionType
  crewId?: string
  ruleName?: string
}

/**
 * Evaluate one calendar day. `daySchedules` must all be on `date`.
 *
 * A rule applies only to the schedules matching every filter it sets
 * (shiftType, positionType, role, crewId). Position minimums from the
 * organization settings apply to every DAY and NIGHT shift and are skipped
 * where a rule already covers the same shift + position (no double counting).
 */
export function evaluateStaffingForDay(
  date: Date,
  daySchedules: ScheduledWorker[],
  rules: StaffingRuleLike[],
  minimums: PositionMinimums = {}
): StaffingGap[] {
  const gaps: StaffingGap[] = []

  for (const rule of rules) {
    const matching = daySchedules.filter(
      (s) =>
        s.shiftType === rule.shiftType &&
        (!rule.positionType || s.user.positionType === rule.positionType) &&
        (!rule.role || s.user.role === rule.role) &&
        (!rule.crewId || s.user.crewId === rule.crewId)
    )
    if (matching.length < rule.minWorkers) {
      gaps.push({
        date,
        shiftType: rule.shiftType,
        have: matching.length,
        need: rule.minWorkers,
        shortage: rule.minWorkers - matching.length,
        positionType: rule.positionType ?? undefined,
        crewId: rule.crewId ?? undefined,
        ruleName: rule.name,
      })
    }
  }

  const positionMinimums: Array<[PositionType, number | undefined]> = [
    [PositionType.OPERATOR, minimums.minStaffOperators],
    [PositionType.ONSHORE_CONTROL_ROOM, minimums.minStaffOnshoreControlRoom],
  ]

  for (const shiftType of [ShiftType.DAY, ShiftType.NIGHT]) {
    for (const [positionType, min] of positionMinimums) {
      if (!min || min <= 0) continue
      const coveredByRule = gaps.some(
        (g) => g.shiftType === shiftType && g.positionType === positionType && !g.crewId
      ) || rules.some((r) => r.shiftType === shiftType && r.positionType === positionType && !r.crewId)
      if (coveredByRule) continue

      const have = daySchedules.filter(
        (s) => s.shiftType === shiftType && s.user.positionType === positionType
      ).length
      if (have < min) {
        gaps.push({ date, shiftType, have, need: min, shortage: min - have, positionType })
      }
    }
  }

  return gaps
}

/** Evaluate every day in [startDate, endDate]. */
export function evaluateStaffing(
  startDate: Date,
  endDate: Date,
  schedules: ScheduledWorker[],
  rules: StaffingRuleLike[],
  minimums: PositionMinimums = {}
): StaffingGap[] {
  const byDate = new Map<string, ScheduledWorker[]>()
  for (const s of schedules) {
    const key = toDateString(s.date)
    const list = byDate.get(key)
    if (list) list.push(s)
    else byDate.set(key, [s])
  }

  const gaps: StaffingGap[] = []
  const end = normalizeToUTCMidnight(endDate)
  for (let d = normalizeToUTCMidnight(startDate); d <= end; d = addDaysUTC(d, 1)) {
    gaps.push(...evaluateStaffingForDay(d, byDate.get(toDateString(d)) ?? [], rules, minimums))
  }
  return gaps
}

/** Load rules, settings and schedules for an organization and evaluate them. */
export async function findStaffingGaps(organizationId: string, startDate: Date, endDate: Date) {
  const [rules, organization, schedules] = await Promise.all([
    prisma.staffingRule.findMany({ where: { organizationId, isActive: true } }),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { settings: true } }),
    prisma.schedule.findMany({
      where: {
        user: { organizationId },
        date: { gte: normalizeToUTCMidnight(startDate), lte: normalizeToUTCMidnight(endDate) },
        shiftType: { in: [ShiftType.DAY, ShiftType.NIGHT] },
      },
      select: {
        date: true,
        shiftType: true,
        user: { select: { positionType: true, role: true, crewId: true } },
      },
    }),
  ])

  const settings = (organization?.settings ?? {}) as PositionMinimums & { minStaffingAlertEnabled?: boolean }
  const minimums: PositionMinimums = {
    minStaffOperators: typeof settings.minStaffOperators === "number" ? settings.minStaffOperators : undefined,
    minStaffOnshoreControlRoom:
      typeof settings.minStaffOnshoreControlRoom === "number" ? settings.minStaffOnshoreControlRoom : undefined,
  }

  return {
    rules,
    alertsEnabled: settings.minStaffingAlertEnabled !== false,
    gaps: evaluateStaffing(startDate, endDate, schedules, rules, minimums),
  }
}
