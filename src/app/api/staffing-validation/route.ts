import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

interface StaffingGap {
  date: string
  position: {
    id: string
    name: string
    code: string | null
    category: string | null
    shiftType: string
  }
  required: number
  scheduled: number
  gap: number
  workers: Array<{
    id: string
    name: string
    isBackfill: boolean
  }>
  backfillAvailable: Array<{
    id: string
    name: string
    qualification: string
  }>
}

interface DailyStaffing {
  date: string
  dayOfWeek: string
  positions: Array<{
    position: {
      id: string
      name: string
      code: string | null
      category: string | null
      shiftType: string
      minStaffing: number
      maxStaffing: number
    }
    scheduled: number
    workers: Array<{
      id: string
      name: string
      shiftType: string
      isBackfill: boolean
      backfillRole: string | null
    }>
    status: "ok" | "understaffed" | "overstaffed"
    backfillsAvailable: Array<{
      id: string
      name: string
      qualification: string
    }>
  }>
  hasGaps: boolean
  totalGaps: number
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      )
    }

    // Parse dates
    const start = new Date(startDate)
    const end = new Date(endDate)

    // Fetch all positions for the organization
    const positions = await prisma.position.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    })

    // Fetch all users with their qualifications
    const users = await prisma.user.findMany({
      where: {
        organizationId: session.user.organizationId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        primaryPosition: true,
        isCCRQualified: true,
        isPSCapable: true,
        isPLCapable: true,
        qualifications: true,
      },
    })

    // Fetch all schedules for the date range
    const schedules = await prisma.schedule.findMany({
      where: {
        user: {
          organizationId: session.user.organizationId,
        },
        date: {
          gte: start,
          lte: end,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            primaryPosition: true,
            isCCRQualified: true,
            isPSCapable: true,
            isPLCapable: true,
          },
        },
      },
    })

    // Group schedules by date
    const schedulesByDate = new Map<string, typeof schedules>()
    for (const schedule of schedules) {
      const dateKey = schedule.date.toISOString().split("T")[0]
      if (!schedulesByDate.has(dateKey)) {
        schedulesByDate.set(dateKey, [])
      }
      schedulesByDate.get(dateKey)!.push(schedule)
    }

    // Analyze each day
    const dailyStaffing: DailyStaffing[] = []
    const gaps: StaffingGap[] = []
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

    const currentDate = new Date(start)
    while (currentDate <= end) {
      const dateKey = currentDate.toISOString().split("T")[0]
      const daySchedules = schedulesByDate.get(dateKey) || []
      const dayOfWeek = dayNames[currentDate.getUTCDay()]

      const positionAnalysis: DailyStaffing["positions"] = []
      let hasGaps = false
      let totalGaps = 0

      for (const position of positions) {
        // Determine which shift types match this position
        const matchingShiftTypes = getMatchingShiftTypes(position.shiftType)

        // Find workers scheduled for this position's shift type
        const workersForPosition = daySchedules.filter((s) => {
          const matchesShift = matchingShiftTypes.includes(s.shiftType)
          const matchesPosition =
            s.user.primaryPosition === position.name ||
            s.backfillRole === position.code ||
            s.backfillRole === position.name
          return matchesShift && matchesPosition
        })

        // Also count workers on generic day/night shifts if no specific position match
        const genericWorkers = daySchedules.filter((s) => {
          const matchesShift = matchingShiftTypes.includes(s.shiftType)
          const hasNoSpecificPosition = !s.user.primaryPosition
          return matchesShift && hasNoSpecificPosition && !workersForPosition.includes(s)
        })

        const allWorkersForPosition = [...workersForPosition]

        // Find available backfills (workers who are working but could fill this role)
        const backfillsAvailable: DailyStaffing["positions"][0]["backfillsAvailable"] = []

        if (allWorkersForPosition.length < position.minStaffing) {
          // Find workers on shift who have the required qualifications
          for (const schedule of daySchedules) {
            // Skip if already assigned to this position
            if (allWorkersForPosition.some((w) => w.userId === schedule.userId)) continue

            // Check if this worker can backfill based on position requirements
            const canBackfill = checkBackfillQualification(
              schedule.user,
              position,
              schedule.shiftType
            )

            if (canBackfill.qualified) {
              backfillsAvailable.push({
                id: schedule.user.id,
                name: schedule.user.name || "Unknown",
                qualification: canBackfill.reason,
              })
            }
          }
        }

        const scheduled = allWorkersForPosition.length
        const gap = Math.max(0, position.minStaffing - scheduled)

        if (gap > 0) {
          hasGaps = true
          totalGaps += gap

          gaps.push({
            date: dateKey,
            position: {
              id: position.id,
              name: position.name,
              code: position.code,
              category: position.category,
              shiftType: position.shiftType,
            },
            required: position.minStaffing,
            scheduled,
            gap,
            workers: allWorkersForPosition.map((w) => ({
              id: w.user.id,
              name: w.user.name || "Unknown",
              isBackfill: w.isBackfill,
            })),
            backfillAvailable: backfillsAvailable,
          })
        }

        positionAnalysis.push({
          position: {
            id: position.id,
            name: position.name,
            code: position.code,
            category: position.category,
            shiftType: position.shiftType,
            minStaffing: position.minStaffing,
            maxStaffing: position.maxStaffing,
          },
          scheduled,
          workers: allWorkersForPosition.map((w) => ({
            id: w.user.id,
            name: w.user.name || "Unknown",
            shiftType: w.shiftType,
            isBackfill: w.isBackfill,
            backfillRole: w.backfillRole,
          })),
          status:
            scheduled < position.minStaffing
              ? "understaffed"
              : scheduled > position.maxStaffing
                ? "overstaffed"
                : "ok",
          backfillsAvailable,
        })
      }

      dailyStaffing.push({
        date: dateKey,
        dayOfWeek,
        positions: positionAnalysis,
        hasGaps,
        totalGaps,
      })

      currentDate.setUTCDate(currentDate.getUTCDate() + 1)
    }

    // Summary statistics
    const summary = {
      totalDays: dailyStaffing.length,
      daysWithGaps: dailyStaffing.filter((d) => d.hasGaps).length,
      totalGaps: gaps.length,
      gapsByPosition: positions.map((p) => ({
        position: p.name,
        gapCount: gaps.filter((g) => g.position.id === p.id).length,
      })),
    }

    return NextResponse.json({
      success: true,
      data: {
        summary,
        gaps,
        dailyStaffing,
      },
    })
  } catch (error) {
    console.error("Error validating staffing:", error)
    return NextResponse.json({ error: "Failed to validate staffing" }, { status: 500 })
  }
}

