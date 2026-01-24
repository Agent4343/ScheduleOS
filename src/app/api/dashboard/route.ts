import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { ShiftType } from "@/types"
import { PositionType } from "@prisma/client"
import { getTodayUTC, addDaysUTC } from "@/lib/timezone"

export const dynamic = "force-dynamic"

interface OrgSettings {
  minStaffOperators?: number
  minStaffOnshoreControlRoom?: number
  minStaffingAlertEnabled?: boolean
}

interface GapWorkerSummary {
  id: string
  name: string | null
  crewName: string | null
  role: string
  positionType: string
}

interface StaffingGapDetail {
  date: Date
  shiftType: string
  shortage: number
  required: number
  scheduled: number
  ruleName: string
  crew?: { id: string; name: string }
  positionType?: string
  role?: string
  scheduledWorkers: GapWorkerSummary[]
  availableWorkers: GapWorkerSummary[]
  eligibility?: {
    activeCount: number
    crewMatchCount?: number
    roleMatchCount?: number
    positionMatchCount?: number
    eligibleCount: number
  }
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

    const rangeStart = today
    const rangeEnd = addDaysUTC(today, 20)

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
      activeWorkers,
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
          date: { gte: rangeStart, lte: rangeEnd },
          shiftType: { in: [ShiftType.DAY, ShiftType.NIGHT] },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              role: true,
              positionType: true,
              position: true,
              status: true,
              crewId: true,
              crew: { select: { id: true, name: true } },
            },
          },
        },
      }),

      // Staffing rules
      prisma.staffingRule.findMany({
        where: { organizationId, isActive: true },
        include: {
          crew: { select: { id: true, name: true } },
        },
      }),

      // Organization settings
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { settings: true },
      }),
      // Active workers for staffing gap details
      prisma.user.findMany({
        where: { organizationId, status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          role: true,
          positionType: true,
          position: true,
          crewId: true,
          crew: { select: { id: true, name: true } },
        },
      }),
    ])

    // Calculate staffing gaps for the week
    const gapDetails: StaffingGapDetail[] = []

    // Get organization settings for position-based minimums
    const orgSettings = (organization?.settings || {}) as OrgSettings
    const minOperators = orgSettings.minStaffOperators ?? 1
    const minOnshoreControlRoom = orgSettings.minStaffOnshoreControlRoom ?? 1

    const resolvePositionType = (worker: { positionType?: PositionType | null; position?: string | null }) => {
      if (worker.positionType && worker.positionType !== PositionType.OTHER) {
        return worker.positionType
      }
      const positionText = (worker.position || "").toLowerCase()
      if (positionText.includes("operator")) return PositionType.OPERATOR
      if (positionText.includes("onshore") || positionText.includes("control room")) {
        return PositionType.ONSHORE_CONTROL_ROOM
      }
      return worker.positionType ?? null
    }

    const activeWorkerList = activeWorkers.map((worker) => ({
      id: worker.id,
      name: worker.name,
      crewName: worker.crew?.name || null,
      role: worker.role,
      positionType: resolvePositionType(worker),
      crewId: worker.crewId,
      position: worker.position ?? null,
    }))

    const orgRulesEnabled = orgSettings.minStaffingAlertEnabled !== false
    const derivedRules = orgRulesEnabled
      ? [
          {
            name: "Minimum Operators",
            positionType: PositionType.OPERATOR,
            minWorkers: minOperators,
          },
          {
            name: "Minimum Onshore Control Room",
            positionType: PositionType.ONSHORE_CONTROL_ROOM,
            minWorkers: minOnshoreControlRoom,
          },
        ]
      : []

    // Group schedules by date
    const schedulesByDate = new Map<string, typeof weekSchedules>()
    for (const schedule of weekSchedules) {
      const dateKey = schedule.date.toISOString().split("T")[0]
      if (!schedulesByDate.has(dateKey)) {
        schedulesByDate.set(dateKey, [])
      }
      schedulesByDate.get(dateKey)!.push(schedule)
    }

    // Check each day against staffing rules and position-based minimums
    const daysToCheck = 21
    for (let i = 0; i < daysToCheck; i++) {
      const checkDate = addDaysUTC(rangeStart, i)
      const dateKey = checkDate.toISOString().split("T")[0]
      const daySchedules = schedulesByDate.get(dateKey) || []

      const addGapDetail = (detail: StaffingGapDetail) => {
        gapDetails.push(detail)
      }

      const buildWorkerSummary = (worker: typeof activeWorkerList[number]): GapWorkerSummary => ({
        id: worker.id,
        name: worker.name,
        crewName: worker.crewName,
        role: worker.role,
        positionType: worker.positionType || "OTHER",
      })

      const getAvailableWorkers = (criteria: { crewId?: string | null; role?: string | null; positionType?: string | null }, scheduledIds: Set<string>) => {
        return activeWorkerList.filter((worker) => {
          if (criteria.crewId && worker.crewId !== criteria.crewId) return false
          if (criteria.role && worker.role !== criteria.role) return false
          if (criteria.positionType && worker.positionType !== criteria.positionType) return false
          return !scheduledIds.has(worker.id)
        })
      }

      const getEligibilitySummary = (criteria: { crewId?: string | null; role?: string | null; positionType?: string | null }) => {
        const activeCount = activeWorkerList.length
        const crewMatch = criteria.crewId
          ? activeWorkerList.filter((worker) => worker.crewId === criteria.crewId)
          : activeWorkerList
        const roleMatch = criteria.role
          ? crewMatch.filter((worker) => worker.role === criteria.role)
          : crewMatch
        const positionMatch = criteria.positionType
          ? roleMatch.filter((worker) => worker.positionType === criteria.positionType)
          : roleMatch

        return {
          activeCount,
          crewMatchCount: criteria.crewId ? crewMatch.length : undefined,
          roleMatchCount: criteria.role ? roleMatch.length : undefined,
          positionMatchCount: criteria.positionType ? positionMatch.length : undefined,
          eligibleCount: positionMatch.length,
        }
      }

      // Check staffing rules
      for (const rule of staffingRules) {
        let filteredSchedules = daySchedules.filter((s) => s.shiftType === rule.shiftType)

        if (rule.crewId) {
          filteredSchedules = filteredSchedules.filter(
            (s) => (s.crewId || s.user.crewId) === rule.crewId
          )
        }
        if (rule.role) {
          filteredSchedules = filteredSchedules.filter((s) => s.user.role === rule.role)
        }
        if (rule.positionType) {
          filteredSchedules = filteredSchedules.filter(
            (s) => resolvePositionType(s.user) === rule.positionType
          )
        }

        const scheduledWorkers = filteredSchedules.map((s) => ({
          id: s.user.id,
          name: s.user.name,
          crewName: s.user.crew?.name || null,
          role: s.user.role,
          positionType: resolvePositionType(s.user) || PositionType.OTHER,
        }))
        const scheduledIds = new Set(scheduledWorkers.map((w) => w.id))
        const availableWorkers = getAvailableWorkers(
          {
            crewId: rule.crewId,
            role: rule.role ?? null,
            positionType: rule.positionType ?? null,
          },
          scheduledIds
        ).map(buildWorkerSummary)

        const count = filteredSchedules.length
        if (count < rule.minWorkers) {
          addGapDetail({
            date: checkDate,
            shiftType: rule.shiftType,
            shortage: rule.minWorkers - count,
            required: rule.minWorkers,
            scheduled: count,
            ruleName: rule.name,
            crew: rule.crewId ? { id: rule.crewId, name: rule.crew?.name || "Crew" } : undefined,
            positionType: rule.positionType || undefined,
            role: rule.role || undefined,
            scheduledWorkers,
            availableWorkers,
            eligibility: getEligibilitySummary({
              crewId: rule.crewId ?? null,
              role: rule.role ?? null,
              positionType: rule.positionType ?? null,
            }),
          })
        }
      }

      // Derived rules from org settings (position minimums)
      const workShifts = [ShiftType.DAY, ShiftType.NIGHT]
      for (const shiftType of workShifts) {
        for (const derivedRule of derivedRules) {
          const shiftSchedules = daySchedules.filter((s) => s.shiftType === shiftType)
          const matchingSchedules = shiftSchedules.filter(
            (s) => resolvePositionType(s.user) === derivedRule.positionType
          )

          const scheduledWorkers = matchingSchedules.map((s) => ({
            id: s.user.id,
            name: s.user.name,
            crewName: s.user.crew?.name || null,
            role: s.user.role,
            positionType: resolvePositionType(s.user) || PositionType.OTHER,
          }))
          const scheduledIds = new Set(scheduledWorkers.map((w) => w.id))
          const availableWorkers = getAvailableWorkers(
            {
              positionType: derivedRule.positionType,
            },
            scheduledIds
          ).map(buildWorkerSummary)

          const count = matchingSchedules.length
          if (count < derivedRule.minWorkers) {
            addGapDetail({
              date: checkDate,
              shiftType,
              shortage: derivedRule.minWorkers - count,
              required: derivedRule.minWorkers,
              scheduled: count,
              ruleName: derivedRule.name,
              positionType: derivedRule.positionType,
              scheduledWorkers,
              availableWorkers,
              eligibility: getEligibilitySummary({
                positionType: derivedRule.positionType,
              }),
            })
          }
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

    gapDetails.sort((a, b) => {
      if (a.date.getTime() !== b.date.getTime()) {
        return a.date.getTime() - b.date.getTime()
      }
      if (a.shiftType !== b.shiftType) {
        return a.shiftType.localeCompare(b.shiftType)
      }
      return b.shortage - a.shortage
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
          staffingGaps: gapDetails.length,
        },
        staffingGapDetails: gapDetails.slice(0, 20),
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
