import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { ShiftType } from "@/types"
import { getTodayUTC, addDaysUTC, startOfWeekUTC, endOfWeekUTC } from "@/lib/timezone"


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
      _organization,
      requiredCertifications,
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
              includeInStaffingCount: true,
              certifications: {
                select: { certificationTypeId: true },
              },
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

      // Certification types with schedule requirements
      prisma.certificationType.findMany({
        where: {
          organizationId,
          isActive: true,
          requireOnSchedule: true,
        },
        select: {
          id: true,
          name: true,
          minPerDayShift: true,
          minPerNightShift: true,
        },
      }),
    ])

    // Calculate staffing gaps for the week based on staffing rules
    let staffingGaps = 0
    const gapDetails: Array<{ date: Date; shiftType: string; shortage: number; positionType?: string; certificationName?: string }> = []

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
        // Filter by shift type and only include workers who should be counted
        let filteredSchedules = daySchedules.filter((s: { shiftType: string; user: { includeInStaffingCount: boolean } }) =>
          s.shiftType === rule.shiftType && s.user.includeInStaffingCount !== false
        )

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

      // Check certification-based staffing requirements (only count workers with includeInStaffingCount)
      for (const cert of requiredCertifications) {
        // Check day shift - filter to only include workers who should be counted
        const dayShiftSchedules = daySchedules.filter((s: { shiftType: string; user: { includeInStaffingCount: boolean } }) =>
          s.shiftType === ShiftType.DAY && s.user.includeInStaffingCount !== false
        )
        const dayShiftWithCert = dayShiftSchedules.filter(
          (s: { user: { certifications: Array<{ certificationTypeId: string }> } }) =>
            s.user.certifications.some(c => c.certificationTypeId === cert.id)
        )
        if (dayShiftWithCert.length < cert.minPerDayShift) {
          staffingGaps++
          gapDetails.push({
            date: checkDate,
            shiftType: ShiftType.DAY,
            shortage: cert.minPerDayShift - dayShiftWithCert.length,
            certificationName: cert.name,
          })
        }

        // Check night shift - filter to only include workers who should be counted
        const nightShiftSchedules = daySchedules.filter((s: { shiftType: string; user: { includeInStaffingCount: boolean } }) =>
          s.shiftType === ShiftType.NIGHT && s.user.includeInStaffingCount !== false
        )
        const nightShiftWithCert = nightShiftSchedules.filter(
          (s: { user: { certifications: Array<{ certificationTypeId: string }> } }) =>
            s.user.certifications.some(c => c.certificationTypeId === cert.id)
        )
        if (nightShiftWithCert.length < cert.minPerNightShift) {
          staffingGaps++
          gapDetails.push({
            date: checkDate,
            shiftType: ShiftType.NIGHT,
            shortage: cert.minPerNightShift - nightShiftWithCert.length,
            certificationName: cert.name,
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
