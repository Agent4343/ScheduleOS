import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Type definitions for query results
type ScheduleWithRelations = {
  id: string
  userId: string
  crewId: string | null
  shiftType: string
  date: Date
  user: {
    id: string
    name: string | null
    email: string
    position: string | null
    crewId: string | null
    includeInStaffingCount: boolean
  }
  crew: { id: string; name: string; color: string } | null
}

type WorkerWithCrew = {
  id: string
  email: string
  name: string | null
  position: string | null
  status: string
  crewId: string | null
  crew: { id: string; name: string; color: string } | null
}

type CrewWithCount = {
  id: string
  name: string
  color: string
  _count: { workers: number }
}

type TimeOffRequestWithUser = {
  id: string
  type: string
  status: string
  user: { id: string; name: string | null }
}

type HolidayTrackingWithRelations = {
  id: string
  userId: string
  worked: boolean
  user: { id: string; name: string | null }
  holiday: { id: string; name: string; date: Date }
}

type HolidayRecord = {
  id: string
  name: string
  date: Date
}

type StaffingRuleRecord = {
  id: string
  name: string
  description: string | null
  shiftType: string
  minWorkers: number
  positionType: string | null
  isActive: boolean
  crew: { id: string; name: string; color: string } | null
}

type CertificationTypeRecord = {
  id: string
  name: string
  color: string
  requireOnSchedule: boolean
  minPerDayShift: number
  minPerNightShift: number
  isActive: boolean
}

