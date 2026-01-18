import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { forgotPasswordSchema } from "@/lib/validations"
import { generateToken } from "@/lib/utils"
import { sendPasswordResetEmail } from "@/lib/email"
import { logger } from "@/lib/logger"
import { checkRateLimit } from "@/lib/rate-limit"
import { audit, AuditAction, getClientInfo } from "@/lib/audit"

const RESET_TOKEN_EXPIRY_MINUTES = 60

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 3 requests per 15 minutes per IP
    const rateLimitResult = checkRateLimit(request, {
      maxRequests: 3,
      windowMs: 15 * 60 * 1000,
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many password reset requests. Please try again later." },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { email } = forgotPasswordSchema.parse(body)
    const normalizedEmail = email.toLowerCase()

    // Always return success to prevent email enumeration
    // But only actually send email if user exists
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, status: true },
    })

    if (user && user.status === "ACTIVE") {
      // Generate reset token
      const token = generateToken(48)
      const expires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000)

      // Delete any existing reset tokens for this user
      await prisma.verificationToken.deleteMany({
        where: { identifier: normalizedEmail },
      })

      // Create new reset token
      await prisma.verificationToken.create({
        data: {
          identifier: normalizedEmail,
          token,
          expires,
        },
      })

      // Send reset email
      await sendPasswordResetEmail(normalizedEmail, token, RESET_TOKEN_EXPIRY_MINUTES)

      // Audit log for password reset request
      const clientInfo = getClientInfo(request)
      audit(AuditAction.PASSWORD_RESET_REQUESTED, {
        userId: user.id,
        targetId: user.id,
        targetType: "user",
        metadata: { email: normalizedEmail },
        ...clientInfo,
      })

      logger.info("Password reset requested", { email: normalizedEmail })
    } else {
      // Log but don't reveal that user doesn't exist
      logger.info("Password reset requested for non-existent or inactive user", {
        email: normalizedEmail,
      })
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: "If an account exists with this email, you will receive a password reset link.",
    })
  } catch (error) {
    logger.error("Error processing password reset request", error)

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    )
  }
}
