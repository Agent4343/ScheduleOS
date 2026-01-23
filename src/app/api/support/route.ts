import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { sendEmail } from "@/lib/email"
import { logAudit } from "@/lib/audit-log"

const supportSchema = z.object({
  category: z.string().optional(),
  subject: z.string().min(3).max(120),
  message: z.string().min(10).max(2000),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = supportSchema.parse(body)
    const supportEmail = process.env.SUPPORT_EMAIL || "support@shiftsync.app"

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
        <h2 style="color: #111827;">ShiftSync Support Request</h2>
        <p><strong>From:</strong> ${session.user.name || session.user.email} (${session.user.email})</p>
        <p><strong>Organization ID:</strong> ${session.user.organizationId}</p>
        ${data.category ? `<p><strong>Category:</strong> ${data.category}</p>` : ""}
        <p><strong>Subject:</strong> ${data.subject}</p>
        <hr style="margin: 16px 0;" />
        <p style="white-space: pre-wrap;">${data.message}</p>
      </div>
    `

    const sent = await sendEmail({
      to: supportEmail,
      subject: `Support: ${data.subject}`,
      html,
    })

    await logAudit({
      action: "support.request",
      userId: session.user.id,
      organizationId: session.user.organizationId,
      metadata: {
        category: data.category,
        subject: data.subject,
        sent,
      },
    })

    if (!sent) {
      return NextResponse.json(
        { error: "Support email could not be sent. Please try again later." },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: "Support request sent" }, { status: 200 })
  } catch (error) {
    console.error("Support request error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to send support request" }, { status: 500 })
  }
}
