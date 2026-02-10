import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { getTodayUTC, toUTCDate } from "@/lib/timezone"

const POSITION_LABELS: Record<string, string> = {
  OPERATOR: "Operator",
  ONSHORE_CONTROL_ROOM: "Control Room",
  OTHER: "Other Staff",
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get("date")
    const targetDate = dateParam ? toUTCDate(dateParam) : getTodayUTC()

    // Fetch all needed data in parallel
    const [schedules, staffingRules, timeOffRequests, allWorkers] = await Promise.all([
      // Today's schedules with user details
      prisma.schedule.findMany({
        where: {
          user: { organizationId },
          date: targetDate,
          shiftType: { in: ["DAY", "NIGHT"] },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              positionType: true,
              includeInStaffingCount: true,
              crew: { select: { id: true, name: true, color: true } },
            },
          },
        },
      }),

      // Active staffing rules
      prisma.staffingRule.findMany({
        where: { organizationId, isActive: true },
        include: {
          crew: { select: { id: true, name: true, color: true } },
        },
        orderBy: [{ priority: "desc" }, { name: "asc" }],
      }),

      // Approved time-off overlapping this date
      prisma.timeOffRequest.findMany({
        where: {
          user: { organizationId },
          status: "APPROVED",
          startDate: { lte: targetDate },
          endDate: { gte: targetDate },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              positionType: true,
              crew: { select: { name: true } },
            },
          },
        },
      }),

      // All active workers for total counts
      prisma.user.findMany({
        where: {
          organizationId,
          status: "ACTIVE",
          role: "WORKER",
        },
        select: {
          id: true,
          name: true,
          positionType: true,
          includeInStaffingCount: true,
          crew: { select: { id: true, name: true, color: true } },
        },
      }),
    ])

    // Build coverage data for each shift type
    const buildShiftCoverage = (shiftType: "DAY" | "NIGHT") => {
      const shiftSchedules = schedules.filter(s => s.shiftType === shiftType)
      const countableSchedules = shiftSchedules.filter(s => s.user.includeInStaffingCount !== false)

      // Group workers on shift by position type
      const positionGroups: Record<string, Array<{
        id: string
        name: string
        crew: string | null
        crewColor: string | null
      }>> = {}

      for (const s of countableSchedules) {
        const pt = s.user.positionType || "OTHER"
        if (!positionGroups[pt]) positionGroups[pt] = []
        positionGroups[pt].push({
          id: s.user.id,
          name: s.user.name || "Unknown",
          crew: s.user.crew?.name || null,
          crewColor: s.user.crew?.color || null,
        })
      }

      // Ensure all position types appear even if nobody is working
      for (const pt of Object.keys(POSITION_LABELS)) {
        if (!positionGroups[pt]) positionGroups[pt] = []
      }

      // Calculate required workers per position from staffing rules
      const positionRequirements: Record<string, number> = {}
      for (const rule of staffingRules) {
        if (rule.shiftType !== shiftType) continue
        const pt = rule.positionType || "_ALL"
        positionRequirements[pt] = (positionRequirements[pt] || 0) + rule.minWorkers
      }

      // Build position breakdown
      const positions = Object.keys(POSITION_LABELS).map(pt => {
        const actual = positionGroups[pt]?.length || 0
        const required = positionRequirements[pt] || 0
        // If no specific rule for this position, check the "_ALL" rules
        const totalRequired = required > 0 ? required : 0
        const status: "met" | "warning" | "critical" =
          totalRequired === 0 ? "met" :
          actual >= totalRequired ? "met" :
          actual >= Math.ceil(totalRequired * 0.75) ? "warning" : "critical"

        return {
          positionType: pt,
          label: POSITION_LABELS[pt] || pt,
          actual,
          required: totalRequired,
          status,
          workers: positionGroups[pt] || [],
        }
      })

      // Per-rule compliance
      const rules = staffingRules
        .filter(r => r.shiftType === shiftType)
        .map(rule => {
          let matchingSchedules = countableSchedules
          if (rule.positionType) {
            matchingSchedules = matchingSchedules.filter(
              s => s.user.positionType === rule.positionType
            )
          }
          if (rule.crewId) {
            matchingSchedules = matchingSchedules.filter(
              s => s.user.crew?.id === rule.crewId
            )
          }

          const actual = matchingSchedules.length
          const status: "met" | "critical" = actual >= rule.minWorkers ? "met" : "critical"

          return {
            id: rule.id,
            name: rule.name,
            minWorkers: rule.minWorkers,
            maxVacation: rule.maxVacation,
            actual,
            shortage: Math.max(0, rule.minWorkers - actual),
            status,
            positionType: rule.positionType,
            positionLabel: rule.positionType ? POSITION_LABELS[rule.positionType] || rule.positionType : "All Positions",
            crew: rule.crew,
          }
        })

      return {
        totalOnDuty: shiftSchedules.length,
        totalCountable: countableSchedules.length,
        positions,
        rules,
      }
    }

    const dayCoverage = buildShiftCoverage("DAY")
    const nightCoverage = buildShiftCoverage("NIGHT")

    // Overall summary
    const allRules = [...dayCoverage.rules, ...nightCoverage.rules]
    const rulesMet = allRules.filter(r => r.status === "met").length
    const rulesNotMet = allRules.filter(r => r.status === "critical").length

    // Workforce totals by position
    const workforceTotals = Object.keys(POSITION_LABELS).map(pt => ({
      positionType: pt,
      label: POSITION_LABELS[pt],
      total: allWorkers.filter(w => (w.positionType || "OTHER") === pt).length,
      countable: allWorkers.filter(w => (w.positionType || "OTHER") === pt && w.includeInStaffingCount !== false).length,
    }))

    // Time off impact
    const timeOffToday = timeOffRequests.map(r => ({
      id: r.user.id,
      name: r.user.name || "Unknown",
      positionType: r.user.positionType || "OTHER",
      positionLabel: POSITION_LABELS[r.user.positionType || "OTHER"] || "Other",
      crew: r.user.crew?.name || null,
    }))

    return NextResponse.json({
      success: true,
      data: {
        date: targetDate.toISOString().split("T")[0],
        coverage: {
          DAY: dayCoverage,
          NIGHT: nightCoverage,
        },
        summary: {
          totalRules: allRules.length,
          rulesMet,
          rulesNotMet,
          overallStatus: rulesNotMet === 0 ? "all_met" : rulesNotMet >= allRules.length / 2 ? "critical" : "some_gaps",
        },
        workforce: workforceTotals,
        timeOffToday,
      },
    })
  } catch (error) {
    console.error("Error fetching staffing coverage:", error)
    return NextResponse.json({ error: "Failed to fetch staffing coverage" }, { status: 500 })
  }
}
