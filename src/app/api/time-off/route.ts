import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { createTimeOffRequestSchema, updateTimeOffRequestSchema } from "@/lib/validations"
import { ShiftType } from "@/types"
import { getDateRange } from "@/lib/timezone"
import { sendEmail, timeOffRequestEmail, timeOffResponseEmail } from "@/lib/email"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { getClientIP } from "@/lib/rate-limit"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const userId = searchParams.get("userId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    // Workers can only see their own requests
    const userFilter = session.user.role === "WORKER"
      ? session.user.id
      : userId || undefined

    const requests = await prisma.timeOffRequest.findMany({
      where: {
        user: {
          organizationId: session.user.organizationId,
        },
        ...(userFilter && { userId: userFilter }),
        ...(status && { status: status as "PENDING" | "APPROVED" | "DENIED" | "CANCELLED" }),
        ...(startDate && endDate && {
          OR: [
            {
              startDate: { gte: new Date(startDate), lte: new Date(endDate) },
            },
            {
              endDate: { gte: new Date(startDate), lte: new Date(endDate) },
            },
            {
              startDate: { lte: new Date(startDate) },
              endDate: { gte: new Date(endDate) },
            },
          ],
        }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            crew: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ success: true, data: requests })
  } catch (error) {
    console.error("Error fetching time off requests:", error)
    return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createTimeOffRequestSchema.parse(body)

    // Check for overlapping approved requests
    const overlappingRequest = await prisma.timeOffRequest.findFirst({
      where: {
        userId: session.user.id,
        status: { in: ["PENDING", "APPROVED"] },
        OR: [
          {
            startDate: { lte: new Date(validatedData.endDate) },
            endDate: { gte: new Date(validatedData.startDate) },
          },
        ],
      },
    })

    if (overlappingRequest) {
      return NextResponse.json(
        { error: "You already have a pending or approved request for these dates" },
        { status: 400 }
      )
    }

    // Check staffing impact if vacation
    if (validatedData.type === "VACATION") {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { crew: true },
      })

      if (user?.crewId) {
        // Check vacation limit per shift
        const staffingRule = await prisma.staffingRule.findFirst({
          where: {
            organizationId: session.user.organizationId,
            shiftType: ShiftType.DAY, // Check day shift rule
            isActive: true,
          },
        })

        if (staffingRule) {
          const dateRange = getDateRange(
            new Date(validatedData.startDate),
            new Date(validatedData.endDate)
          )

          for (const date of dateRange) {
            const vacationCount = await prisma.timeOffRequest.count({
              where: {
                user: {
                  crewId: user.crewId,
                },
                status: "APPROVED",
                type: "VACATION",
                startDate: { lte: date },
                endDate: { gte: date },
              },
            })

            if (vacationCount >= staffingRule.maxVacation) {
              return NextResponse.json(
                {
                  error: `Maximum vacation limit (${staffingRule.maxVacation}) reached for your crew on ${date.toLocaleDateString()}`,
                  warning: true,
                },
                { status: 400 }
              )
            }
          }
        }
      }
    }

    const timeOffRequest = await prisma.timeOffRequest.create({
      data: {
        userId: session.user.id,
        startDate: new Date(validatedData.startDate),
        endDate: new Date(validatedData.endDate),
        type: validatedData.type,
        reason: validatedData.reason,
        status: "PENDING",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Create notification for supervisors and send email
    const supervisors = await prisma.user.findMany({
      where: {
        organizationId: session.user.organizationId,
        role: { in: ["ADMIN", "SUPERVISOR"] },
      },
      select: { id: true, email: true },
    })

    await prisma.notification.createMany({
      data: supervisors.map((supervisor: { id: string }) => ({
        userId: supervisor.id,
        type: "TIME_OFF_REQUEST",
        title: "New Time Off Request",
        message: `${session.user.name || session.user.email} has requested time off from ${validatedData.startDate} to ${validatedData.endDate}`,
        data: { requestId: timeOffRequest.id },
      })),
    })

    // Send email notifications to supervisors
    const supervisorEmails = supervisors.map((s: { email: string }) => s.email).filter(Boolean)
    if (supervisorEmails.length > 0) {
      const emailHtml = timeOffRequestEmail(
        session.user.name || session.user.email || "A worker",
        validatedData.type,
        new Date(validatedData.startDate).toLocaleDateString(),
        new Date(validatedData.endDate).toLocaleDateString(),
        validatedData.reason
      )
      await sendEmail({
        to: supervisorEmails,
        subject: `New Time-Off Request from ${session.user.name || session.user.email}`,
        html: emailHtml,
      })
    }

    return NextResponse.json(
      { success: true, data: timeOffRequest, message: "Request submitted successfully" },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating time off request:", error)

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Failed to create request" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get("id")

    if (!requestId) {
      return NextResponse.json({ error: "Request ID is required" }, { status: 400 })
    }

    const body = await request.json()
    const validatedData = updateTimeOffRequestSchema.parse(body)

    // Verify request belongs to organization
    const existingRequest = await prisma.timeOffRequest.findFirst({
      where: {
        id: requestId,
        user: {
          organizationId: session.user.organizationId,
        },
      },
      include: {
        user: true,
      },
    })

    if (!existingRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    // Prevent supervisors from approving their own requests
    if (existingRequest.userId === session.user.id) {
      return NextResponse.json(
        { error: "You cannot approve your own time-off request" },
        { status: 403 }
      )
    }

    if (existingRequest.status !== "PENDING") {
      return NextResponse.json(
        { error: "Only pending requests can be updated" },
        { status: 400 }
      )
    }

    // Update request
    const updatedRequest = await prisma.timeOffRequest.update({
      where: { id: requestId },
      data: {
        status: validatedData.status,
        adminNotes: validatedData.adminNotes,
        approvedById: session.user.id,
        approvedAt: new Date(),
      },
    })

    // Log audit event
    await logAudit({
      action: validatedData.status === "APPROVED" ? AuditAction.TIME_OFF_APPROVED : AuditAction.TIME_OFF_DENIED,
      userId: session.user.id,
      organizationId: session.user.organizationId,
      targetId: requestId,
      targetType: "TimeOffRequest",
      metadata: {
        requestUserId: existingRequest.userId,
        startDate: existingRequest.startDate,
        endDate: existingRequest.endDate,
        type: existingRequest.type,
        adminNotes: validatedData.adminNotes,
      },
      ipAddress: getClientIP(request),
    })

    // If approved, create schedule entries
    if (validatedData.status === "APPROVED") {
      const shiftType =
        existingRequest.type === "VACATION" ? ShiftType.VACATION :
        existingRequest.type === "SICK" ? ShiftType.SICK :
        ShiftType.OFF

      const dateRange = getDateRange(existingRequest.startDate, existingRequest.endDate)

      for (const date of dateRange) {
        await prisma.schedule.upsert({
          where: {
            userId_date: {
              userId: existingRequest.userId,
              date,
            },
          },
          update: {
            shiftType,
            isOverride: true,
            overrideReason: `Time off: ${existingRequest.type}`,
          },
          create: {
            userId: existingRequest.userId,
            date,
            shiftType,
            crewId: existingRequest.user.crewId,
            isOverride: true,
            overrideReason: `Time off: ${existingRequest.type}`,
          },
        })
      }
    }

    // Notify user
    await prisma.notification.create({
      data: {
        userId: existingRequest.userId,
        type: validatedData.status === "APPROVED" ? "TIME_OFF_APPROVED" : "TIME_OFF_DENIED",
        title: `Time Off Request ${validatedData.status === "APPROVED" ? "Approved" : "Denied"}`,
        message: validatedData.status === "APPROVED"
          ? `Your time off request has been approved.`
          : `Your time off request has been denied.${validatedData.adminNotes ? ` Reason: ${validatedData.adminNotes}` : ""}`,
        data: { requestId },
      },
    })

    // Send email notification to worker
    if (existingRequest.user.email) {
      const emailHtml = timeOffResponseEmail(
        existingRequest.user.name || "Worker",
        validatedData.status,
        existingRequest.type,
        existingRequest.startDate.toLocaleDateString(),
        existingRequest.endDate.toLocaleDateString(),
        validatedData.adminNotes
      )
      await sendEmail({
        to: existingRequest.user.email,
        subject: `Your Time-Off Request has been ${validatedData.status === "APPROVED" ? "Approved" : "Denied"}`,
        html: emailHtml,
      })
    }

    return NextResponse.json({
      success: true,
      data: updatedRequest,
      message: `Request ${validatedData.status.toLowerCase()}`,
    })
  } catch (error) {
    console.error("Error updating time off request:", error)
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 })
  }
}
