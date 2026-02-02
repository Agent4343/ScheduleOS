import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const FROM_EMAIL = process.env.EMAIL_FROM || "ScheduleOS <noreply@scheduleos.com>"

export interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: EmailOptions): Promise<boolean> {
  if (!resend) {
    console.log("Email not configured - RESEND_API_KEY not set")
    console.log("Would have sent email:", { to, subject })
    return false
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    })

    if (error) {
      console.error("Failed to send email:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("Email send error:", error)
    return false
  }
}

// Email templates
export function timeOffRequestEmail(
  workerName: string,
  requestType: string,
  startDate: string,
  endDate: string,
  reason?: string
): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">New Time-Off Request</h2>
      <p><strong>${workerName}</strong> has submitted a time-off request:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Type:</strong></td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${requestType}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Start Date:</strong></td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${startDate}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>End Date:</strong></td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${endDate}</td>
        </tr>
        ${reason ? `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Reason:</strong></td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${reason}</td>
        </tr>
        ` : ""}
      </table>
      <p>Please review and respond to this request in ScheduleOS.</p>
    </div>
  `
}

export function timeOffResponseEmail(
  workerName: string,
  status: "APPROVED" | "DENIED",
  requestType: string,
  startDate: string,
  endDate: string,
  adminNotes?: string
): string {
  const statusColor = status === "APPROVED" ? "#22c55e" : "#ef4444"
  const statusText = status === "APPROVED" ? "Approved" : "Denied"

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">Time-Off Request ${statusText}</h2>
      <p>Hi ${workerName},</p>
      <p>Your time-off request has been <strong style="color: ${statusColor};">${statusText.toLowerCase()}</strong>.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Type:</strong></td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${requestType}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Start Date:</strong></td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${startDate}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>End Date:</strong></td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${endDate}</td>
        </tr>
        ${adminNotes ? `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Notes:</strong></td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${adminNotes}</td>
        </tr>
        ` : ""}
      </table>
      <p>Log in to ScheduleOS to view your updated schedule.</p>
    </div>
  `
}

export function welcomeEmail(userName: string, loginEmail: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">Welcome to ScheduleOS!</h2>
      <p>Hi ${userName},</p>
      <p>Your account has been created. You can now log in to view your schedule and request time off.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Email:</strong></td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${loginEmail}</td>
        </tr>
      </table>
      <p>Your administrator will provide you with your temporary password. Please change it after your first login.</p>
    </div>
  `
}

export function invitationEmail(
  organizationName: string,
  inviterName: string,
  role: string,
  inviteLink: string,
  expiresAt: Date
): string {
  const expiresDate = expiresAt.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">You've Been Invited to ShiftSync!</h2>
      <p>Hi there,</p>
      <p><strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on ShiftSync as a <strong>${role}</strong>.</p>
      <p>ShiftSync is a scheduling platform that helps teams manage shifts, time-off requests, and more.</p>
      <div style="margin: 30px 0; text-align: center;">
        <a href="${inviteLink}" style="background-color: #4f46e5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          Accept Invitation
        </a>
      </div>
      <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
      <p style="color: #4f46e5; font-size: 14px; word-break: break-all;">${inviteLink}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
      <p style="color: #999; font-size: 12px;">This invitation will expire on ${expiresDate}. If you didn't expect this invitation, you can safely ignore this email.</p>
    </div>
  `
}
