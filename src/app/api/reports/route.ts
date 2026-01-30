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
      crews,
      timeOffRequests,
      holidays,
      holidayTracking,
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
      // Workers
      prisma.user.findMany({
        where: { organizationId, role: "WORKER" },
        include: {
          crew: { select: { id: true, name: true, color: true } },
        },
      }) as Promise<WorkerWithCrew[]>,
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
