import { logger } from "./logger"

export interface EmailOptions {
  to: string
  subject: string
  text: string
  html?: string
}

/**
 * Send an email using the configured email provider.
 * In development, logs the email to console.
 * In production, requires SMTP configuration.
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const { to, subject, text, html } = options

  // In development or when SMTP is not configured, log the email
  if (!process.env.SMTP_HOST || process.env.NODE_ENV === "development") {
    logger.info("Email would be sent (SMTP not configured)", {
      to,
      subject,
      // Don't log actual content in production for privacy
      preview: process.env.NODE_ENV === "development" ? text.substring(0, 200) : "[redacted]",
    })
    return true
  }

  try {
    // Dynamically import nodemailer only when needed
    const nodemailer = await import("nodemailer")

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })

    await transporter.sendMail({
      from: process.env.SMTP_FROM || "noreply@scheduleos.app",
      to,
      subject,
      text,
      html: html || text,
    })

    logger.info("Email sent successfully", { to, subject })
    return true
  } catch (error) {
    logger.error("Failed to send email", { error, to, subject })
    return false
  }
}

/**
 * Send a password reset email with the reset link.
 */
export async function sendPasswordResetEmail(
  email: string,
  token: string,
  expiresInMinutes: number = 60
): Promise<boolean> {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
  const resetUrl = `${baseUrl}/reset-password?token=${token}`

  const subject = "Reset Your Password - ScheduleOS"
  const text = `
You requested a password reset for your ScheduleOS account.

Click the link below to reset your password:
${resetUrl}

This link will expire in ${expiresInMinutes} minutes.

If you didn't request this password reset, you can safely ignore this email.

- The ScheduleOS Team
`.trim()

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">Reset Your Password</h2>
  <p style="color: #666; line-height: 1.6;">
    You requested a password reset for your ScheduleOS account.
  </p>
  <p style="margin: 30px 0;">
    <a href="${resetUrl}"
       style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      Reset Password
    </a>
  </p>
  <p style="color: #666; font-size: 14px; line-height: 1.6;">
    This link will expire in ${expiresInMinutes} minutes.
  </p>
  <p style="color: #999; font-size: 12px; margin-top: 40px;">
    If you didn't request this password reset, you can safely ignore this email.
  </p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px;">
    - The ScheduleOS Team
  </p>
</body>
</html>
`.trim()

  return sendEmail({ to: email, subject, text, html })
}
