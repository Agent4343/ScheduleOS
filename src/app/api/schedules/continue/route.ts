import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { generateRotationSchedule } from "@/lib/scheduling"
import { normalizeToUTCMidnight } from "@/lib/timezone"
import { ShiftType } from "@/types"

interface RotationPatternData {
  id: string
  daysOn: number
  daysOff: number
  includesNights: boolean
  nightsAtStart: boolean
  nightDays: number
  alternatesShifts: boolean
}

interface WorkerWithCrewPattern {
  id: string
  name: string | null
  email: string
  crewId: string | null
  crew: {
    id: string
    currentPhase: number
    rotationPattern: RotationPatternData | null
  } | null
}

const continueScheduleSchema = z.object({
  sourceYear: z.number().int().min(2020).max(2100),
  targetYear: z.number().int().min(2020).max(2100),
  crewId: z.string().optional(),
  clearOverrides: z.boolean().default(false),
})

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
    const validatedData = continueScheduleSchema.parse(body)
    const { sourceYear, targetYear, crewId, clearOverrides } = validatedData

    if (targetYear <= sourceYear) {
      return NextResponse.json(
        { error: "Target year must be after source year" },
        { status: 400 }
      )
    }

    const organizationId = session.user.organizationId

    // Get all active workers, optionally filtered by crew
    const workersFilter: Record<string, unknown> = {
      organizationId,
      status: "ACTIVE",
    }
    if (crewId) {
      workersFilter.crewId = crewId
    }

    const workers = await prisma.user.findMany({
      where: workersFilter,
      include: {
        crew: {
          include: {
            rotationPattern: true,
          },
        },
      },
    })

    if (workers.length === 0) {
      return NextResponse.json(
        { error: "No active workers found" },
        { status: 400 }
      )
    }

    // Filter workers who have a crew with a rotation pattern
    const workersWithPattern = workers.filter(
      (w: WorkerWithCrewPattern) => w.crew?.rotationPattern
    )

    if (workersWithPattern.length === 0) {
      return NextResponse.json(
        { error: "No workers found with crew rotation patterns. Please assign workers to crews with rotation patterns first." },
        { status: 400 }
      )
    }

    // Define target year date range
    const targetStartDate = new Date(Date.UTC(targetYear, 0, 1)) // Jan 1
    const targetEndDate = new Date(Date.UTC(targetYear, 11, 31)) // Dec 31

    // Calculate schedules for each worker
    const allScheduleData: Array<{
      userId: string
      date: Date
      shiftType: string
      crewId: string | null
      isOverride: boolean
    }> = []

    const skippedWorkers: string[] = []

    for (const worker of workersWithPattern) {
      const pattern = worker.crew!.rotationPattern!
      const totalCycleDays = pattern.daysOn + pattern.daysOff

      // Find the last schedule for this worker in the source year to determine phase
      const lastScheduleOfSourceYear = await prisma.schedule.findFirst({
        where: {
          userId: worker.id,
          date: {
            gte: new Date(Date.UTC(sourceYear, 0, 1)),
            lte: new Date(Date.UTC(sourceYear, 11, 31)),
          },
        },
        orderBy: { date: "desc" },
      })

      let startPhase = 0
      let startingShift: "DAY" | "NIGHT" = "DAY"

      if (lastScheduleOfSourceYear) {
        // Calculate the phase based on the last scheduled date
        const lastDate = normalizeToUTCMidnight(lastScheduleOfSourceYear.date)

        // Get the phase on the last scheduled day by looking at the shift type
        const lastShiftType = lastScheduleOfSourceYear.shiftType

        // For the last scheduled day, determine what phase it was
        // We need to work backwards from the pattern
        let lastPhase = 0

        // Look at the last few schedules to determine the pattern phase
        const recentSchedules = await prisma.schedule.findMany({
          where: {
            userId: worker.id,
            date: {
              gte: new Date(Date.UTC(sourceYear, 0, 1)),
              lte: new Date(Date.UTC(sourceYear, 11, 31)),
            },
          },
          orderBy: { date: "desc" },
          take: totalCycleDays + 5, // Get enough to see a full cycle
        })

        if (recentSchedules.length >= totalCycleDays) {
          // Count consecutive working days at the end to determine phase
          let workingDays = 0
          let offDays = 0
          let sawOff = false

          for (const sched of recentSchedules) {
            const isWorking = sched.shiftType === "DAY" || sched.shiftType === "NIGHT" ||
                            sched.shiftType === "PL_DAY" || sched.shiftType === "PL_NIGHT"
            const isOff = sched.shiftType === "OFF"

            if (!sawOff && isWorking) {
              workingDays++
              if (sched.shiftType === "NIGHT" || sched.shiftType === "PL_NIGHT") {
                startingShift = "NIGHT"
              } else {
                startingShift = "DAY"
              }
            } else if (isOff) {
              sawOff = true
              offDays++
            } else if (sawOff) {
              break
            }
          }

          // Determine the phase based on where we are in the cycle
          if (sawOff) {
            // We're in an off period, count from the start
            lastPhase = pattern.daysOn + offDays - 1
          } else {
            // We're in a working period
            lastPhase = workingDays - 1
          }
        }

        // Calculate the phase for Jan 1 of target year
        // Days from last schedule to Jan 1 of target year
        const daysToTargetStart = Math.floor(
          (targetStartDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
        )

        startPhase = (lastPhase + daysToTargetStart) % totalCycleDays

        // Determine starting shift for alternating patterns
        if (pattern.alternatesShifts) {
          // Count how many complete cycles from last schedule to target start
          const completeCycles = Math.floor(daysToTargetStart / totalCycleDays)
          const lastWasNight = lastShiftType === "NIGHT" || lastShiftType === "PL_NIGHT"
          // If odd number of cycles, flip the shift
          startingShift = (completeCycles % 2 === 0)
            ? (lastWasNight ? "NIGHT" : "DAY")
            : (lastWasNight ? "DAY" : "NIGHT")
        }
      } else {
        // No schedules found for source year, use crew's current phase
        startPhase = worker.crew!.currentPhase
        skippedWorkers.push(worker.name || worker.email || worker.id)
      }

      // Generate schedules for the target year
      const generatedSchedules = generateRotationSchedule(
        {
          daysOn: pattern.daysOn,
          daysOff: pattern.daysOff,
          includesNights: pattern.includesNights,
          nightsAtStart: pattern.nightsAtStart,
          nightDays: pattern.nightDays,
          alternatesShifts: pattern.alternatesShifts,
        },
        targetStartDate,
        targetEndDate,
        startPhase,
        startingShift
      )

      // Add to batch
      for (const schedule of generatedSchedules) {
        allScheduleData.push({
          userId: worker.id,
          date: schedule.date,
          shiftType: schedule.shiftType as ShiftType,
          crewId: worker.crewId,
          isOverride: false,
        })
      }
    }

    // Check batch size
    const MAX_SCHEDULE_RECORDS = 50000
    if (allScheduleData.length > MAX_SCHEDULE_RECORDS) {
      return NextResponse.json(
        {
          error: `Request would create ${allScheduleData.length} records, which exceeds the limit of ${MAX_SCHEDULE_RECORDS}. Please reduce the number of workers or use crew filtering.`
        },
        { status: 400 }
      )
    }

    // Execute in transaction
    const userIds = workersWithPattern.map((w: WorkerWithCrewPattern) => w.id)
    let deletedCount = 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(async (tx: any) => {
      // Delete existing schedules for target year
      const deleteWhere = clearOverrides
        ? { userId: { in: userIds }, date: { gte: targetStartDate, lte: targetEndDate } }
        : { userId: { in: userIds }, isOverride: false, date: { gte: targetStartDate, lte: targetEndDate } }

      const deleteResult = await tx.schedule.deleteMany({
        where: deleteWhere,
      })
      deletedCount = deleteResult.count

      // Create new schedules
      await tx.schedule.createMany({
        data: allScheduleData,
        skipDuplicates: true,
      })
    })

    return NextResponse.json({
      success: true,
      message: `Continued schedules for ${workersWithPattern.length} workers into ${targetYear}`,
      data: {
        workersProcessed: workersWithPattern.length,
        totalRecords: allScheduleData.length,
        deletedRecords: deletedCount,
        skippedWorkers: skippedWorkers.length > 0 ? skippedWorkers : undefined,
      },
    })
  } catch (error) {
    console.error("Error continuing schedules:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.issues },
        { status: 400 }
      )
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({
      error: "Failed to continue schedules",
      details: errorMessage
    }, { status: 500 })
  }
}