// Helper to get matching shift types for a position's shift type setting
function getMatchingShiftTypes(positionShiftType: string): string[] {
  switch (positionShiftType) {
    case "day":
      return ["DAY", "OCR_DAY", "CCR_DAY", "PS", "PL_DAY"]
    case "night":
      return ["NIGHT", "OCR_NIGHT", "CCR_NIGHT", "PL_NIGHT"]
    case "24hr":
      return ["DAY", "NIGHT", "OCR_DAY", "OCR_NIGHT", "CCR_DAY", "CCR_NIGHT", "PS", "PL_DAY", "PL_NIGHT"]
    default:
      return ["DAY", "NIGHT"]
  }
}

// Helper to check if a worker can backfill a position
function checkBackfillQualification(
  user: {
    primaryPosition: string | null
    isCCRQualified: boolean
    isPSCapable: boolean
    isPLCapable: boolean
  },
  position: {
    name: string
    code: string | null
    requiredQualifications: unknown
  },
  currentShiftType: string
): { qualified: boolean; reason: string } {
  const posName = position.name.toLowerCase()
  const posCode = position.code?.toLowerCase() || ""

  // Check for Production Supervisor backfill
  if (posName.includes("supervisor") || posCode === "ps") {
    if (user.isPSCapable) {
      return { qualified: true, reason: "PS Capable" }
    }
  }

  // Check for Production Lead backfill
  if (posName.includes("lead") || posCode.includes("pl")) {
    if (user.isPLCapable) {
      return { qualified: true, reason: "PL Capable" }
    }
  }

  // Check for CCR positions
  if (posName.includes("ccr") || posCode.includes("ccr")) {
    if (user.isCCRQualified) {
      return { qualified: true, reason: "CCR Qualified" }
    }
  }

  // Check for OCR positions - generally any ops tech can fill
  if (posName.includes("ocr") || posCode.includes("ocr")) {
    // Most workers can potentially fill OCR if on shift
    return { qualified: true, reason: "On Shift" }
  }

  return { qualified: false, reason: "" }
}
