import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { ShiftType } from "@prisma/client"
import { PositionType } from "@/types"
import { addDaysUTC, endOfWeekUTC, getTodayUTC, startOfWeekUTC, toDateString, toUTCDate } from "@/lib/timezone"

export const dynamic = "force-dynamic"

const MAX_DAYS = 31

interface GapWorkerSummary {
  id: string
  name: string | null
  crewId: string | null
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
}

interface OrgSettings {
  minStaffOperators?: number
  minStaffOnshoreControlRoom?: number
  minStaffingAlertEnabled?: boolean
}

function sanitizeCSVValue(value: string | null | undefined): string {
  if (!value) return ""
  let sanitized = String(value)
  if (/^[=+\-@\t\r]/.test(sanitized)) {
    sanitized = "'" + sanitized
  }
  return sanitized
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
    const format = searchParams.get("format")

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

    const [staffingRules, organization, activeWorkers] = await Promise.all([
      prisma.staffingRule.findMany({
        where: { organizationId: session.user.organizationId, isActive: true },
        include: { crew: { select: { id: true, name: true } } },
        orderBy: [{ priority: "desc" }, { name: "asc" }],
      }),
      prisma.organization.findUnique({
        where: { id: session.user.organizationId },
        select: { settings: true },
      }),
      prisma.user.findMany({
        where: { organizationId: session.user.organizationId, status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          role: true,
          positionType: true,
          crewId: true,
          crew: { select: { id: true, name: true } },
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

    const shiftTypesToCheck = new Set<ShiftType>([ShiftType.DAY, ShiftType.NIGHT])
    staffingRules.forEach((rule) => shiftTypesToCheck.add(rule.shiftType))

    const schedules = await prisma.schedule.findMany({
      where: {
        user: { organizationId: session.user.organizationId },
        date: { gte: rangeStart, lte: rangeEnd },
        shiftType: { in: Array.from(shiftTypesToCheck) },
      },
      select: {
        date: true,
        shiftType: true,
        crewId: true,
        user: {
          select: {
            id: true,
            name: true,
            role: true,
            positionType: true,
            crewId: true,
            crew: { select: { id: true, name: true } },
          },
        },
      },
    })

    const activeWorkerList = activeWorkers.map((worker) => ({
      id: worker.id,
      name: worker.name,
      role: worker.role,
      positionType: worker.positionType,
      crewId: worker.crewId,
      crewName: worker.crew?.name || null,
    }))

    const schedulesByDate = new Map<string, typeof schedules>()
    for (const schedule of schedules) {
      const dateKey = toDateString(schedule.date)
      if (!schedulesByDate.has(dateKey)) {
        schedulesByDate.set(dateKey, [])
      }
      schedulesByDate.get(dateKey)!.push(schedule)
    }

    const buildWorkerSummary = (worker: typeof activeWorkerList[number]): GapWorkerSummary => ({
      id: worker.id,
      name: worker.name,
      crewId: worker.crewId ?? null,
      crewName: worker.crewName,
      role: worker.role,
      positionType: worker.positionType,
    })

    const getAvailableWorkers = (
      criteria: { crewId?: string | null; role?: string | null; positionType?: string | null },
      scheduledIds: Set<string>
    ) => {
      return activeWorkerList.filter((worker) => {
        if (criteria.crewId && worker.crewId !== criteria.crewId) return false
        if (criteria.role && worker.role !== criteria.role) return false
        if (criteria.positionType && worker.positionType !== criteria.positionType) return false
        return !scheduledIds.has(worker.id)
      })
    }

    const gapDetails: StaffingGapDetail[] = []

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

        const scheduledWorkers = filteredSchedules.map((s) => ({
          id: s.user.id,
          name: s.user.name,
          crewId: s.user.crewId ?? null,
          crewName: s.user.crew?.name || null,
          role: s.user.role,
          positionType: s.user.positionType,
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
          gapDetails.push({
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
          })
        }
      }

      for (const shiftType of [ShiftType.DAY, ShiftType.NIGHT]) {
        for (const derivedRule of derivedRules) {
          const shiftSchedules = daySchedules.filter((s) => s.shiftType === shiftType)
          const matchingSchedules = shiftSchedules.filter(
            (s) => s.user.positionType === derivedRule.positionType
          )

          const scheduledWorkers = matchingSchedules.map((s) => ({
            id: s.user.id,
            name: s.user.name,
            crewId: s.user.crewId ?? null,
            crewName: s.user.crew?.name || null,
            role: s.user.role,
            positionType: s.user.positionType,
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
            gapDetails.push({
              date: checkDate,
              shiftType,
              shortage: derivedRule.minWorkers - count,
              required: derivedRule.minWorkers,
              scheduled: count,
              ruleName: derivedRule.name,
              positionType: derivedRule.positionType,
              scheduledWorkers,
              availableWorkers,
            })
          }
        }
      }
    }

    const filteredGaps = gapDetails.filter((gap) => {
      if (shiftTypeFilter && gap.shiftType !== shiftTypeFilter) return false
      if (positionTypeFilter && gap.positionType !== positionTypeFilter) return false
      if (roleFilter && gap.role !== roleFilter) return false
      if (crewIdFilter) {
        return gap.crew?.id === crewIdFilter
      }
      return true
    })

    filteredGaps.sort((a, b) => {
      if (a.date.getTime() !== b.date.getTime()) {
        return a.date.getTime() - b.date.getTime()
      }
      if (a.shiftType !== b.shiftType) {
        return a.shiftType.localeCompare(b.shiftType)
      }
      return b.shortage - a.shortage
    })

    if (format === "csv") {
      let csv = "Date,Shift Type,Rule,Required,Scheduled,Shortage,Crew,Position,Role,Scheduled Workers,Available Workers\n"
      for (const gap of filteredGaps) {
        const scheduledNames = gap.scheduledWorkers.map((w) => w.name || "Unnamed").join("; ")
        const availableNames = gap.availableWorkers.map((w) => w.name || "Unnamed").join("; ")
        csv += `"${sanitizeCSVValue(toDateString(gap.date))}","${sanitizeCSVValue(gap.shiftType)}","${sanitizeCSVValue(gap.ruleName)}","${sanitizeCSVValue(String(gap.required))}","${sanitizeCSVValue(String(gap.scheduled))}","${sanitizeCSVValue(String(gap.shortage))}","${sanitizeCSVValue(gap.crew?.name)}","${sanitizeCSVValue(gap.positionType)}","${sanitizeCSVValue(gap.role)}","${sanitizeCSVValue(scheduledNames)}","${sanitizeCSVValue(availableNames)}"\n`
      }

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="staffing-gaps-${toDateString(rangeStart)}-to-${toDateString(rangeEnd)}.csv"`,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        rangeStart: toDateString(rangeStart),
        rangeEnd: toDateString(rangeEnd),
        totalDays: dayCount,
        totalGaps: filteredGaps.length,
        gaps: filteredGaps,
      },
    })
  } catch (error) {
    console.error("Error fetching staffing gaps:", error)
    return NextResponse.json({ error: "Failed to fetch staffing gaps" }, { status: 500 })
  }
}
