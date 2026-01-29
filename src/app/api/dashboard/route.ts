import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { ShiftType } from "@/types"
import { getTodayUTC, addDaysUTC, startOfWeekUTC, endOfWeekUTC } from "@/lib/timezone"

interface OrgSettings {
  minStaffOperators?: number
  minStaffingAlertEnabled?: boolean
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const organizationId = session.user.organizationId

    // If user has no organization, return empty stats
    if (!organizationId) {
      return NextResponse.json({
        success: true,
        data: {
          stats: {
            totalWorkers: 0,
            activeCrews: 0,
            onDutyToday: 0,
            pendingRequests: 0,
            upcomingShutdowns: 0,
            staffingGaps: 0,
          },
          staffingGapDetails: [],
          recentActivity: [],
          upcomingTimeOff: [],
          todayBreakdown: {
            dayShift: 0,
            nightShift: 0,
          },
          noOrganization: true,
        },
      })
    }

    const today = getTodayUTC()

    const weekStart = startOfWeekUTC(today)
    const weekEnd = endOfWeekUTC(today)

    // Get stats in parallel
    const [
      totalWorkers,
      activeCrews,
      todaySchedules,
      pendingRequests,
      upcomingShutdowns,
      weekSchedules,
      staffingRules,
      organization,
    ] = await Promise.all([
      // Total active workers
      prisma.user.count({
        where: { organizationId, status: "ACTIVE", role: "WORKER" },
      }),

      // Active crews
      prisma.crew.count({
        where: { organizationId },
      }),

      // Today's schedules
      prisma.schedule.findMany({
        where: {
          user: { organizationId },
          date: today,
          shiftType: { in: [ShiftType.DAY, ShiftType.NIGHT] },
        },
      }),

      // Pending time off requests
      prisma.timeOffRequest.count({
        where: {
          user: { organizationId },
          status: "PENDING",
        },
      }),

      // Upcoming shutdowns
      prisma.shutdown.count({
        where: {
          organizationId,
          startDate: { gte: today },
        },
      }),

      // This week's schedules for staffing analysis
      prisma.schedule.findMany({
        where: {
          user: { organizationId },
          date: { gte: weekStart, lte: weekEnd },
          shiftType: { in: [ShiftType.DAY, ShiftType.NIGHT] },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              positionType: true,
            },
          },
        },
      }),

      // Staffing rules
      prisma.staffingRule.findMany({
        where: { organizationId, isActive: true },
      }),

      // Organization settings
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { settings: true },
      }),
    ])

    // Calculate staffing gaps for the week based on staffing rules
    let staffingGaps = 0
    const gapDetails: Array<{ date: Date; shiftType: string; shortage: number; positionType?: string }> = []

    // Group schedules by date
    const schedulesByDate = new Map<string, typeof weekSchedules>()
    for (const schedule of weekSchedules) {
      const dateKey = schedule.date.toISOString().split("T")[0]
      if (!schedulesByDate.has(dateKey)) {
        schedulesByDate.set(dateKey, [])
      }
      schedulesByDate.get(dateKey)!.push(schedule)
    }

    // Check each day against staffing rules
    for (let i = 0; i < 7; i++) {
      const checkDate = addDaysUTC(weekStart, i)
      const dateKey = checkDate.toISOString().split("T")[0]
      const daySchedules = schedulesByDate.get(dateKey) || []

      // Check staffing rules
      for (const rule of staffingRules) {
        // Filter by shift type
        let filteredSchedules = daySchedules.filter((s: { shiftType: string }) => s.shiftType === rule.shiftType)

        // Filter by position type if the rule specifies one
        if (rule.positionType) {
          filteredSchedules = filteredSchedules.filter(
            (s: { user: { positionType: string } }) => s.user.positionType === rule.positionType
          )
        }

        const count = filteredSchedules.length
        if (count < rule.minWorkers) {
          staffingGaps++
          gapDetails.push({
            date: checkDate,
            shiftType: rule.shiftType,
            shortage: rule.minWorkers - count,
            positionType: rule.positionType || undefined,
          })
        }
      }
    }

    // Get recent activity
    const recentActivity = await prisma.notification.findMany({
      where: {
        user: { organizationId },
        createdAt: { gte: addDaysUTC(today, -7) },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        user: { select: { name: true } },
      },
    })

    // Get upcoming time off
    const upcomingTimeOff = await prisma.timeOffRequest.findMany({
      where: {
        user: { organizationId },
        status: "APPROVED",
        startDate: { gte: today, lte: addDaysUTC(today, 14) },
      },
      include: {
        user: { select: { id: true, name: true, crew: { select: { name: true } } } },
      },
      orderBy: { startDate: "asc" },
      take: 5,
    })

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalWorkers,
          activeCrews,
          onDutyToday: todaySchedules.length,
          pendingRequests,
          upcomingShutdowns,
          staffingGaps,
        },
        staffingGapDetails: gapDetails.slice(0, 5),
        recentActivity,
        upcomingTimeOff,
        todayBreakdown: {
          dayShift: todaySchedules.filter((s: { shiftType: string }) => s.shiftType === ShiftType.DAY).length,
          nightShift: todaySchedules.filter((s: { shiftType: string }) => s.shiftType === ShiftType.NIGHT).length,
        },
      },
    })
  } catch (error) {
    console.error("Error fetching dashboard data:", error)
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 })
  }
}
