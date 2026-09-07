import type { UserRole, UserStatus, PositionType } from "@prisma/client"
import { prisma } from "../prisma"
import { logAudit, AuditAction } from "../audit-log"
import { checkUserChangeAllowed, wouldRemoveLastAdmin } from "../user-permissions"
import { ServiceError, forbidden, notFound } from "./errors"
import type { Actor } from "./schedules"

export interface UpdateWorkerInput {
  name?: string
  email?: string
  role?: UserRole
  status?: UserStatus
  position?: string
  positionType?: PositionType
  phone?: string
  crewId?: string | null
  hireDate?: Date
  positionGroupId?: string | null
  rosterOrder?: number | null
  qualifications?: string[]
}

export const workerSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  position: true,
  positionType: true,
  phone: true,
  status: true,
  hireDate: true,
  positionGroupId: true,
  rosterOrder: true,
  qualifications: true,
  crew: { select: { id: true, name: true, color: true } },
  positionGroup: { select: { id: true, name: true, color: true } },
} as const

/**
 * Update a worker's profile, role, status or crew.
 *
 * Enforces the same rules whoever calls it (REST or assistant): only admins
 * change roles or status, supervisors only edit workers, nobody edits their
 * own role, and the last active admin can't be removed.
 */
export async function updateWorker(
  actor: Actor & { role: UserRole },
  workerId: string,
  input: UpdateWorkerInput
) {
  const existing = await prisma.user.findFirst({
    where: { id: workerId, organizationId: actor.organizationId },
    select: { id: true, role: true, status: true },
  })
  if (!existing) throw notFound("Worker")

  const denied = checkUserChangeAllowed({
    actorId: actor.userId,
    actorRole: actor.role,
    targetId: existing.id,
    targetRole: existing.role,
    newRole: input.role,
    newStatus: input.status,
  })
  if (denied) throw forbidden(denied)

  if (input.role !== undefined || input.status !== undefined) {
    const activeAdminCount = await prisma.user.count({
      where: { organizationId: actor.organizationId, role: "ADMIN", status: "ACTIVE" },
    })
    if (
      wouldRemoveLastAdmin({
        targetRole: existing.role,
        targetStatus: existing.status,
        newRole: input.role,
        newStatus: input.status,
        activeAdminCount,
      })
    ) {
      throw new ServiceError("Cannot remove the only active admin. Assign another admin first.", 400)
    }
  }

  if (input.positionGroupId) {
    const group = await prisma.positionGroup.findFirst({
      where: { id: input.positionGroupId, organizationId: actor.organizationId },
      select: { id: true },
    })
    if (!group) throw new ServiceError("Invalid position group", 400)
  }

  if (input.crewId) {
    const crew = await prisma.crew.findFirst({
      where: { id: input.crewId, organizationId: actor.organizationId },
      select: { id: true },
    })
    if (!crew) throw new ServiceError("Invalid crew", 400)
  }

  const worker = await prisma.user.update({
    where: { id: existing.id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.email !== undefined && { email: input.email.toLowerCase() }),
      ...(input.role !== undefined && { role: input.role }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.position !== undefined && { position: input.position }),
      ...(input.positionType !== undefined && { positionType: input.positionType }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.crewId !== undefined && { crewId: input.crewId }),
      ...(input.hireDate !== undefined && { hireDate: input.hireDate }),
      ...(input.positionGroupId !== undefined && { positionGroupId: input.positionGroupId }),
      ...(input.rosterOrder !== undefined && { rosterOrder: input.rosterOrder }),
      ...(input.qualifications !== undefined && { qualifications: input.qualifications }),
    },
    select: workerSelect,
  })

  await logAudit({
    action: AuditAction.USER_UPDATED,
    userId: actor.userId,
    organizationId: actor.organizationId,
    targetId: worker.id,
    targetType: "User",
    metadata: {
      // Field names only — never values (see review C7)
      changedFields: Object.keys(input).filter((k) => input[k as keyof UpdateWorkerInput] !== undefined),
      ...(input.role !== undefined && { role: input.role }),
      ...(input.status !== undefined && { status: input.status }),
    },
    ipAddress: actor.ipAddress,
  })

  return worker
}
