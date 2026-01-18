import { logger } from "./logger"

/**
 * Audit event types for tracking sensitive operations.
 */
export enum AuditAction {
  // Authentication events
  LOGIN_SUCCESS = "LOGIN_SUCCESS",
  LOGIN_FAILED = "LOGIN_FAILED",
  LOGOUT = "LOGOUT",
  PASSWORD_RESET_REQUESTED = "PASSWORD_RESET_REQUESTED",
  PASSWORD_RESET_COMPLETED = "PASSWORD_RESET_COMPLETED",
  PASSWORD_CHANGED = "PASSWORD_CHANGED",

  // User management
  USER_CREATED = "USER_CREATED",
  USER_UPDATED = "USER_UPDATED",
  USER_DELETED = "USER_DELETED",
  USER_ROLE_CHANGED = "USER_ROLE_CHANGED",
  USER_STATUS_CHANGED = "USER_STATUS_CHANGED",

  // Organization management
  ORGANIZATION_CREATED = "ORGANIZATION_CREATED",
  ORGANIZATION_UPDATED = "ORGANIZATION_UPDATED",
  ORGANIZATION_SETTINGS_CHANGED = "ORGANIZATION_SETTINGS_CHANGED",

  // Crew management
  CREW_CREATED = "CREW_CREATED",
  CREW_UPDATED = "CREW_UPDATED",
  CREW_DELETED = "CREW_DELETED",

  // Schedule management
  SCHEDULE_GENERATED = "SCHEDULE_GENERATED",
  SCHEDULE_OVERRIDE = "SCHEDULE_OVERRIDE",
  SCHEDULE_BULK_UPDATE = "SCHEDULE_BULK_UPDATE",

  // Time-off management
  TIME_OFF_REQUESTED = "TIME_OFF_REQUESTED",
  TIME_OFF_APPROVED = "TIME_OFF_APPROVED",
  TIME_OFF_DENIED = "TIME_OFF_DENIED",
  TIME_OFF_CANCELLED = "TIME_OFF_CANCELLED",

  // Invitation management
  INVITATION_SENT = "INVITATION_SENT",
  INVITATION_ACCEPTED = "INVITATION_ACCEPTED",
  INVITATION_REVOKED = "INVITATION_REVOKED",

  // Setup and configuration
  INITIAL_SETUP = "INITIAL_SETUP",
  STAFFING_RULE_CREATED = "STAFFING_RULE_CREATED",
  STAFFING_RULE_UPDATED = "STAFFING_RULE_UPDATED",
  ROTATION_PATTERN_CREATED = "ROTATION_PATTERN_CREATED",
  ROTATION_PATTERN_UPDATED = "ROTATION_PATTERN_UPDATED",
}

/**
 * Audit log entry structure.
 */
export interface AuditLogEntry {
  action: AuditAction
  userId?: string
  targetId?: string
  targetType?: string
  organizationId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  timestamp: Date
}

/**
 * In-memory audit log storage.
 * In production, this should be persisted to a database or external service.
 */
const auditLogs: AuditLogEntry[] = []
const MAX_IN_MEMORY_LOGS = 10000

/**
 * Log an audit event.
 * Logs to structured logger and stores in memory.
 * In production, should be extended to persist to database/external service.
 */
export function audit(
  action: AuditAction,
  options: {
    userId?: string
    targetId?: string
    targetType?: string
    organizationId?: string
    metadata?: Record<string, unknown>
    ipAddress?: string
    userAgent?: string
  } = {}
): void {
  const entry: AuditLogEntry = {
    action,
    ...options,
    timestamp: new Date(),
  }

  // Log to structured logger for immediate visibility
  logger.info(`AUDIT: ${action}`, {
    audit: true,
    ...entry,
  })

  // Store in memory (with size limit to prevent memory issues)
  auditLogs.push(entry)
  if (auditLogs.length > MAX_IN_MEMORY_LOGS) {
    auditLogs.shift()
  }

  // In production, you would also persist to database:
  // persistAuditLog(entry)
}

/**
 * Get recent audit logs (for debugging/admin purposes).
 * In production, this should query the database.
 */
export function getRecentAuditLogs(options: {
  limit?: number
  action?: AuditAction
  userId?: string
  organizationId?: string
} = {}): AuditLogEntry[] {
  let logs = [...auditLogs]

  if (options.action) {
    logs = logs.filter(log => log.action === options.action)
  }

  if (options.userId) {
    logs = logs.filter(log => log.userId === options.userId)
  }

  if (options.organizationId) {
    logs = logs.filter(log => log.organizationId === options.organizationId)
  }

  // Return most recent first
  logs.reverse()

  if (options.limit) {
    logs = logs.slice(0, options.limit)
  }

  return logs
}

/**
 * Helper to extract client info from request.
 */
export function getClientInfo(request: Request): {
  ipAddress: string
  userAgent: string
} {
  const forwarded = request.headers.get("x-forwarded-for")
  const ipAddress = forwarded?.split(",")[0]?.trim() || "unknown"
  const userAgent = request.headers.get("user-agent") || "unknown"

  return { ipAddress, userAgent }
}

/**
 * Clear audit logs (for testing purposes only).
 */
export function clearAuditLogs(): void {
  auditLogs.length = 0
}
