import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import crypto from "crypto"
import { Resend } from "resend"

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
})

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = forgotPasswordSchema.parse(body)

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        success: true,
        message: "If an account exists with this email, you will receive a password reset link.",
      })
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString("hex")
    const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Delete any existing tokens for this email
    await prisma.verificationToken.deleteMany({
      where: { identifier: `password-reset:${email.toLowerCase()}` },
    })

    // Create new token
    await prisma.verificationToken.create({
      data: {
        identifier: `password-reset:${email.toLowerCase()}`,
        token,
        expires,
      },
    })

    // Send email if Resend is configured
    if (resend) {
      const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}&email=${encodeURIComponent(email.toLowerCase())}`

      const { error } = await resend.emails.send({
        from: process.env.EMAIL_FROM || "noreply@example.com",
        to: email.toLowerCase(),
        subject: "Reset your password - ShiftSync",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1f2937;">Reset Your Password</h1>
            <p>You requested a password reset for your ShiftSync account.</p>
            <p>Click the button below to reset your password. This link will expire in 1 hour.</p>
            <a href="${resetUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
              Reset Password
            </a>
            <p style="color: #6b7280; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
            <p style="color: #6b7280; font-size: 14px;">Or copy this link: ${resetUrl}</p>
          </div>
        `,
      })

      if (error) {
        console.error("Failed to send password reset email:", error)
        return NextResponse.json(
          { error: "Failed to send password reset email. Please try again later." },
          { status: 500 }
        )
      }
    } else {
      // Log token for development
      console.log(`Password reset token for ${email}: ${token}`)
      console.log("Email not configured - RESEND_API_KEY not set")
      return NextResponse.json(
        { error: "Email service is not configured. Please contact support." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "If an account exists with this email, you will receive a password reset link.",
    })
  } catch (error) {
    console.error("Forgot password error:", error)

    if (error instanceof z.ZodError) {
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
