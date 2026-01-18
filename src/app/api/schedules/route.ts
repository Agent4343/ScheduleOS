import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { ShiftType } from "@/types"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { createScheduleSchema, generateScheduleSchema } from "@/lib/validations"
import { generateRotationSchedule } from "@/lib/scheduling"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const organizationId = session.user.organizationId

    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get("startDate")
    const endDateParam = searchParams.get("endDate")
    const userIdParam = searchParams.get("userId")
    const crewIdParam = searchParams.get("crewId")

    if (!startDateParam || !endDateParam) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      )
    }

    // Parse dates - ensure they're valid
    const startDate = new Date(startDateParam + "T00:00:00.000Z")
    const endDate = new Date(endDateParam + "T23:59:59.999Z")

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      )
    }

    // Build the where clause explicitly to avoid Prisma issues
    const whereClause: Record<string, unknown> = {
      user: {
        organizationId: organizationId,
      },
      date: {
        gte: startDate,
        lte: endDate,
      },
    }

    // Add optional filters only if provided
    if (userIdParam) {
      whereClause.userId = userIdParam
    }
    if (crewIdParam) {
      whereClause.crewId = crewIdParam
    }

    const schedules = await prisma.schedule.findMany({
      where: whereClause,
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
      orderBy: { date: "asc" },
    })

    return NextResponse.json({ success: true, data: schedules })
  } catch (error) {
    console.error("Error fetching schedules:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const errorStack = error instanceof Error ? error.stack : undefined
    return NextResponse.json({
      error: "Failed to fetch schedules",
      details: errorMessage,
      stack: process.env.NODE_ENV === "development" ? errorStack : undefined,
    }, { status: 500 })
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
        customShiftCode: validatedData.customShiftCode || null,
        isOverride: validatedData.isOverride ?? true,
        overrideReason: validatedData.overrideReason,
        notes: validatedData.notes,
        crewId: user.crewId,
      },
      create: {
        userId: validatedData.userId,
        date: new Date(validatedData.date),
        shiftType: validatedData.shiftType,
        customShiftCode: validatedData.customShiftCode || null,
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
    console.error("Error creating schedule:", error)

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data", details: error },
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
    userIds = crewUsers.map((u: { id: string }) => u.id)
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
    validatedData.startPhase ?? 0,
    validatedData.startingShift
  )

  // Create schedules for all users
  const scheduleData: Array<{
    userId: string
    date: Date
    shiftType: string
    crewId: string | null
    isOverride: boolean
  }> = []
  for (const userId of userIds) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { crewId: true },
    })

    for (const schedule of generatedSchedules) {
      scheduleData.push({
        userId,
        date: schedule.date,
        shiftType: schedule.shiftType as ShiftType,
        crewId: user?.crewId ?? null,
        isOverride: false,
      })
    }
  }

  // Use transaction to ensure atomicity - if createMany fails, deleteMany is rolled back
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.$transaction(async (tx: any) => {
    // Delete ALL existing non-override schedules for the user(s)
    // This ensures the old schedule is completely replaced when regenerating
    await tx.schedule.deleteMany({
      where: {
        userId: { in: userIds },
        isOverride: false,
      },
    })

    // Create new schedules
    await tx.schedule.createMany({
      data: scheduleData,
      skipDuplicates: true,
    })
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
