import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { ShiftType } from "@prisma/client"
import { PositionType } from "@/types"
import { addDaysUTC, endOfWeekUTC, getTodayUTC, startOfWeekUTC, toDateString, toUTCDate } from "@/lib/timezone"

export const dynamic = "force-dynamic"

const MAX_DAYS = 31

interface OrgSettings {
  minStaffOperators?: number
  minStaffOnshoreControlRoom?: number
  minStaffingAlertEnabled?: boolean
}

interface CoverageRow {
  date: string
  shiftType: string
  ruleName: string
  required: number
  scheduled: number
  shortage: number
  crew?: { id: string; name: string }
  positionType?: string
  role?: string
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get("startDate")
    const endDateParam = searchParams.get("endDate")
    const shiftTypeFilter = searchParams.get("shiftType")
    const roleFilter = searchParams.get("role")
    const positionTypeFilter = searchParams.get("positionType")
    const crewIdFilter = searchParams.get("crewId")

    let rangeStart: Date
    let rangeEnd: Date

    if (startDateParam || endDateParam) {
      if (!startDateParam || !endDateParam) {
        return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 })
      }
      rangeStart = toUTCDate(startDateParam)
      rangeEnd = toUTCDate(endDateParam)

      if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
        return NextResponse.json({ error: "Invalid date range" }, { status: 400 })
      }
      if (rangeStart > rangeEnd) {
        return NextResponse.json({ error: "startDate must be before endDate" }, { status: 400 })
      }
    } else {
      const today = getTodayUTC()
      rangeStart = startOfWeekUTC(today)
      rangeEnd = endOfWeekUTC(today)
    }

    const dayCount = Math.floor((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
    if (dayCount > MAX_DAYS) {
      return NextResponse.json(
        { error: `Date range is too large. Please select ${MAX_DAYS} days or less.` },
        { status: 400 }
      )
    }

    const [staffingRules, organization, schedules] = await Promise.all([
      prisma.staffingRule.findMany({
        where: { organizationId: session.user.organizationId, isActive: true },
        include: { crew: { select: { id: true, name: true } } },
        orderBy: [{ priority: "desc" }, { name: "asc" }],
      }),
      prisma.organization.findUnique({
        where: { id: session.user.organizationId },
        select: { settings: true },
      }),
      prisma.schedule.findMany({
        where: {
          user: { organizationId: session.user.organizationId },
          date: { gte: rangeStart, lte: rangeEnd },
          shiftType: { in: [ShiftType.DAY, ShiftType.NIGHT] },
        },
        select: {
          date: true,
          shiftType: true,
          crewId: true,
          user: {
            select: {
              id: true,
              role: true,
              positionType: true,
              crewId: true,
            },
          },
        },
      }),
    ])

    const orgSettings = (organization?.settings || {}) as OrgSettings
    const orgRulesEnabled = orgSettings.minStaffingAlertEnabled !== false
    const minOperators = orgSettings.minStaffOperators ?? 1
    const minOnshoreControlRoom = orgSettings.minStaffOnshoreControlRoom ?? 1

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

    const schedulesByDate = new Map<string, typeof schedules>()
    for (const schedule of schedules) {
      const dateKey = toDateString(schedule.date)
      if (!schedulesByDate.has(dateKey)) {
        schedulesByDate.set(dateKey, [])
      }
      schedulesByDate.get(dateKey)!.push(schedule)
    }

    const rows: CoverageRow[] = []

    for (let i = 0; i < dayCount; i++) {
      const checkDate = addDaysUTC(rangeStart, i)
      const dateKey = toDateString(checkDate)
      const daySchedules = schedulesByDate.get(dateKey) || []

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
          filteredSchedules = filteredSchedules.filter((s) => s.user.positionType === rule.positionType)
        }

        const count = filteredSchedules.length
        rows.push({
          date: dateKey,
          shiftType: rule.shiftType,
          ruleName: rule.name,
          required: rule.minWorkers,
          scheduled: count,
          shortage: Math.max(rule.minWorkers - count, 0),
          crew: rule.crewId ? { id: rule.crewId, name: rule.crew?.name || "Crew" } : undefined,
          positionType: rule.positionType || undefined,
          role: rule.role || undefined,
        })
      }

      for (const shiftType of [ShiftType.DAY, ShiftType.NIGHT]) {
        for (const derivedRule of derivedRules) {
          const shiftSchedules = daySchedules.filter((s) => s.shiftType === shiftType)
          const matchingSchedules = shiftSchedules.filter(
            (s) => s.user.positionType === derivedRule.positionType
          )
          const count = matchingSchedules.length
          rows.push({
            date: dateKey,
            shiftType,
            ruleName: derivedRule.name,
            required: derivedRule.minWorkers,
            scheduled: count,
            shortage: Math.max(derivedRule.minWorkers - count, 0),
            positionType: derivedRule.positionType,
          })
        }
      }
    }

    const filteredRows = rows.filter((row) => {
      if (shiftTypeFilter && row.shiftType !== shiftTypeFilter) return false
      if (positionTypeFilter && row.positionType !== positionTypeFilter) return false
      if (roleFilter && row.role !== roleFilter) return false
      if (crewIdFilter) {
        return row.crew?.id === crewIdFilter
      }
      return true
    })

    filteredRows.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date)
      }
      if (a.shiftType !== b.shiftType) {
        return a.shiftType.localeCompare(b.shiftType)
      }
      return b.shortage - a.shortage
    })

    const satisfied = filteredRows.filter((row) => row.shortage === 0).length
    const unsatisfied = filteredRows.length - satisfied

    return NextResponse.json({
      success: true,
      data: {
        rangeStart: toDateString(rangeStart),
        rangeEnd: toDateString(rangeEnd),
        totalDays: dayCount,
        totalRows: filteredRows.length,
        satisfied,
        unsatisfied,
        rows: filteredRows,
      },
    })
  } catch (error) {
    console.error("Error fetching staffing coverage:", error)
    return NextResponse.json({ error: "Failed to fetch staffing coverage" }, { status: 500 })
  }
}
