export enum AuditAction {
  USER_CREATED = "USER_CREATED",
  USER_UPDATED = "USER_UPDATED",
  USER_DELETED = "USER_DELETED",
  TIME_OFF_APPROVED = "TIME_OFF_APPROVED",
  TIME_OFF_DENIED = "TIME_OFF_DENIED",
  SCHEDULE_OVERRIDE = "SCHEDULE_OVERRIDE",
  CREW_CREATED = "CREW_CREATED",
  CREW_UPDATED = "CREW_UPDATED",
  CREW_DELETED = "CREW_DELETED",
  ORGANIZATION_UPDATED = "ORGANIZATION_UPDATED",
  ROLE_CHANGED = "ROLE_CHANGED",
  SUPPORT_REQUEST = "SUPPORT_REQUEST",
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
 * Log an audit event for sensitive operations
 */
export async function logAudit(data: AuditLogData): Promise<void> {
  try {
    // Log to console in structured format (can be picked up by logging services)
    console.log(JSON.stringify({
      type: "AUDIT_LOG",
      timestamp: new Date().toISOString(),
      action: data.action,
      userId: data.userId,
      organizationId: data.organizationId,
      targetId: data.targetId,
      targetType: data.targetType,
      metadata: data.metadata,
      ipAddress: data.ipAddress,
    }))

    // Could also store in database if needed for compliance
    // await prisma.auditLog.create({ data: ... })
  } catch (error) {
    // Don't throw errors from audit logging to avoid disrupting main flows
    console.error("Failed to log audit event:", error)
  }
}
