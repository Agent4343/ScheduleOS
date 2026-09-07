import { prisma } from "../prisma"
import { logAudit, AuditAction } from "../audit-log"
import { sendEmail, timeOffResponseEmail } from "../email"
import { timeOffTypeToShiftType } from "../scheduling"
import { getDateRange, toDateString } from "../timezone"
import { ServiceError, forbidden, notFound } from "./errors"
import type { Actor } from "./schedules"

export interface ReviewTimeOffInput {
  requestId: string
  status: "APPROVED" | "DENIED"
  adminNotes?: string
}

/**
 * Approve or deny a pending time-off request.
 *
 * One code path for the REST endpoint and the assistant tool, so both:
 *  - refuse to review a request in another organization, or the reviewer's own
 *  - only touch PENDING requests
 *  - write the status and the schedule overrides in one transaction
 *  - audit, notify and email the worker
 */
export async function reviewTimeOffRequest(actor: Actor, input: ReviewTimeOffInput) {
  const existing = await prisma.timeOffRequest.findFirst({
    where: { id: input.requestId, user: { organizationId: actor.organizationId } },
    include: { user: { select: { id: true, name: true, email: true, crewId: true } } },
  })
  if (!existing) throw notFound("Time off request")

  if (existing.userId === actor.userId) {
    throw forbidden("You cannot review your own time-off request")
  }
  if (existing.status !== "PENDING") {
    throw new ServiceError("Only pending requests can be approved or denied", 400)
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.timeOffRequest.update({
      where: { id: existing.id },
      data: {
        status: input.status,
        adminNotes: input.adminNotes,
        approvedById: actor.userId,
        approvedAt: new Date(),
      },
    })

    if (input.status === "APPROVED") {
      const shiftType = timeOffTypeToShiftType(existing.type)
      const overrideReason = `Time off: ${existing.type}`
      for (const date of getDateRange(existing.startDate, existing.endDate)) {
        await tx.schedule.upsert({
          where: { userId_date: { userId: existing.userId, date } },
          update: { shiftType, isOverride: true, overrideReason },
          create: {
            userId: existing.userId,
            date,
            shiftType,
            crewId: existing.user.crewId,
            isOverride: true,
            overrideReason,
          },
        })
      }
    }

    return row
  })

  await logAudit({
    action: input.status === "APPROVED" ? AuditAction.TIME_OFF_APPROVED : AuditAction.TIME_OFF_DENIED,
    userId: actor.userId,
    organizationId: actor.organizationId,
    targetId: existing.id,
    targetType: "TimeOffRequest",
    metadata: {
      requestUserId: existing.userId,
      startDate: toDateString(existing.startDate),
      endDate: toDateString(existing.endDate),
      type: existing.type,
      adminNotes: input.adminNotes,
    },
    ipAddress: actor.ipAddress,
  })

  const approved = input.status === "APPROVED"
  await prisma.notification.create({
    data: {
      userId: existing.userId,
      type: approved ? "TIME_OFF_APPROVED" : "TIME_OFF_DENIED",
      title: `Time Off Request ${approved ? "Approved" : "Denied"}`,
      message: approved
        ? "Your time off request has been approved."
        : `Your time off request has been denied.${input.adminNotes ? ` Reason: ${input.adminNotes}` : ""}`,
      data: { requestId: existing.id },
    },
  })

  if (existing.user.email) {
    await sendEmail({
      to: existing.user.email,
      subject: `Your Time-Off Request has been ${approved ? "Approved" : "Denied"}`,
      html: timeOffResponseEmail(
        existing.user.name || "Worker",
        input.status,
        existing.type,
        toDateString(existing.startDate),
        toDateString(existing.endDate),
        input.adminNotes
      ),
    })
  }

  return { request: updated, worker: existing.user }
}
