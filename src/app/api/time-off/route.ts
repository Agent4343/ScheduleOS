import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"
import { createTimeOffRequestSchema, updateTimeOffRequestSchema } from "@/lib/validations"
import { ShiftType } from "@/types"
import { getDateRange } from "@/lib/timezone"
import { sendEmail, timeOffRequestEmail } from "@/lib/email"

import { getClientIP } from "@/lib/rate-limit"
import { reviewTimeOffRequest } from "@/lib/services/time-off"
import { apiError, apiOk, handleRouteError, parseBody } from "@/lib/api-helpers"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (auth.error) return auth.error
    const { session } = auth

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
    const auth = await requireAuth()
    if (auth.error) return auth.error
    const { session } = auth

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
    const auth = await requireAuth({ roles: ["ADMIN", "SUPERVISOR"] })
    if (auth.error) return auth.error
    const { session } = auth

    const requestId = new URL(request.url).searchParams.get("id")
    if (!requestId) {
      return apiError("Request ID is required", 400)
    }

    const validatedData = await parseBody(updateTimeOffRequestSchema, request)

    // All the rules (org scoping, no self-approval, PENDING only, atomic
    // schedule update, audit, notification, email) live in the service and
    // are shared with the AI assistant.
    const { request: updatedRequest } = await reviewTimeOffRequest(
      { organizationId: session.user.organizationId, userId: session.user.id, ipAddress: getClientIP(request) },
      { requestId, status: validatedData.status, adminNotes: validatedData.adminNotes }
    )

    return apiOk(updatedRequest, { message: `Request ${validatedData.status.toLowerCase()}` })
  } catch (error) {
    return handleRouteError(error, "Failed to update request")
  }
}
