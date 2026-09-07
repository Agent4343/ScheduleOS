import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"
import { createScheduleSchema, generateScheduleSchema } from "@/lib/validations"
import {
  generateFromAnchor,
  timeOffTypeToShiftType,
  type RotationAnchor,
  type WorkingShift,
} from "@/lib/scheduling"
import { addDaysUTC, normalizeToUTCMidnight } from "@/lib/timezone"
import { setShiftOverride } from "@/lib/services/schedules"
import { apiOk, handleRouteError } from "@/lib/api-helpers"
import { getClientIP } from "@/lib/rate-limit"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (auth.error) return auth.error
    const { session } = auth

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
    const auth = await requireAuth({ roles: ["ADMIN", "SUPERVISOR"] })
    if (auth.error) return auth.error
    const { session } = auth

    const body = await request.json()

    // Check if this is a generate request or single schedule create
    if (body.patternId) {
      return generateSchedules(request, session.user.organizationId, body)
    }

    const validatedData = createScheduleSchema.parse(body)

    // A single-day edit made by a person is an override by definition
    const schedule = await setShiftOverride(
      { organizationId: session.user.organizationId, userId: session.user.id, ipAddress: getClientIP(request) },
      {
        userId: validatedData.userId,
        date: validatedData.date,
        shiftType: validatedData.shiftType,
        customShiftCode: validatedData.customShiftCode,
        reason: validatedData.overrideReason,
        notes: validatedData.notes,
      }
    )

    return apiOk(schedule, { message: "Schedule updated" })
  } catch (error) {
    return handleRouteError(error, "Failed to create schedule")
  }
}

/** Rows per createMany call; keeps each statement well inside DB limits. */
const CREATE_BATCH_SIZE = 5000
/** Hard cap on one generation request. */
const MAX_SCHEDULE_RECORDS = 50000

