import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { createScheduleSchema, generateScheduleSchema } from "@/lib/validations"
import { generateRotationSchedule } from "@/lib/scheduling"
import { logger } from "@/lib/logger"
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from "@/lib/rate-limit"

// Maximum date range allowed (365 days)
const MAX_DATE_RANGE_DAYS = 365

export async function GET(request: NextRequest) {
  // Rate limit API requests
  const rateLimitResult = checkRateLimit(request, RATE_LIMITS.api)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
    )
  }

  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const userId = searchParams.get("userId")
    const crewId = searchParams.get("crewId")

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      )
    }

    // Validate date range to prevent excessive queries
    const start = new Date(startDate)
    const end = new Date(endDate)
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

    if (daysDiff > MAX_DATE_RANGE_DAYS) {
      return NextResponse.json(
        { error: `Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days` },
        { status: 400 }
      )
    }

    if (daysDiff < 0) {
      return NextResponse.json(
        { error: "endDate must be after startDate" },
        { status: 400 }
      )
    }

    const schedules = await prisma.schedule.findMany({
      where: {
        user: {
          organizationId: session.user.organizationId,
        },
        date: {
          gte: start,
          lte: end,
        },
        ...(userId && { userId }),
        ...(crewId && { crewId }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            position: true,
          },
        },
        crew: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
      orderBy: [{ date: "asc" }, { user: { name: "asc" } }],
    })

    return NextResponse.json({ success: true, data: schedules })
  } catch (error) {
    logger.error("Error fetching schedules", error)
    return NextResponse.json({ error: "Failed to fetch schedules" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()

    // Check if this is a generate request or single schedule create
    if (body.patternId) {
      // Rate limit schedule generation more strictly
      const rateLimitResult = checkRateLimit(request, RATE_LIMITS.scheduleGeneration)
      if (!rateLimitResult.success) {
        return NextResponse.json(
          { error: "Too many schedule generation requests" },
          { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
        )
      }
      return generateSchedules(request, session.user.organizationId, body)
    }

    const validatedData = createScheduleSchema.parse(body)

    // Verify user belongs to organization
    const user = await prisma.user.findFirst({
      where: {
        id: validatedData.userId,
        organizationId: session.user.organizationId,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "Invalid user" }, { status: 400 })
    }

    // Upsert schedule
    const schedule = await prisma.schedule.upsert({
      where: {
        userId_date: {
          userId: validatedData.userId,
          date: new Date(validatedData.date),
        },
      },
      update: {
        shiftType: validatedData.shiftType,
        isOverride: validatedData.isOverride ?? true,
        overrideReason: validatedData.overrideReason,
        notes: validatedData.notes,
        crewId: user.crewId,
      },
      create: {
        userId: validatedData.userId,
        date: new Date(validatedData.date),
        shiftType: validatedData.shiftType,
        isOverride: validatedData.isOverride ?? false,
        overrideReason: validatedData.overrideReason,
        notes: validatedData.notes,
        crewId: user.crewId,
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json(
      { success: true, data: schedule, message: "Schedule updated" },
      { status: 200 }
    )
  } catch (error) {
    logger.error("Error creating schedule", error)

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Failed to create schedule" }, { status: 500 })
  }
}

async function generateSchedules(
  request: NextRequest,
  organizationId: string,
  body: unknown
) {
  const validatedData = generateScheduleSchema.parse(body)

  // Get rotation pattern
  const pattern = await prisma.rotationPattern.findFirst({
    where: {
      id: validatedData.patternId,
      organizationId,
    },
  })

  if (!pattern) {
    return NextResponse.json({ error: "Invalid rotation pattern" }, { status: 400 })
  }

  // Determine which users to generate for
  let userIds: string[] = []

  if (validatedData.userId) {
    // Single user
    const user = await prisma.user.findFirst({
      where: { id: validatedData.userId, organizationId },
    })
    if (!user) {
      return NextResponse.json({ error: "Invalid user" }, { status: 400 })
    }
    userIds = [validatedData.userId]
  } else if (validatedData.crewId) {
    // All users in crew
    const crewUsers = await prisma.user.findMany({
      where: { crewId: validatedData.crewId, organizationId, status: "ACTIVE" },
      select: { id: true, crewId: true },
    })
    userIds = crewUsers.map(u => u.id)
  } else {
    return NextResponse.json(
      { error: "Either userId or crewId is required" },
      { status: 400 }
    )
  }

  // Generate schedules for each user
  const generatedSchedules = generateRotationSchedule(
    {
      daysOn: pattern.daysOn,
      daysOff: pattern.daysOff,
      includesNights: pattern.includesNights,
      nightsAtStart: pattern.nightsAtStart,
      nightDays: pattern.nightDays,
    },
    new Date(validatedData.startDate),
    new Date(validatedData.endDate),
    validatedData.startPhase ?? 0
  )

  // Create schedules for all users
  const scheduleData = []
  for (const userId of userIds) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { crewId: true },
    })

    for (const schedule of generatedSchedules) {
      scheduleData.push({
        userId,
        date: schedule.date,
        shiftType: schedule.shiftType,
        crewId: user?.crewId,
        isOverride: false,
      })
    }
  }

  // Delete existing non-override schedules in range
  await prisma.schedule.deleteMany({
    where: {
      userId: { in: userIds },
      date: {
        gte: new Date(validatedData.startDate),
        lte: new Date(validatedData.endDate),
      },
      isOverride: false,
    },
  })

  // Create new schedules
  await prisma.schedule.createMany({
    data: scheduleData,
    skipDuplicates: true,
  })

  return NextResponse.json({
    success: true,
    message: `Generated ${generatedSchedules.length} schedule days for ${userIds.length} user(s)`,
    data: {
      usersProcessed: userIds.length,
      daysGenerated: generatedSchedules.length,
      totalRecords: scheduleData.length,
    },
  })
}
