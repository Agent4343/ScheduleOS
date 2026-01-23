import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { ShiftType } from "@/types"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { createScheduleSchema, generateScheduleSchema } from "@/lib/validations"
import { generateRotationSchedule } from "@/lib/scheduling"
import { normalizeToUTCMidnight } from "@/lib/timezone"

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
    // Filter by user's current crewId (not schedule's crewId) for accurate crew filtering
    const userFilter: Record<string, unknown> = {
      organizationId: organizationId,
    }
    if (crewIdParam) {
      userFilter.crewId = crewIdParam
    }

    const whereClause: Record<string, unknown> = {
      user: userFilter,
      date: {
        gte: startDate,
        lte: endDate,
      },
    }

    // Add optional filters only if provided
    if (userIdParam) {
      whereClause.userId = userIdParam
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
    return NextResponse.json({
      error: "Failed to fetch schedules",
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

    // Normalize date to UTC midnight to ensure consistent comparison
    const scheduleDate = new Date(validatedData.date)
    const normalizedDate = new Date(Date.UTC(
      scheduleDate.getUTCFullYear(),
      scheduleDate.getUTCMonth(),
      scheduleDate.getUTCDate()
    ))

    // Verify user belongs to organization
    const user = await prisma.user.findFirst({
      where: {
        id: validatedData.userId,
        organizationId: session.user.organizationId,
      },
      select: {
        id: true,
        crewId: true,
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
          date: normalizedDate,
        },
      },
      update: {
        shiftType: validatedData.shiftType,
        customShiftCode: validatedData.customShiftCode || null,
        isOverride: validatedData.isOverride ?? true,
        overrideReason: validatedData.overrideReason ?? null,
        notes: validatedData.notes ?? null,
        crewId: user.crewId,
      },
      create: {
        userId: validatedData.userId,
        date: normalizedDate,
        shiftType: validatedData.shiftType,
        customShiftCode: validatedData.customShiftCode || null,
        isOverride: validatedData.isOverride ?? false,
        overrideReason: validatedData.overrideReason ?? null,
        notes: validatedData.notes ?? null,
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

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.issues },
        { status: 400 }
      )
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({
      error: "Failed to create schedule",
      details: errorMessage
    }, { status: 500 })
  }
}

async function generateSchedules(
  request: NextRequest,
  organizationId: string,
  body: unknown
) {
  console.log("generateSchedules called with body:", JSON.stringify(body))
  const validatedData = generateScheduleSchema.parse(body)
  console.log("Validated data:", JSON.stringify(validatedData))

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
      select: { id: true },
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
      alternatesShifts: pattern.alternatesShifts,
    },
    new Date(validatedData.startDate),
    new Date(validatedData.endDate),
    validatedData.startPhase ?? 0,
    validatedData.startingShift
  )

  // Batch size limit to prevent timeouts and memory issues
  const MAX_SCHEDULE_RECORDS = 50000
  const estimatedRecords = userIds.length * generatedSchedules.length
  if (estimatedRecords > MAX_SCHEDULE_RECORDS) {
    return NextResponse.json(
      {
        error: `Request would create ${estimatedRecords} records, which exceeds the limit of ${MAX_SCHEDULE_RECORDS}. Please reduce the date range or number of users.`
      },
      { status: 400 }
    )
  }

  // Batch fetch all users' crewIds in a single query (fixes N+1 problem)
  const usersWithCrews = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, crewId: true },
  })
  const userCrewMap = new Map<string, string | null>(
    usersWithCrews.map((u: { id: string; crewId: string | null }) => [u.id, u.crewId])
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
    const crewId = userCrewMap.get(userId) ?? null

    for (const schedule of generatedSchedules) {
      scheduleData.push({
        userId,
        date: schedule.date,
        shiftType: schedule.shiftType as ShiftType,
        crewId,
        isOverride: false,
      })
    }
  }

  // Use transaction to ensure atomicity - if createMany fails, deleteMany is rolled back
  let deletedCount = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.$transaction(async (tx: any) => {
    // Delete existing schedules for the user(s) ONLY within the date range being generated
    // If clearOverrides is true, delete ALL schedules including manual edits
    // Otherwise, only delete non-override schedules (preserve manual edits)
    // CRITICAL: Normalize dates to UTC midnight to match database storage format
    const startDate = normalizeToUTCMidnight(new Date(validatedData.startDate))
    const endDate = normalizeToUTCMidnight(new Date(validatedData.endDate))

    const deleteDateRange = validatedData.replaceExisting
      ? { gte: startDate }
      : { gte: startDate, lte: endDate }

    const deleteWhere = validatedData.clearOverrides
      ? { userId: { in: userIds }, date: deleteDateRange }
      : { userId: { in: userIds }, isOverride: false, date: deleteDateRange }

    const deleteResult = await tx.schedule.deleteMany({
      where: deleteWhere,
    })
    deletedCount = deleteResult.count
    console.log(`Deleted ${deletedCount} existing schedules for users:`, userIds, validatedData.clearOverrides ? "(including overrides)" : "(excluding overrides)")

    // Create new schedules
    await tx.schedule.createMany({
      data: scheduleData,
      skipDuplicates: true,
    })
    console.log(`Created ${scheduleData.length} new schedules`)
  })

  return NextResponse.json({
    success: true,
    message: `Generated ${generatedSchedules.length} schedule days for ${userIds.length} user(s)`,
    data: {
      usersProcessed: userIds.length,
      daysGenerated: generatedSchedules.length,
      totalRecords: scheduleData.length,
      deletedRecords: deletedCount,
    },
  })
}
