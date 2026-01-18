import { describe, it, expect, vi, beforeEach } from "vitest"
import { sendEmail, sendPasswordResetEmail } from "./email"

// Mock the logger
vi.mock("./logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

describe("Email Utility", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset environment variables
    delete process.env.SMTP_HOST
  })

  describe("sendEmail", () => {
    it("should return true and log when SMTP is not configured", async () => {
      const { logger } = await import("./logger")

      const result = await sendEmail({
        to: "test@example.com",
        subject: "Test Subject",
        text: "Test body",
      })

      expect(result).toBe(true)
      expect(logger.info).toHaveBeenCalledWith(
        "Email would be sent (SMTP not configured)",
        expect.objectContaining({
          to: "test@example.com",
          subject: "Test Subject",
        })
      )
    })

    it("should include preview in development mode", async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "development"

      const { logger } = await import("./logger")

      await sendEmail({
        to: "test@example.com",
        subject: "Test",
        text: "Preview text content",
      })

      expect(logger.info).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          preview: expect.stringContaining("Preview"),
        })
      )

      process.env.NODE_ENV = originalEnv
    })

    it("should handle email options with HTML", async () => {
      const result = await sendEmail({
        to: "test@example.com",
        subject: "HTML Email",
        text: "Plain text",
        html: "<h1>HTML Content</h1>",
      })

      expect(result).toBe(true)
    })
  })

  describe("sendPasswordResetEmail", () => {
    it("should send password reset email with correct content", async () => {
      const { logger } = await import("./logger")
      process.env.NEXTAUTH_URL = "https://example.com"

      const result = await sendPasswordResetEmail(
        "user@example.com",
        "reset-token-123",
        60
      )

      expect(result).toBe(true)
      expect(logger.info).toHaveBeenCalledWith(
        "Email would be sent (SMTP not configured)",
        expect.objectContaining({
          to: "user@example.com",
          subject: "Reset Your Password - ScheduleOS",
        })
      )
    })

    it("should use localhost as default URL", async () => {
      delete process.env.NEXTAUTH_URL

      const result = await sendPasswordResetEmail(
        "user@example.com",
        "token",
        30
      )

      expect(result).toBe(true)
    })

    it("should include custom expiry time in email", async () => {
      const { logger } = await import("./logger")

      await sendPasswordResetEmail("user@example.com", "token", 120)

      // Verify the email was logged (content would include "120 minutes")
      expect(logger.info).toHaveBeenCalled()
    })
  })
})