async function generateSchedules(
  request: NextRequest,
  organizationId: string,
  body: unknown
) {
  const validatedData = generateScheduleSchema.parse(body)

  const startDate = normalizeToUTCMidnight(validatedData.startDate)
  const endDate = normalizeToUTCMidnight(validatedData.endDate)
  if (endDate < startDate) {
    return NextResponse.json({ error: "endDate must be on or after startDate" }, { status: 400 })
  }

  // Get rotation pattern
  const pattern = await prisma.rotationPattern.findFirst({
    where: { id: validatedData.patternId, organizationId },
  })
  if (!pattern) {
    return NextResponse.json({ error: "Invalid rotation pattern" }, { status: 400 })
  }

  // Determine which users to generate for, and which crew (if any) owns the anchor
  let userIds: string[] = []
  let crew: {
    id: string
    rotationPatternId: string | null
    rotationAnchorDate: Date | null
    anchorPhase: number
    anchorStartingShift: string | null
  } | null = null

  if (validatedData.userId) {
    const user = await prisma.user.findFirst({
      where: { id: validatedData.userId, organizationId },
      select: {
        id: true,
        crew: {
          select: {
            id: true,
            rotationPatternId: true,
            rotationAnchorDate: true,
            anchorPhase: true,
            anchorStartingShift: true,
          },
        },
      },
    })
    if (!user) {
      return NextResponse.json({ error: "Invalid user" }, { status: 400 })
    }
    userIds = [user.id]
    crew = user.crew
  } else if (validatedData.crewId) {
    crew = await prisma.crew.findFirst({
      where: { id: validatedData.crewId, organizationId },
      select: {
        id: true,
        rotationPatternId: true,
        rotationAnchorDate: true,
        anchorPhase: true,
        anchorStartingShift: true,
      },
    })
    if (!crew) {
      return NextResponse.json({ error: "Invalid crew" }, { status: 400 })
    }
    const crewUsers = await prisma.user.findMany({
      where: { crewId: crew.id, organizationId, status: "ACTIVE" },
      select: { id: true },
    })
    userIds = crewUsers.map((u) => u.id)
  } else {
    return NextResponse.json(
      { error: "Either userId or crewId is required" },
      { status: 400 }
    )
  }

  // Resolve the anchor.
  //
  // A crew that already has an anchor for this pattern keeps it, so extending or
  // regenerating a range never moves the rotation. The request's startPhase and
  // startingShift are only used when there is no anchor yet, when the crew is
  // switching to a different pattern, or when the caller explicitly asks to
  // re-anchor with `resetAnchor: true`.
  const crewAnchorApplies =
    crew !== null &&
    crew.rotationAnchorDate !== null &&
    crew.rotationPatternId === pattern.id &&
    !validatedData.resetAnchor

  const anchor: RotationAnchor = crewAnchorApplies
    ? {
        anchorDate: crew!.rotationAnchorDate!,
        anchorPhase: crew!.anchorPhase,
        anchorShift: (crew!.anchorStartingShift === "NIGHT" ? "NIGHT" : "DAY") as WorkingShift,
      }
    : {
        anchorDate: startDate,
        anchorPhase: validatedData.startPhase ?? 0,
        anchorShift: validatedData.startingShift ?? "DAY",
      }

  // Only a crew-wide generation may (re)anchor the crew. A single-worker
  // generation on an unanchored crew uses the request values without saving
  // them, so one worker's ad-hoc schedule can't redefine the whole crew.
  const shouldSaveAnchor = !crewAnchorApplies && crew !== null && !!validatedData.crewId

  const generatedSchedules = generateFromAnchor(
    {
      daysOn: pattern.daysOn,
      daysOff: pattern.daysOff,
      includesNights: pattern.includesNights,
      nightsAtStart: pattern.nightsAtStart,
      nightDays: pattern.nightDays,
      alternatesShifts: pattern.alternatesShifts,
    },
    anchor,
    startDate,
    endDate
  )

  const estimatedRecords = userIds.length * generatedSchedules.length
  if (estimatedRecords > MAX_SCHEDULE_RECORDS) {
    return NextResponse.json(
      {
        error: `Request would create ${estimatedRecords} records, which exceeds the limit of ${MAX_SCHEDULE_RECORDS}. Please reduce the date range or number of users.`,
      },
      { status: 400 }
    )
  }

  const usersWithCrews = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, crewId: true },
  })
  const userCrewMap = new Map(usersWithCrews.map((u) => [u.id, u.crewId]))

  const scheduleData = userIds.flatMap((userId) =>
    generatedSchedules.map((s) => ({
      userId,
      date: s.date,
      shiftType: s.shiftType,
      crewId: userCrewMap.get(userId) ?? null,
      isOverride: false,
    }))
  )

  // Approved time off inside the range is re-applied after regeneration, so
  // `clearOverrides` can wipe stale manual edits without un-approving leave.
  const approvedTimeOff = await prisma.timeOffRequest.findMany({
    where: {
      userId: { in: userIds },
      status: "APPROVED",
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: { userId: true, startDate: true, endDate: true, type: true },
  })

  let deletedCount = 0
  await prisma.$transaction(
    async (tx) => {
      const deleteWhere = validatedData.clearOverrides
        ? { userId: { in: userIds }, date: { gte: startDate, lte: endDate } }
        : { userId: { in: userIds }, isOverride: false, date: { gte: startDate, lte: endDate } }

      const deleteResult = await tx.schedule.deleteMany({ where: deleteWhere })
      deletedCount = deleteResult.count

      // Surviving override rows win the (userId, date) conflict via skipDuplicates
      for (let i = 0; i < scheduleData.length; i += CREATE_BATCH_SIZE) {
        await tx.schedule.createMany({
          data: scheduleData.slice(i, i + CREATE_BATCH_SIZE),
          skipDuplicates: true,
        })
      }

      for (const req of approvedTimeOff) {
        const shiftType = timeOffTypeToShiftType(req.type)
        const from = req.startDate > startDate ? req.startDate : startDate
        const to = req.endDate < endDate ? req.endDate : endDate
        for (let d = normalizeToUTCMidnight(from); d <= to; d = addDaysUTC(d, 1)) {
          await tx.schedule.upsert({
            where: { userId_date: { userId: req.userId, date: d } },
            update: { shiftType, isOverride: true, overrideReason: `Time off: ${req.type}` },
            create: {
              userId: req.userId,
              date: d,
              shiftType,
              crewId: userCrewMap.get(req.userId) ?? null,
              isOverride: true,
              overrideReason: `Time off: ${req.type}`,
            },
          })
        }
      }

      if (shouldSaveAnchor && crew) {
        await tx.crew.update({
          where: { id: crew.id },
          data: {
            rotationPatternId: pattern.id,
            rotationAnchorDate: anchor.anchorDate,
            anchorPhase: anchor.anchorPhase,
            anchorStartingShift: anchor.anchorShift,
          },
        })
      }
    },
    // Up to 50k rows across several statements; the 5s default is too tight
    // on a pooled remote database.
    { timeout: 60_000, maxWait: 10_000 }
  )

  return NextResponse.json({
    success: true,
    message: `Generated ${generatedSchedules.length} schedule days for ${userIds.length} user(s)`,
    data: {
      usersProcessed: userIds.length,
      daysGenerated: generatedSchedules.length,
      totalRecords: scheduleData.length,
      deletedRecords: deletedCount,
      timeOffReapplied: approvedTimeOff.length,
      anchor: {
        date: anchor.anchorDate.toISOString().slice(0, 10),
        phase: anchor.anchorPhase,
        startingShift: anchor.anchorShift,
        source: crewAnchorApplies ? "crew" : "request",
        savedToCrew: shouldSaveAnchor,
      },
    },
  })
}
