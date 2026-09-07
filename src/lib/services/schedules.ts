import { Prisma, type ShiftType } from "@prisma/client"
import { prisma } from "../prisma"
import { logAudit, AuditAction } from "../audit-log"
import { addDaysUTC, normalizeToUTCMidnight } from "../timezone"
import { ServiceError, notFound } from "./errors"

/**
 * Schedule edits made by a person (or the assistant on their behalf).
 *
 * Every write here sets `isOverride: true`, which is what protects the row
 * from the next rotation regeneration. Rotation-generated rows are written
 * only by POST /api/schedules (generateSchedules).
 */

export interface Actor {
  organizationId: string
  userId: string
  ipAddress?: string
}

async function requireWorkerInOrg(organizationId: string, userId: string) {
  const worker = await prisma.user.findFirst({
    where: { id: userId, organizationId },
    select: { id: true, name: true, email: true, crewId: true },
  })
  if (!worker) throw notFound("Worker")
  return worker
}

export interface SetShiftInput {
  userId: string
  date: Date
  shiftType: ShiftType
  customShiftCode?: string | null
  reason?: string | null
  notes?: string | null
}

/** Set one worker's shift on one date. */
export async function setShiftOverride(actor: Actor, input: SetShiftInput) {
  const worker = await requireWorkerInOrg(actor.organizationId, input.userId)
  const date = normalizeToUTCMidnight(input.date)

  const schedule = await prisma.schedule.upsert({
    where: { userId_date: { userId: worker.id, date } },
    update: {
      shiftType: input.shiftType,
      customShiftCode: input.customShiftCode ?? null,
      isOverride: true,
      overrideReason: input.reason ?? null,
      notes: input.notes ?? null,
      crewId: worker.crewId,
    },
    create: {
      userId: worker.id,
      date,
      shiftType: input.shiftType,
      customShiftCode: input.customShiftCode ?? null,
      isOverride: true,
      overrideReason: input.reason ?? null,
      notes: input.notes ?? null,
      crewId: worker.crewId,
    },
    include: { user: { select: { id: true, name: true } } },
  })

  await logAudit({
    action: AuditAction.SCHEDULE_OVERRIDE,
    userId: actor.userId,
    organizationId: actor.organizationId,
    targetId: worker.id,
    targetType: "Schedule",
    metadata: { date: date.toISOString().slice(0, 10), shiftType: input.shiftType, reason: input.reason ?? null },
    ipAddress: actor.ipAddress,
  })

  return schedule
}

export interface SetShiftRangeInput {
  userId: string
  startDate: Date
  endDate: Date
  shiftType: ShiftType
  reason?: string | null
}

/** Set one worker's shift on every date in a range, atomically. */
export async function setShiftOverrideRange(actor: Actor, input: SetShiftRangeInput) {
  const worker = await requireWorkerInOrg(actor.organizationId, input.userId)
  const start = normalizeToUTCMidnight(input.startDate)
  const end = normalizeToUTCMidnight(input.endDate)
  if (end < start) throw new ServiceError("endDate must be on or after startDate")

  const dates: Date[] = []
  for (let d = start; d <= end; d = addDaysUTC(d, 1)) dates.push(d)
  if (dates.length > 366) throw new ServiceError("Range must be a year or less")

  await prisma.$transaction(
    dates.map((date) =>
      prisma.schedule.upsert({
        where: { userId_date: { userId: worker.id, date } },
        update: { shiftType: input.shiftType, isOverride: true, overrideReason: input.reason ?? null, crewId: worker.crewId },
        create: {
          userId: worker.id,
          date,
          shiftType: input.shiftType,
          isOverride: true,
          overrideReason: input.reason ?? null,
          crewId: worker.crewId,
        },
      })
    )
  )

  await logAudit({
    action: AuditAction.SCHEDULE_OVERRIDE,
    userId: actor.userId,
    organizationId: actor.organizationId,
    targetId: worker.id,
    targetType: "Schedule",
    metadata: {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      days: dates.length,
      shiftType: input.shiftType,
      reason: input.reason ?? null,
    },
    ipAddress: actor.ipAddress,
  })

  return { worker, days: dates.length }
}

export interface SwapShiftsInput {
  worker1Id: string
  date1: Date
  worker2Id: string
  date2: Date
}

/**
 * Exchange two workers' shifts (possibly on different dates). Both rows must
 * exist. Both become overrides.
 */
export async function swapShifts(actor: Actor, input: SwapShiftsInput) {
  const [w1, w2] = await Promise.all([
    requireWorkerInOrg(actor.organizationId, input.worker1Id),
    requireWorkerInOrg(actor.organizationId, input.worker2Id),
  ])
  const date1 = normalizeToUTCMidnight(input.date1)
  const date2 = normalizeToUTCMidnight(input.date2)

  const [s1, s2] = await Promise.all([
    prisma.schedule.findUnique({ where: { userId_date: { userId: w1.id, date: date1 } } }),
    prisma.schedule.findUnique({ where: { userId_date: { userId: w2.id, date: date2 } } }),
  ])
  if (!s1 || !s2) {
    throw new ServiceError("Both workers need a schedule entry on the given dates before they can swap", 409)
  }

  const reason = `Swapped with ${w2.name ?? w2.email}`
  const reason2 = `Swapped with ${w1.name ?? w1.email}`

  await prisma.$transaction([
    prisma.schedule.update({
      where: { id: s1.id },
      data: { shiftType: s2.shiftType, customShiftCode: s2.customShiftCode, isOverride: true, overrideReason: reason },
    }),
    prisma.schedule.update({
      where: { id: s2.id },
      data: { shiftType: s1.shiftType, customShiftCode: s1.customShiftCode, isOverride: true, overrideReason: reason2 },
    }),
  ])

  await logAudit({
    action: AuditAction.SCHEDULE_OVERRIDE,
    userId: actor.userId,
    organizationId: actor.organizationId,
    targetType: "Schedule",
    metadata: {
      swap: true,
      worker1Id: w1.id,
      date1: date1.toISOString().slice(0, 10),
      worker2Id: w2.id,
      date2: date2.toISOString().slice(0, 10),
    },
    ipAddress: actor.ipAddress,
  })

  return {
    worker1: { ...w1, nowHas: s2.shiftType, on: date1 },
    worker2: { ...w2, nowHas: s1.shiftType, on: date2 },
  }
}

/** Type of a schedule row with the user fields the services select. */
export type ScheduleWithUser = Prisma.ScheduleGetPayload<{
  include: { user: { select: { id: true; name: true; email: true; positionType: true; crewId: true } } }
}>
