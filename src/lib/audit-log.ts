import { prisma } from "@/lib/prisma"

export enum AuditAction {
  USER_CREATED = "USER_CREATED",
  USER_UPDATED = "USER_UPDATED",
  USER_DELETED = "USER_DELETED",
  TIME_OFF_APPROVED = "TIME_OFF_APPROVED",
  TIME_OFF_DENIED = "TIME_OFF_DENIED",
  SCHEDULE_OVERRIDE = "SCHEDULE_OVERRIDE",
  SCHEDULE_GENERATED = "SCHEDULE_GENERATED",
  CREW_CREATED = "CREW_CREATED",
  CREW_UPDATED = "CREW_UPDATED",
  CREW_DELETED = "CREW_DELETED",
  ORGANIZATION_UPDATED = "ORGANIZATION_UPDATED",
  ROLE_CHANGED = "ROLE_CHANGED",
  SHIFT_SWAP_APPROVED = "SHIFT_SWAP_APPROVED",
  ANNOUNCEMENT_CREATED = "ANNOUNCEMENT_CREATED",
  WORKER_IMPORTED = "WORKER_IMPORTED",
  STAFFING_RULE_CHANGED = "STAFFING_RULE_CHANGED",
}

interface AuditLogData {
  action: AuditAction
  userId: string
  organizationId: string
  targetId?: string
  targetType?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
}

/**
 * Log an audit event for sensitive operations.
 * Persists to database and logs to console.
 */
export async function logAudit(data: AuditLogData): Promise<void> {
  try {
    // Persist to database
    await prisma.auditLog.create({
      data: {
        action: data.action,
        userId: data.userId,
        organizationId: data.organizationId,
        targetId: data.targetId || null,
        targetType: data.targetType || null,
        metadata: data.metadata ?? undefined,
        ipAddress: data.ipAddress || null,
      },
    })

    // Also log to console for external logging services
    console.log(JSON.stringify({
      type: "AUDIT_LOG",
      timestamp: new Date().toISOString(),
      action: data.action,
      userId: data.userId,
      organizationId: data.organizationId,
      targetId: data.targetId,
      targetType: data.targetType,
      metadata: data.metadata,
    }))
  } catch (error) {
    // Don't throw errors from audit logging to avoid disrupting main flows
    console.error("Failed to log audit event:", error)
  }
}