type WorkerWithTraining = {
  id: string
  name: string | null
  email: string
  position: string | null
  positionType: string | null
  status: string
  includeInStaffingCount: boolean
  isControlRoomTrained: boolean
  isOilOperatorTrained: boolean
  isUtilityOperatorTrained: boolean
  isGasOperatorTrained: boolean
  crew: { id: string; name: string; color: string } | null
  certifications: { certificationTypeId: string; certificationType: { id: string; name: string; color: string } }[]
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: "Start and end dates are required" },
        { status: 400 }
      )
    }

    const organizationId = session.user.organizationId
    const start = new Date(startDate)
    const end = new Date(endDate)

    // Calculate previous period for comparison
    const periodLength = end.getTime() - start.getTime()
    const prevStart = new Date(start.getTime() - periodLength)
    const prevEnd = new Date(start.getTime() - 1)

    // Fetch all data in parallel
    const [
      schedules,
      prevSchedules,
      workers,
      workersWithTraining,
      crews,
      timeOffRequests,
      holidays,
      holidayTracking,
      staffingRules,
      certificationTypes,
    ] = await Promise.all([
      // Current period schedules
      prisma.schedule.findMany({
        where: {
          user: { organizationId },
          date: { gte: start, lte: end },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              position: true,
              positionType: true,
              crewId: true,
              includeInStaffingCount: true,
            },
          },
          crew: { select: { id: true, name: true, color: true } },
        },
      }) as Promise<ScheduleWithRelations[]>,
      // Previous period schedules for comparison
      prisma.schedule.findMany({
        where: {
          user: { organizationId },
          date: { gte: prevStart, lte: prevEnd },
        },
      }) as Promise<{ shiftType: string }[]>,
      // Workers (basic)
      prisma.user.findMany({
        where: { organizationId, role: "WORKER" },
        include: {
          crew: { select: { id: true, name: true, color: true } },
        },
      }) as Promise<WorkerWithCrew[]>,
      // Workers with training and certification info
      prisma.user.findMany({
        where: { organizationId, role: "WORKER", status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          email: true,
          position: true,
          positionType: true,
          status: true,
          includeInStaffingCount: true,
          isControlRoomTrained: true,
          isOilOperatorTrained: true,
          isUtilityOperatorTrained: true,
          isGasOperatorTrained: true,
          crew: { select: { id: true, name: true, color: true } },
          certifications: {
            select: {
              certificationTypeId: true,
              certificationType: { select: { id: true, name: true, color: true } },
            },
          },
        },
      }) as Promise<WorkerWithTraining[]>,
      // Crews
      prisma.crew.findMany({
        where: { organizationId },
        include: { _count: { select: { workers: true } } },
      }) as Promise<CrewWithCount[]>,
      // Time off requests
      prisma.timeOffRequest.findMany({
        where: {
          user: { organizationId },
          OR: [
            { startDate: { gte: start, lte: end } },
            { endDate: { gte: start, lte: end } },
            { startDate: { lte: start }, endDate: { gte: end } },
          ],
        },
        include: {
          user: { select: { id: true, name: true } },
        },
      }) as Promise<TimeOffRequestWithUser[]>,
      // Holidays in period
      prisma.holiday.findMany({
        where: {
          organizationId,
          date: { gte: start, lte: end },
        },
      }) as Promise<HolidayRecord[]>,
      // Holiday tracking
      prisma.holidayTracking.findMany({
        where: {
          user: { organizationId },
          year: start.getFullYear(),
        },
        include: {
          user: { select: { id: true, name: true } },
          holiday: { select: { id: true, name: true, date: true } },
        },
      }) as Promise<HolidayTrackingWithRelations[]>,
      // Staffing rules
      prisma.staffingRule.findMany({
        where: { organizationId, isActive: true },
        include: {
          crew: { select: { id: true, name: true, color: true } },
        },
      }) as Promise<StaffingRuleRecord[]>,
      // Certification types with schedule requirements
      prisma.certificationType.findMany({
        where: { organizationId, isActive: true },
        select: {
          id: true,
          name: true,
          color: true,
          requireOnSchedule: true,
          minPerDayShift: true,
          minPerNightShift: true,
          isActive: true,
        },
      }) as Promise<CertificationTypeRecord[]>,
    ])

    // ==================
    // SCHEDULE ANALYTICS
    // ==================
    const scheduleStats = {
      totalSchedules: schedules.length,
      dayShifts: schedules.filter((s: ScheduleWithRelations) => s.shiftType === "DAY").length,
      nightShifts: schedules.filter((s: ScheduleWithRelations) => s.shiftType === "NIGHT").length,
      offDays: schedules.filter((s: ScheduleWithRelations) => s.shiftType === "OFF").length,
      vacationDays: schedules.filter((s: ScheduleWithRelations) => s.shiftType === "VACATION").length,
      sickDays: schedules.filter((s: ScheduleWithRelations) => s.shiftType === "SICK").length,
      trainingDays: schedules.filter((s: ScheduleWithRelations) => s.shiftType === "TRAINING").length,
      leaveDays: schedules.filter((s: ScheduleWithRelations) => s.shiftType === "LEAVE").length,
      plDays: schedules.filter((s: ScheduleWithRelations) => s.shiftType === "PL_DAY" || s.shiftType === "PL_NIGHT").length,
    }

    const prevScheduleStats = {
      totalSchedules: prevSchedules.length,
      dayShifts: prevSchedules.filter((s) => s.shiftType === "DAY").length,
      nightShifts: prevSchedules.filter((s) => s.shiftType === "NIGHT").length,
      workDays: prevSchedules.filter((s) => s.shiftType === "DAY" || s.shiftType === "NIGHT").length,
    }

    // ==================
    // WORKER ANALYTICS
    // ==================
    const workerAnalytics = workers.map((worker: WorkerWithCrew) => {
      const workerSchedules = schedules.filter((s: ScheduleWithRelations) => s.userId === worker.id)
      const dayShifts = workerSchedules.filter((s: ScheduleWithRelations) => s.shiftType === "DAY").length
      const nightShifts = workerSchedules.filter((s: ScheduleWithRelations) => s.shiftType === "NIGHT").length
      const offDays = workerSchedules.filter((s: ScheduleWithRelations) => s.shiftType === "OFF").length
      const vacationDays = workerSchedules.filter((s: ScheduleWithRelations) => s.shiftType === "VACATION").length
      const sickDays = workerSchedules.filter((s: ScheduleWithRelations) => s.shiftType === "SICK").length

      return {
        id: worker.id,
        name: worker.name || worker.email,
        position: worker.position,
        crew: worker.crew,
        totalShifts: dayShifts + nightShifts,
        dayShifts,
        nightShifts,
        offDays,
        vacationDays,
        sickDays,
        totalScheduled: workerSchedules.length,
        // Night shift ratio (for fairness tracking)
        nightRatio: dayShifts + nightShifts > 0
          ? Math.round((nightShifts / (dayShifts + nightShifts)) * 100)
          : 0,
      }
    })

    // Sort by total shifts worked
    const topWorkers = [...workerAnalytics]
      .sort((a, b) => b.totalShifts - a.totalShifts)
      .slice(0, 10)

    // Workers with most sick days
    const highSickDays = [...workerAnalytics]
      .filter((w) => w.sickDays > 0)
      .sort((a, b) => b.sickDays - a.sickDays)
      .slice(0, 5)

    // Workers with most vacation days
    const highVacation = [...workerAnalytics]
      .filter((w) => w.vacationDays > 0)
      .sort((a, b) => b.vacationDays - a.vacationDays)
      .slice(0, 5)

    // Night shift fairness (who works most nights)
    const nightShiftLeaders = [...workerAnalytics]
      .filter((w) => w.totalShifts > 0)
      .sort((a, b) => b.nightRatio - a.nightRatio)
      .slice(0, 5)

    // ==================
    // CREW ANALYTICS
    // ==================
    const crewAnalytics = crews.map((crew: CrewWithCount) => {
      const crewSchedules = schedules.filter((s: ScheduleWithRelations) => s.crewId === crew.id)
      const crewWorkers = workers.filter((w: WorkerWithCrew) => w.crewId === crew.id)
      const dayShifts = crewSchedules.filter((s: ScheduleWithRelations) => s.shiftType === "DAY").length
      const nightShifts = crewSchedules.filter((s: ScheduleWithRelations) => s.shiftType === "NIGHT").length

      return {
        id: crew.id,
        name: crew.name,
        color: crew.color,
        workerCount: crew._count.workers,
        totalShifts: dayShifts + nightShifts,
        dayShifts,
        nightShifts,
        avgShiftsPerWorker: crewWorkers.length > 0
          ? Math.round((dayShifts + nightShifts) / crewWorkers.length)
          : 0,
      }
    })

    // ==================
    // TIME OFF ANALYTICS
    // ==================
    const timeOffStats = {
      total: timeOffRequests.length,
      pending: timeOffRequests.filter((r: TimeOffRequestWithUser) => r.status === "PENDING").length,
      approved: timeOffRequests.filter((r: TimeOffRequestWithUser) => r.status === "APPROVED").length,
      denied: timeOffRequests.filter((r: TimeOffRequestWithUser) => r.status === "DENIED").length,
      byType: {
        vacation: timeOffRequests.filter((r: TimeOffRequestWithUser) => r.type === "VACATION").length,
        sick: timeOffRequests.filter((r: TimeOffRequestWithUser) => r.type === "SICK").length,
        personal: timeOffRequests.filter((r: TimeOffRequestWithUser) => r.type === "PERSONAL").length,
        bereavement: timeOffRequests.filter((r: TimeOffRequestWithUser) => r.type === "BEREAVEMENT").length,
        juryDuty: timeOffRequests.filter((r: TimeOffRequestWithUser) => r.type === "JURY_DUTY").length,
        other: timeOffRequests.filter((r: TimeOffRequestWithUser) => r.type === "OTHER").length,
      },
    }

    // ==================
    // HOLIDAY FAIRNESS
    // ==================
    const holidayFairness = workers.map((worker: WorkerWithCrew) => {
      const workerTracking = holidayTracking.filter((t: HolidayTrackingWithRelations) => t.userId === worker.id)
      const holidaysWorked = workerTracking.filter((t: HolidayTrackingWithRelations) => t.worked).length
      const totalTracked = workerTracking.length

      return {
        id: worker.id,
        name: worker.name || worker.email,
        holidaysWorked,
        totalTracked,
        holidays: workerTracking.map((t: HolidayTrackingWithRelations) => ({
          name: t.holiday.name,
          worked: t.worked,
          date: t.holiday.date,
        })),
      }
    }).filter((w: { totalTracked: number }) => w.totalTracked > 0)
      .sort((a: { holidaysWorked: number }, b: { holidaysWorked: number }) => b.holidaysWorked - a.holidaysWorked)

    // ==================
    // TRENDS
    // ==================
    const currentWorkDays = scheduleStats.dayShifts + scheduleStats.nightShifts
    const prevWorkDays = prevScheduleStats.workDays
    const workDaysChange = prevWorkDays > 0
      ? Math.round(((currentWorkDays - prevWorkDays) / prevWorkDays) * 100)
      : 0

    // ==================
    // POSITION BREAKDOWN
    // ==================
    const positionStats: Record<string, { count: number; dayShifts: number; nightShifts: number }> = {}
    workers.forEach((worker: WorkerWithCrew) => {
      const pos = worker.position || "Unassigned"
      if (!positionStats[pos]) {
        positionStats[pos] = { count: 0, dayShifts: 0, nightShifts: 0 }
      }
      positionStats[pos].count++

      const workerSchedules = schedules.filter((s: ScheduleWithRelations) => s.userId === worker.id)
      positionStats[pos].dayShifts += workerSchedules.filter((s: ScheduleWithRelations) => s.shiftType === "DAY").length
      positionStats[pos].nightShifts += workerSchedules.filter((s: ScheduleWithRelations) => s.shiftType === "NIGHT").length
    })

    // ==================
    // STAFFING COMPLIANCE
    // ==================

    // Group schedules by date for compliance checking
    const schedulesByDate = new Map<string, typeof schedules>()
    for (const schedule of schedules) {
      const dateKey = schedule.date.toISOString().split("T")[0]
      if (!schedulesByDate.has(dateKey)) {
        schedulesByDate.set(dateKey, [])
      }
      schedulesByDate.get(dateKey)!.push(schedule)
    }

    // Calculate compliance for each staffing rule
    type ComplianceIssue = {
      date: string
      ruleName: string
      shiftType: string
      required: number
      actual: number
      shortage: number
      positionType?: string
      certificationName?: string
    }

    const complianceIssues: ComplianceIssue[] = []
    let totalDaysChecked = 0
    let daysInCompliance = 0

    // Get unique dates in the period
    const uniqueDates = Array.from(schedulesByDate.keys()).sort()
    totalDaysChecked = uniqueDates.length

    for (const dateKey of uniqueDates) {
      const daySchedules = schedulesByDate.get(dateKey) || []
      let dayHasIssue = false

      // Check staffing rules (only count workers with includeInStaffingCount = true)
      for (const rule of staffingRules) {
        // Filter by shift type and only include workers who should be counted
        let filteredSchedules = daySchedules.filter(
          (s) => s.shiftType === rule.shiftType && s.user.includeInStaffingCount !== false
        )

        // Filter by position type if the rule specifies one
        if (rule.positionType) {
          filteredSchedules = filteredSchedules.filter(
            (s) => (s.user as { positionType?: string }).positionType === rule.positionType
          )
        }

        const count = filteredSchedules.length
        if (count < rule.minWorkers) {
          dayHasIssue = true
          complianceIssues.push({
            date: dateKey,
            ruleName: rule.name,
            shiftType: rule.shiftType,
            required: rule.minWorkers,
            actual: count,
            shortage: rule.minWorkers - count,
            positionType: rule.positionType || undefined,
          })
        }
      }

      // Check certification requirements (only count workers with includeInStaffingCount = true)
      const requiredCerts = certificationTypes.filter((c) => c.requireOnSchedule)
      for (const cert of requiredCerts) {
        // Check day shift
        const dayShiftSchedules = daySchedules.filter(
          (s) => s.shiftType === "DAY" && s.user.includeInStaffingCount !== false
        )
        const workersWithCert = workersWithTraining.filter((w) =>
          w.certifications.some((c) => c.certificationTypeId === cert.id)
        )
        const dayShiftWithCert = dayShiftSchedules.filter((s) =>
          workersWithCert.some((w) => w.id === s.userId)
        )

        if (dayShiftWithCert.length < cert.minPerDayShift) {
          dayHasIssue = true
          complianceIssues.push({
            date: dateKey,
            ruleName: cert.name,
            shiftType: "DAY",
            required: cert.minPerDayShift,
            actual: dayShiftWithCert.length,
            shortage: cert.minPerDayShift - dayShiftWithCert.length,
            certificationName: cert.name,
          })
        }

        // Check night shift
        const nightShiftSchedules = daySchedules.filter(
          (s) => s.shiftType === "NIGHT" && s.user.includeInStaffingCount !== false
        )
        const nightShiftWithCert = nightShiftSchedules.filter((s) =>
          workersWithCert.some((w) => w.id === s.userId)
        )

        if (nightShiftWithCert.length < cert.minPerNightShift) {
          dayHasIssue = true
          complianceIssues.push({
            date: dateKey,
            ruleName: cert.name,
            shiftType: "NIGHT",
            required: cert.minPerNightShift,
            actual: nightShiftWithCert.length,
            shortage: cert.minPerNightShift - nightShiftWithCert.length,
            certificationName: cert.name,
          })
        }
      }

      // Check training coverage requirements
      // Requirement: At least ONE person on each shift must have each training type
      const trainingTypes = [
        { field: "isControlRoomTrained" as const, label: "Control Room Coverage" },
        { field: "isOilOperatorTrained" as const, label: "Oil Operator Coverage" },
        { field: "isGasOperatorTrained" as const, label: "Gas Operator Coverage" },
        { field: "isUtilityOperatorTrained" as const, label: "Utility Operator Coverage" },
      ]

      for (const shiftType of ["DAY", "NIGHT"] as const) {
        const shiftSchedules = daySchedules.filter(
          (s) => s.shiftType === shiftType && s.user.includeInStaffingCount !== false
        )

        // Only check if there are workers scheduled on this shift
        if (shiftSchedules.length > 0) {
          // Get the worker IDs on this shift
          const shiftWorkerIds = shiftSchedules.map((s) => s.userId)
          // Find the workers with their training info
          const shiftWorkers = workersWithTraining.filter((w) => shiftWorkerIds.includes(w.id))

          for (const training of trainingTypes) {
            const trainedCount = shiftWorkers.filter((w) => w[training.field]).length
            if (trainedCount < 1) {
              dayHasIssue = true
              complianceIssues.push({
                date: dateKey,
                ruleName: training.label,
                shiftType,
                required: 1,
                actual: 0,
                shortage: 1,
              })
            }
          }
        }
      }

      if (!dayHasIssue) {
        daysInCompliance++
      }
    }

    // Build compliance summary
    const complianceRate = totalDaysChecked > 0
      ? Math.round((daysInCompliance / totalDaysChecked) * 100)
      : 100

    // Workers excluded from staffing counts
    const excludedWorkers = workersWithTraining
      .filter((w) => w.includeInStaffingCount === false)
      .map((w) => ({
        id: w.id,
        name: w.name || w.email,
        position: w.position,
        crew: w.crew,
      }))

    // Workers counted in staffing
    const countedWorkers = workersWithTraining
      .filter((w) => w.includeInStaffingCount !== false)
      .map((w) => ({
        id: w.id,
        name: w.name || w.email,
        position: w.position,
        positionType: w.positionType,
        crew: w.crew,
        isControlRoomTrained: w.isControlRoomTrained,
        isOilOperatorTrained: w.isOilOperatorTrained,
        isUtilityOperatorTrained: w.isUtilityOperatorTrained,
        isGasOperatorTrained: w.isGasOperatorTrained,
        certifications: w.certifications.map((c) => ({
          id: c.certificationTypeId,
          name: c.certificationType.name,
          color: c.certificationType.color,
        })),
      }))

    // Group compliance issues by rule for summary
    const issuesByRule: Record<string, { count: number; shiftType: string; totalShortage: number }> = {}
    for (const issue of complianceIssues) {
      const key = `${issue.ruleName}-${issue.shiftType}`
      if (!issuesByRule[key]) {
        issuesByRule[key] = { count: 0, shiftType: issue.shiftType, totalShortage: 0 }
      }
      issuesByRule[key].count++
      issuesByRule[key].totalShortage += issue.shortage
    }

    const complianceData = {
      summary: {
        totalDaysChecked,
        daysInCompliance,
        daysWithIssues: totalDaysChecked - daysInCompliance,
        complianceRate,
      },
      staffingRules: staffingRules.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        shiftType: r.shiftType,
        minWorkers: r.minWorkers,
        positionType: r.positionType,
        crew: r.crew,
        issueCount: issuesByRule[`${r.name}-${r.shiftType}`]?.count || 0,
      })),
      certificationRequirements: certificationTypes
        .filter((c) => c.requireOnSchedule)
        .map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
          minPerDayShift: c.minPerDayShift,
          minPerNightShift: c.minPerNightShift,
          dayIssueCount: issuesByRule[`${c.name}-DAY`]?.count || 0,
          nightIssueCount: issuesByRule[`${c.name}-NIGHT`]?.count || 0,
        })),
      trainingCoverageRequirements: [
        {
          name: "Control Room Coverage",
          color: "#9333ea",
          description: "Backup for onshore operations",
          dayIssueCount: issuesByRule["Control Room Coverage-DAY"]?.count || 0,
          nightIssueCount: issuesByRule["Control Room Coverage-NIGHT"]?.count || 0,
        },
        {
          name: "Oil Operator Coverage",
          color: "#f59e0b",
          description: "At least 1 oil trained operator per shift",
          dayIssueCount: issuesByRule["Oil Operator Coverage-DAY"]?.count || 0,
          nightIssueCount: issuesByRule["Oil Operator Coverage-NIGHT"]?.count || 0,
        },
        {
          name: "Gas Operator Coverage",
          color: "#3b82f6",
          description: "At least 1 gas trained operator per shift",
          dayIssueCount: issuesByRule["Gas Operator Coverage-DAY"]?.count || 0,
          nightIssueCount: issuesByRule["Gas Operator Coverage-NIGHT"]?.count || 0,
        },
        {
          name: "Utility Operator Coverage",
          color: "#22c55e",
          description: "At least 1 utility trained operator per shift",
          dayIssueCount: issuesByRule["Utility Operator Coverage-DAY"]?.count || 0,
          nightIssueCount: issuesByRule["Utility Operator Coverage-NIGHT"]?.count || 0,
        },
      ],
      issues: complianceIssues.slice(0, 50), // Limit to first 50 issues
      totalIssues: complianceIssues.length,
      excludedWorkers,
      countedWorkers,
      trainingStats: {
        controlRoomTrained: countedWorkers.filter((w) => w.isControlRoomTrained).length,
        oilOperatorTrained: countedWorkers.filter((w) => w.isOilOperatorTrained).length,
        utilityOperatorTrained: countedWorkers.filter((w) => w.isUtilityOperatorTrained).length,
        gasOperatorTrained: countedWorkers.filter((w) => w.isGasOperatorTrained).length,
        totalCounted: countedWorkers.length,
        totalExcluded: excludedWorkers.length,
      },
    }

    return NextResponse.json({
      success: true,
      data: {
        period: { start: startDate, end: endDate },
        scheduleStats,
        prevScheduleStats,
        trends: {
          workDaysChange,
          totalSchedulesChange: prevScheduleStats.totalSchedules > 0
            ? Math.round(((scheduleStats.totalSchedules - prevScheduleStats.totalSchedules) / prevScheduleStats.totalSchedules) * 100)
            : 0,
        },
        workerStats: {
          total: workers.length,
          active: workers.filter((w: WorkerWithCrew) => w.status === "ACTIVE").length,
          onLeave: workers.filter((w: WorkerWithCrew) => w.status === "ON_LEAVE").length,
          byPosition: positionStats,
        },
        workerAnalytics,
        topWorkers,
        highSickDays,
        highVacation,
        nightShiftLeaders,
        crewAnalytics,
        timeOffStats,
        holidayFairness,
        holidays: holidays.map((h) => ({ id: h.id, name: h.name, date: h.date })),
        compliance: complianceData,
      },
    })
  } catch (error) {
    console.error("Reports API error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to generate report" },
      { status: 500 }
    )
  }
}
