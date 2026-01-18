import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resetPasswordSchema } from "@/lib/validations"
import { hashPassword } from "@/lib/auth"
import { logger } from "@/lib/logger"
import { checkRateLimit } from "@/lib/rate-limit"
import { audit, AuditAction, getClientInfo } from "@/lib/audit"

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 requests per 15 minutes per IP
    const ip = request.headers.get("x-forwarded-for") || "unknown"
    const rateLimitResult = checkRateLimit(`reset-password:${ip}`, {
      maxRequests: 5,
      windowMs: 15 * 60 * 1000,
    })

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { token, password } = resetPasswordSchema.parse(body)

    // Find the verification token
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    })

    if (!verificationToken) {
      return NextResponse.json(
        { error: "Invalid or expired reset token" },
        { status: 400 }
      )
    }

    // Check if token has expired
    if (verificationToken.expires < new Date()) {
      // Delete expired token
      await prisma.verificationToken.delete({
        where: { token },
      })

      return NextResponse.json(
        { error: "Reset token has expired. Please request a new password reset." },
        { status: 400 }
      )
    }

    // Find the user by email (identifier)
    const user = await prisma.user.findUnique({
      where: { email: verificationToken.identifier },
      select: { id: true, status: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Account is not active" },
        { status: 400 }
      )
    }

    // Hash the new password
    const passwordHash = await hashPassword(password)

    // Update user password and delete the token in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      prisma.verificationToken.delete({
        where: { token },
      }),
    ])

    // Audit log for password reset completion
    const clientInfo = getClientInfo(request)
    audit(AuditAction.PASSWORD_RESET_COMPLETED, {
      userId: user.id,
      targetId: user.id,
      targetType: "user",
      ...clientInfo,
    })

    logger.info("Password reset completed", { userId: user.id })

    return NextResponse.json({
      success: true,
      message: "Password has been reset successfully. You can now log in with your new password.",
    })
  } catch (error) {
    logger.error("Error resetting password", error)

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    )
  }
}
