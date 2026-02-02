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
  certifications?: string[]
}

interface StaffingGapDetail {
  date: Date
  shiftType: string
  shortage: number
  required: number
  scheduled: number
  ruleName: string
  ruleType?: "staffing" | "certification"
  crew?: { id: string; name: string }
  positionType?: string
  role?: string
  certificationName?: string
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

    const [staffingRules, organization, activeWorkers, requiredCertifications, userCertifications] = await Promise.all([
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
      // Fetch certifications that require minimum staff on schedule
      prisma.certificationType.findMany({
        where: {
          organizationId: session.user.organizationId,
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
      // Fetch all user certifications to know who has what
      prisma.userCertification.findMany({
        where: {
          user: { organizationId: session.user.organizationId, status: "ACTIVE" },
        },
        select: {
          userId: true,
          certificationTypeId: true,
          expiresAt: true,
        },
      }),
    ])

    // Build a map of userId -> Set of valid (non-expired) certificationTypeIds
    const userCertMap = new Map<string, Set<string>>()
    const today = new Date()
    for (const uc of userCertifications) {
      // Skip expired certifications
      if (uc.expiresAt && uc.expiresAt < today) continue

      if (!userCertMap.has(uc.userId)) {
        userCertMap.set(uc.userId, new Set())
      }
      userCertMap.get(uc.userId)!.add(uc.certificationTypeId)
    }

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
            ruleType: "staffing",
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
              ruleType: "staffing",
              positionType: derivedRule.positionType,
              scheduledWorkers,
              availableWorkers,
            })
          }
        }
      }

      // Check certification requirements for each shift
      for (const shiftType of [ShiftType.DAY, ShiftType.NIGHT]) {
        for (const cert of requiredCertifications) {
          const minRequired = shiftType === ShiftType.DAY ? cert.minPerDayShift : cert.minPerNightShift

          // Skip if no minimum required for this shift
          if (minRequired <= 0) continue

          // Get all schedules for this shift
          const shiftSchedules = daySchedules.filter((s) => s.shiftType === shiftType)

          // Count workers who have this certification (and it's not expired)
          const certifiedScheduledWorkers = shiftSchedules.filter((s) => {
            const userCerts = userCertMap.get(s.user.id)
            return userCerts?.has(cert.id)
          })

          const certifiedCount = certifiedScheduledWorkers.length

          if (certifiedCount < minRequired) {
            // Build list of scheduled workers with this cert
            const scheduledWithCert = certifiedScheduledWorkers.map((s) => ({
              id: s.user.id,
              name: s.user.name,
              crewId: s.user.crewId ?? null,
              crewName: s.user.crew?.name || null,
              role: s.user.role,
              positionType: s.user.positionType,
              certifications: [cert.name],
            }))

            // Find available workers who have this certification and aren't scheduled
            const scheduledIds = new Set(shiftSchedules.map((s) => s.user.id))
            const availableWithCert = activeWorkerList
              .filter((worker) => {
                const userCerts = userCertMap.get(worker.id)
                return userCerts?.has(cert.id) && !scheduledIds.has(worker.id)
              })
              .map((worker) => ({
                id: worker.id,
                name: worker.name,
                crewId: worker.crewId ?? null,
                crewName: worker.crewName,
                role: worker.role,
                positionType: worker.positionType,
                certifications: [cert.name],
              }))

            gapDetails.push({
              date: checkDate,
              shiftType,
              shortage: minRequired - certifiedCount,
              required: minRequired,
              scheduled: certifiedCount,
              ruleName: `Certification: ${cert.name}`,
              ruleType: "certification",
              certificationName: cert.name,
              scheduledWorkers: scheduledWithCert,
              availableWorkers: availableWithCert,
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
      let csv = "Date,Shift Type,Rule,Rule Type,Required,Scheduled,Shortage,Crew,Position,Role,Certification,Scheduled Workers,Available Workers\n"
      for (const gap of filteredGaps) {
        const scheduledNames = gap.scheduledWorkers.map((w) => w.name || "Unnamed").join("; ")
        const availableNames = gap.availableWorkers.map((w) => w.name || "Unnamed").join("; ")
        csv += `"${sanitizeCSVValue(toDateString(gap.date))}","${sanitizeCSVValue(gap.shiftType)}","${sanitizeCSVValue(gap.ruleName)}","${sanitizeCSVValue(gap.ruleType)}","${sanitizeCSVValue(String(gap.required))}","${sanitizeCSVValue(String(gap.scheduled))}","${sanitizeCSVValue(String(gap.shortage))}","${sanitizeCSVValue(gap.crew?.name)}","${sanitizeCSVValue(gap.positionType)}","${sanitizeCSVValue(gap.role)}","${sanitizeCSVValue(gap.certificationName)}","${sanitizeCSVValue(scheduledNames)}","${sanitizeCSVValue(availableNames)}"\n`
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
