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

export function scheduleChangeEmail(
  workerName: string,
  changeType: "published" | "updated" | "removed",
  date: string,
  shiftType?: string,
  details?: string
): string {
  const actionText = {
    published: "A new schedule has been published",
    updated: "Your schedule has been updated",
    removed: "A shift has been removed from your schedule",
  }[changeType]

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">Schedule ${changeType === "published" ? "Published" : "Change"}</h2>
      <p>Hi ${workerName},</p>
      <p>${actionText}.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Date:</strong></td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${date}</td>
        </tr>
        ${shiftType ? `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Shift:</strong></td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${shiftType}</td>
        </tr>
        ` : ""}
        ${details ? `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Details:</strong></td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${details}</td>
        </tr>
        ` : ""}
      </table>
      <p>Log in to ScheduleOS to view your updated schedule.</p>
    </div>
  `
}

export function shiftSwapEmail(
  recipientName: string,
  action: "requested" | "accepted" | "declined" | "approved" | "cancelled",
  requesterName: string,
  targetName: string,
  date: string,
  shiftType: string
): string {
  const statusColor: Record<string, string> = {
    requested: "#3b82f6",
    accepted: "#22c55e",
    declined: "#ef4444",
    approved: "#22c55e",
    cancelled: "#6b7280",
  }

  const actionMessages: Record<string, string> = {
    requested: `<strong>${requesterName}</strong> has requested to swap shifts with <strong>${targetName}</strong>.`,
    accepted: `<strong>${targetName}</strong> has accepted the shift swap request from <strong>${requesterName}</strong>.`,
    declined: `<strong>${targetName}</strong> has declined the shift swap request from <strong>${requesterName}</strong>.`,
    approved: `The shift swap between <strong>${requesterName}</strong> and <strong>${targetName}</strong> has been approved by a supervisor.`,
    cancelled: `The shift swap between <strong>${requesterName}</strong> and <strong>${targetName}</strong> has been cancelled.`,
  }

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">Shift Swap ${action.charAt(0).toUpperCase() + action.slice(1)}</h2>
      <p>Hi ${recipientName},</p>
      <p>${actionMessages[action]}</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Status:</strong></td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">
            <span style="color: ${statusColor[action]}; font-weight: bold;">${action.charAt(0).toUpperCase() + action.slice(1)}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Date:</strong></td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${date}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Shift:</strong></td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${shiftType}</td>
        </tr>
      </table>
      <p>Log in to ScheduleOS to view details and take action.</p>
    </div>
  `
}

export function announcementEmail(
  recipientName: string,
  title: string,
  content: string,
  priority: string,
  authorName: string
): string {
  const priorityColors: Record<string, string> = {
    LOW: "#6b7280",
    NORMAL: "#3b82f6",
    HIGH: "#f97316",
    URGENT: "#ef4444",
  }

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">Team Announcement</h2>
      <p>Hi ${recipientName},</p>
      <p>A new announcement has been posted by <strong>${authorName}</strong>:</p>
      <div style="border-left: 4px solid ${priorityColors[priority] || "#3b82f6"}; padding: 16px; margin: 20px 0; background: #f9fafb;">
        <h3 style="margin: 0 0 8px 0; color: #1a1a1a;">${title}</h3>
        <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; color: white; background: ${priorityColors[priority] || "#3b82f6"}; margin-bottom: 12px;">
          ${priority}
        </span>
        <p style="margin: 0; color: #374151; white-space: pre-wrap;">${content}</p>
      </div>
      <p>Log in to ScheduleOS to view all announcements.</p>
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
