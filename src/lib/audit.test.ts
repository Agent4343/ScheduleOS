import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  audit,
  AuditAction,
  getRecentAuditLogs,
  clearAuditLogs,
  getClientInfo,
} from "./audit"

// Mock the logger
vi.mock("./logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

describe("Audit Logging", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearAuditLogs()
  })

  describe("audit", () => {
    it("should log audit events with correct action", async () => {
      const { logger } = await import("./logger")

      audit(AuditAction.LOGIN_SUCCESS, {
        userId: "user-123",
      })

      expect(logger.info).toHaveBeenCalledWith(
        "AUDIT: LOGIN_SUCCESS",
        expect.objectContaining({
          audit: true,
          action: AuditAction.LOGIN_SUCCESS,
          userId: "user-123",
        })
      )
    })

    it("should include all provided metadata", async () => {
      const { logger } = await import("./logger")

      audit(AuditAction.USER_DELETED, {
        userId: "admin-1",
        targetId: "user-2",
        targetType: "user",
        organizationId: "org-1",
        metadata: { reason: "policy violation" },
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      })

      expect(logger.info).toHaveBeenCalledWith(
        "AUDIT: USER_DELETED",
        expect.objectContaining({
          userId: "admin-1",
          targetId: "user-2",
          targetType: "user",
          organizationId: "org-1",
          metadata: { reason: "policy violation" },
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0",
        })
      )
    })

    it("should include timestamp", async () => {
      const { logger } = await import("./logger")
      const before = new Date()

      audit(AuditAction.PASSWORD_CHANGED)

      const call = (logger.info as ReturnType<typeof vi.fn>).mock.calls[0]
      const loggedData = call[1]
      const timestamp = new Date(loggedData.timestamp)

      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime())
    })

    it("should store audit logs in memory", () => {
      audit(AuditAction.LOGIN_SUCCESS, { userId: "user-1" })
      audit(AuditAction.LOGIN_FAILED, { userId: "user-2" })

      const logs = getRecentAuditLogs()

      expect(logs).toHaveLength(2)
    })
  })

  describe("getRecentAuditLogs", () => {
    it("should return logs in reverse chronological order", () => {
      audit(AuditAction.LOGIN_SUCCESS, { userId: "first" })
      audit(AuditAction.LOGIN_SUCCESS, { userId: "second" })
      audit(AuditAction.LOGIN_SUCCESS, { userId: "third" })

      const logs = getRecentAuditLogs()

      expect(logs[0].userId).toBe("third")
      expect(logs[1].userId).toBe("second")
      expect(logs[2].userId).toBe("first")
    })

    it("should filter by action", () => {
      audit(AuditAction.LOGIN_SUCCESS, { userId: "user-1" })
      audit(AuditAction.LOGIN_FAILED, { userId: "user-2" })
      audit(AuditAction.LOGIN_SUCCESS, { userId: "user-3" })

      const logs = getRecentAuditLogs({ action: AuditAction.LOGIN_SUCCESS })

      expect(logs).toHaveLength(2)
      logs.forEach(log => {
        expect(log.action).toBe(AuditAction.LOGIN_SUCCESS)
      })
    })

    it("should filter by userId", () => {
      audit(AuditAction.LOGIN_SUCCESS, { userId: "user-1" })
      audit(AuditAction.PASSWORD_CHANGED, { userId: "user-1" })
      audit(AuditAction.LOGIN_SUCCESS, { userId: "user-2" })

      const logs = getRecentAuditLogs({ userId: "user-1" })

      expect(logs).toHaveLength(2)
      logs.forEach(log => {
        expect(log.userId).toBe("user-1")
      })
    })

    it("should filter by organizationId", () => {
      audit(AuditAction.USER_CREATED, { organizationId: "org-1" })
      audit(AuditAction.USER_CREATED, { organizationId: "org-2" })
      audit(AuditAction.USER_DELETED, { organizationId: "org-1" })

      const logs = getRecentAuditLogs({ organizationId: "org-1" })

      expect(logs).toHaveLength(2)
    })

    it("should limit results", () => {
      for (let i = 0; i < 10; i++) {
        audit(AuditAction.LOGIN_SUCCESS, { userId: `user-${i}` })
      }

      const logs = getRecentAuditLogs({ limit: 5 })

      expect(logs).toHaveLength(5)
    })

    it("should combine filters", () => {
      audit(AuditAction.LOGIN_SUCCESS, { userId: "user-1", organizationId: "org-1" })
      audit(AuditAction.LOGIN_FAILED, { userId: "user-1", organizationId: "org-1" })
      audit(AuditAction.LOGIN_SUCCESS, { userId: "user-2", organizationId: "org-1" })
      audit(AuditAction.LOGIN_SUCCESS, { userId: "user-1", organizationId: "org-2" })

      const logs = getRecentAuditLogs({
        action: AuditAction.LOGIN_SUCCESS,
        userId: "user-1",
        organizationId: "org-1",
      })

      expect(logs).toHaveLength(1)
    })
  })

  describe("clearAuditLogs", () => {
    it("should clear all audit logs", () => {
      audit(AuditAction.LOGIN_SUCCESS)
      audit(AuditAction.LOGIN_SUCCESS)

      clearAuditLogs()

      expect(getRecentAuditLogs()).toHaveLength(0)
    })
  })

  describe("getClientInfo", () => {
    it("should extract IP from x-forwarded-for header", () => {
      const mockRequest = {
        headers: new Headers({
          "x-forwarded-for": "192.168.1.1, 10.0.0.1",
          "user-agent": "Test Browser",
        }),
      } as Request

      const info = getClientInfo(mockRequest)

      expect(info.ipAddress).toBe("192.168.1.1")
      expect(info.userAgent).toBe("Test Browser")
    })

    it("should handle missing headers", () => {
      const mockRequest = {
        headers: new Headers(),
      } as Request

      const info = getClientInfo(mockRequest)

      expect(info.ipAddress).toBe("unknown")
      expect(info.userAgent).toBe("unknown")
    })
  })

  describe("AuditAction enum", () => {
    it("should have all required authentication actions", () => {
      expect(AuditAction.LOGIN_SUCCESS).toBeDefined()
      expect(AuditAction.LOGIN_FAILED).toBeDefined()
      expect(AuditAction.LOGOUT).toBeDefined()
      expect(AuditAction.PASSWORD_RESET_REQUESTED).toBeDefined()
      expect(AuditAction.PASSWORD_RESET_COMPLETED).toBeDefined()
    })

    it("should have all required user management actions", () => {
      expect(AuditAction.USER_CREATED).toBeDefined()
      expect(AuditAction.USER_UPDATED).toBeDefined()
      expect(AuditAction.USER_DELETED).toBeDefined()
      expect(AuditAction.USER_ROLE_CHANGED).toBeDefined()
    })

    it("should have all required time-off actions", () => {
      expect(AuditAction.TIME_OFF_REQUESTED).toBeDefined()
      expect(AuditAction.TIME_OFF_APPROVED).toBeDefined()
      expect(AuditAction.TIME_OFF_DENIED).toBeDefined()
    })
  })
})
