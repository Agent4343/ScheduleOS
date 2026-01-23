"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { PageHeader } from "@/components/layout/page-header"
import {
  BarChart3,
  Users,
  Calendar,
  Clock,
  TrendingUp,
  Download,
  Loader2,
  Sun,
  Moon,
  CalendarOff,
} from "lucide-react"

interface ScheduleStats {
  totalSchedules: number
  dayShifts: number
  nightShifts: number
  offDays: number
  vacationDays: number
  sickDays: number
  leaveDays: number
  trainingDays: number
  shutdownDays: number
  plDayShifts: number
  plNightShifts: number
  customDays: number
  otherDays: number
}

interface WorkerStats {
  totalWorkers: number
  activeWorkers: number
  onLeave: number
  byPosition: Record<string, number>
}

interface CrewStats {
  totalCrews: number
  crews: Array<{
    id: string
    name: string
    color: string
    workerCount: number
    scheduledDays: number
  }>
}

export default function ReportsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(1) // First of current month
    return date.toISOString().split("T")[0]
  })
  const [endDate, setEndDate] = useState(() => {
    const date = new Date()
    date.setMonth(date.getMonth() + 1)
    date.setDate(0) // Last day of current month
    return date.toISOString().split("T")[0]
  })

  const [scheduleStats, setScheduleStats] = useState<ScheduleStats>({
    totalSchedules: 0,
    dayShifts: 0,
    nightShifts: 0,
    offDays: 0,
    vacationDays: 0,
    sickDays: 0,
    leaveDays: 0,
    trainingDays: 0,
    shutdownDays: 0,
    plDayShifts: 0,
    plNightShifts: 0,
    customDays: 0,
    otherDays: 0,
  })

  const [workerStats, setWorkerStats] = useState<WorkerStats>({
    totalWorkers: 0,
    activeWorkers: 0,
    onLeave: 0,
    byPosition: {},
  })

  const [crewStats, setCrewStats] = useState<CrewStats>({
    totalCrews: 0,
    crews: [],
  })

  const fetchReportData = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const start = new Date(`${startDate}T00:00:00.000Z`)
      const end = new Date(`${endDate}T00:00:00.000Z`)

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        setErrorMessage("Please select a valid date range.")
        return
      }

      if (start > end) {
        setErrorMessage("Start date must be on or before the end date.")
        return
      }

      // Fetch schedules for date range
      const [schedulesRes, workersRes, crewsRes] = await Promise.all([
        fetch(`/api/schedules?startDate=${startDate}&endDate=${endDate}`),
        fetch("/api/users"),
        fetch("/api/crews"),
      ])

      if (!schedulesRes.ok || !workersRes.ok || !crewsRes.ok) {
        throw new Error("Failed to load report data")
      }

      const schedulesData = await schedulesRes.json()
      const workersData = await workersRes.json()
      const crewsData = await crewsRes.json()
      const crewScheduleCounts: Record<string, number> = {}

      if (schedulesData.success && schedulesData.data) {
        const schedules = schedulesData.data
        const shiftCounts = schedules.reduce((acc: Record<string, number>, schedule: { shiftType: string }) => {
          const key = schedule.shiftType || "UNKNOWN"
          acc[key] = (acc[key] || 0) + 1
          return acc
        }, {})

        schedules.forEach((schedule: { crew?: { id?: string }; crewId?: string }) => {
          const crewId = schedule.crew?.id || schedule.crewId
          if (!crewId) {
            return
          }
          crewScheduleCounts[crewId] = (crewScheduleCounts[crewId] || 0) + 1
        })

        const dayShifts = shiftCounts.DAY || 0
        const nightShifts = shiftCounts.NIGHT || 0
        const offDays = shiftCounts.OFF || 0
        const vacationDays = shiftCounts.VACATION || 0
        const sickDays = shiftCounts.SICK || 0
        const leaveDays = shiftCounts.LEAVE || 0
        const trainingDays = shiftCounts.TRAINING || 0
        const shutdownDays = shiftCounts.SHUTDOWN || 0
        const plDayShifts = shiftCounts.PL_DAY || 0
        const plNightShifts = shiftCounts.PL_NIGHT || 0
        const customDays = shiftCounts.CUSTOM || 0
        const knownTotal = dayShifts + nightShifts + offDays + vacationDays + sickDays + leaveDays + trainingDays + shutdownDays + plDayShifts + plNightShifts + customDays

        const stats: ScheduleStats = {
          totalSchedules: schedules.length,
          dayShifts,
          nightShifts,
          offDays,
          vacationDays,
          sickDays,
          leaveDays,
          trainingDays,
          shutdownDays,
          plDayShifts,
          plNightShifts,
          customDays,
          otherDays: Math.max(schedules.length - knownTotal, 0),
        }
        setScheduleStats(stats)
      } else {
        setErrorMessage("Unable to load schedule statistics for the selected range.")
      }

      if (workersData.success && workersData.data) {
        const workers = workersData.data
        const positions: Record<string, number> = {}
        workers.forEach((w: { position: string | null }) => {
          const pos = w.position || "Unassigned"
          positions[pos] = (positions[pos] || 0) + 1
        })

        setWorkerStats({
          totalWorkers: workers.length,
          activeWorkers: workers.filter((w: { status: string }) => w.status === "ACTIVE").length,
          onLeave: workers.filter((w: { status: string }) => w.status === "ON_LEAVE").length,
          byPosition: positions,
        })
      } else {
        setErrorMessage("Unable to load worker statistics.")
      }

      if (crewsData.success && crewsData.data) {
        const crews = crewsData.data
        setCrewStats({
          totalCrews: crews.length,
          crews: crews.map((c: { id: string; name: string; color: string; _count?: { workers: number } }) => ({
            id: c.id,
            name: c.name,
            color: c.color,
            workerCount: c._count?.workers || 0,
            scheduledDays: crewScheduleCounts[c.id] || 0,
          })),
        })
      } else {
        setErrorMessage("Unable to load crew statistics.")
      }
    } catch (error) {
      console.error("Failed to fetch report data:", error)
      setErrorMessage("Unable to load report data. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    fetchReportData()
  }, [fetchReportData])

  const handleRefresh = () => {
    fetchReportData()
  }

  const handleExport = () => {
    const start = new Date(`${startDate}T00:00:00.000Z`)
    const end = new Date(`${endDate}T00:00:00.000Z`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      setErrorMessage("Please select a valid date range before exporting.")
      return
    }

    const params = new URLSearchParams({
      type: "schedules",
      startDate,
      endDate,
    })
    window.location.href = `/api/export?${params.toString()}`
  }

  const nonWorkingDays = scheduleStats.offDays
    + scheduleStats.vacationDays
    + scheduleStats.sickDays
    + scheduleStats.leaveDays
    + scheduleStats.shutdownDays
  const workingDays = Math.max(scheduleStats.totalSchedules - nonWorkingDays, 0)

  const rangeStart = new Date(`${startDate}T00:00:00.000Z`)
  const rangeEnd = new Date(`${endDate}T00:00:00.000Z`)
  const totalCalendarDays = Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())
    ? 0
    : Math.max(Math.floor((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1, 0)
  const expectedWorkerDays = workerStats.activeWorkers * totalCalendarDays

  const workPercentage = expectedWorkerDays > 0
    ? Math.round((workingDays / expectedWorkerDays) * 100)
    : 0

  const coverageDelta = expectedWorkerDays - scheduleStats.totalSchedules

  const breakdownItems = [
    { key: "day", label: "Day Shifts", count: scheduleStats.dayShifts, color: "bg-green-500", textColor: "text-green-500", icon: Sun },
    { key: "night", label: "Night Shifts", count: scheduleStats.nightShifts, color: "bg-blue-500", textColor: "text-blue-500", icon: Moon },
    { key: "off", label: "Off Days", count: scheduleStats.offDays, color: "bg-gray-400", textColor: "text-gray-500", icon: CalendarOff },
    { key: "vacation", label: "Vacation", count: scheduleStats.vacationDays, color: "bg-emerald-500", textColor: "text-emerald-500", icon: Calendar },
    { key: "sick", label: "Sick Days", count: scheduleStats.sickDays, color: "bg-red-500", textColor: "text-red-500", icon: Clock },
    { key: "leave", label: "Leave", count: scheduleStats.leaveDays, color: "bg-amber-500", textColor: "text-amber-500", icon: Calendar },
    { key: "training", label: "Training", count: scheduleStats.trainingDays, color: "bg-purple-500", textColor: "text-purple-500", icon: TrendingUp },
    { key: "shutdown", label: "Shutdown", count: scheduleStats.shutdownDays, color: "bg-orange-500", textColor: "text-orange-500", icon: CalendarOff },
    { key: "pl-day", label: "PL Day", count: scheduleStats.plDayShifts, color: "bg-teal-500", textColor: "text-teal-500", icon: Sun },
    { key: "pl-night", label: "PL Night", count: scheduleStats.plNightShifts, color: "bg-indigo-500", textColor: "text-indigo-500", icon: Moon },
    { key: "custom", label: "Custom", count: scheduleStats.customDays, color: "bg-slate-500", textColor: "text-slate-500", icon: Calendar },
    { key: "other", label: "Other", count: scheduleStats.otherDays, color: "bg-neutral-500", textColor: "text-neutral-500", icon: BarChart3 },
  ]

  const sortedCrews = [...crewStats.crews].sort((a, b) => {
    if (b.workerCount !== a.workerCount) {
      return b.workerCount - a.workerCount
    }
    return a.name.localeCompare(b.name)
  })

  const positionEntries = Object.entries(workerStats.byPosition).sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1]
    }
    return a[0].localeCompare(b[0])
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="View scheduling statistics and workforce metrics"
        actions={(
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleExport}
            disabled={isLoading}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        )}
      />

      {/* Date Range Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Date Range</CardTitle>
          <CardDescription>Select the period for schedule statistics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Button onClick={handleRefresh} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Update Report"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Report error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Workers</CardDescription>
                <CardTitle className="text-3xl">{workerStats.totalWorkers}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>
                    {workerStats.activeWorkers} active
                    {workerStats.onLeave > 0 ? ` • ${workerStats.onLeave} on leave` : ""}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Crews</CardDescription>
                <CardTitle className="text-3xl">{crewStats.totalCrews}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>Managing {workerStats.totalWorkers} workers</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Work Days</CardDescription>
                <CardTitle className="text-3xl">{workingDays}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {expectedWorkerDays > 0
                      ? `${expectedWorkerDays} worker-days possible`
                      : "In selected period"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Work Utilization</CardDescription>
                <CardTitle className="text-3xl">{workPercentage}%</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  <span>Days worked vs possible</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {expectedWorkerDays > 0 && coverageDelta !== 0 ? (
            <Alert variant="warning">
              <AlertTitle>Schedule coverage mismatch</AlertTitle>
              <AlertDescription>
                {coverageDelta > 0
                  ? `${coverageDelta} worker-days are missing from the schedule for this period.`
                  : `${Math.abs(coverageDelta)} worker-days exceed the expected total. Check for duplicate schedules.`}
              </AlertDescription>
            </Alert>
          ) : null}

          {/* Schedule Breakdown */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Schedule Breakdown
                </CardTitle>
                <CardDescription>Distribution of shift types in selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {breakdownItems
                    .filter((item) => item.count > 0 || ["day", "night", "off", "vacation", "sick"].includes(item.key))
                    .map((item) => {
                      const Icon = item.icon
                      const width = scheduleStats.totalSchedules > 0
                        ? (item.count / scheduleStats.totalSchedules) * 100
                        : 0
                      return (
                        <div key={item.key} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Icon className={`h-4 w-4 ${item.textColor}`} />
                              <span>{item.label}</span>
                            </div>
                            <span className="font-medium">{item.count}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${item.color} rounded-full`}
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              </CardContent>
            </Card>

            {/* Crew Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Crew Summary
                </CardTitle>
                <CardDescription>Workers per crew</CardDescription>
              </CardHeader>
              <CardContent>
                {crewStats.crews.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No crews configured yet.{" "}
                    <a href="/crews" className="text-primary hover:underline">
                      Create a crew
                    </a>
                  </p>
                ) : (
                  <div className="space-y-3">
                    {sortedCrews.map((crew) => (
                      <div
                        key={crew.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: crew.color }}
                          />
                          <span className="font-medium">{crew.name}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {crew.workerCount} worker{crew.workerCount !== 1 ? "s" : ""} • {crew.scheduledDays} scheduled day{crew.scheduledDays !== 1 ? "s" : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Workers by Position */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Workers by Position
              </CardTitle>
              <CardDescription>Distribution of workers across positions</CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(workerStats.byPosition).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No workers found.{" "}
                  <a href="/workers" className="text-primary hover:underline">
                    Add workers
                  </a>
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {positionEntries.map(([position, count]) => (
                    <div
                      key={position}
                      className="p-4 rounded-lg bg-muted/50 text-center"
                    >
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-sm text-muted-foreground">{position}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
