"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  AlertTriangle,
  CheckCircle2,
} from "lucide-react"

interface ScheduleStats {
  totalSchedules: number
  dayShifts: number
  nightShifts: number
  offDays: number
  vacationDays: number
  sickDays: number
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

  const [complianceStats, setComplianceStats] = useState<{
    operatorCompliance: number
    ocrCompliance: number
    understaffedDays: Array<{ date: string; type: "Operator" | "OCR"; actual: number; required: number }>
  }>({
    operatorCompliance: 100,
    ocrCompliance: 100,
    understaffedDays: []
  })

  const fetchReportData = useCallback(async () => {
    setIsLoading(true)
    try {
      // Fetch schedules, workers, and staffing rules
      const [schedulesRes, workersRes, rulesRes] = await Promise.all([
        fetch(`/api/schedules?startDate=${startDate}&endDate=${endDate}`),
        fetch("/api/users"),
        fetch("/api/staffing-rules?isActive=true")
      ])
      
      const schedulesData = await schedulesRes.json()
      const workersData = await workersRes.json()
      const rulesData = await rulesRes.json()

      // Process Staffing Compliance
      if (schedulesData.success && workersData.success && rulesData.success) {
        const schedules = schedulesData.data
        const workers = workersData.data
        const rules = rulesData.data

        // Default requirements if no rules set
        let minOperators = 2
        let minOCR = 1

        // Override with actual rules if found
        rules.forEach((r: any) => {
          if (r.positionType === "OPERATOR") minOperators = r.minWorkers
          if (r.positionType === "ONSHORE_CONTROL_ROOM") minOCR = r.minWorkers
        })

        const dailyCounts: Record<string, { ops: number; ocr: number }> = {}
        
        // Count staff per day
        schedules.forEach((s: any) => {
          if (s.shiftType !== "DAY" && s.shiftType !== "NIGHT") return
          const date = s.date.split("T")[0]
          if (!dailyCounts[date]) dailyCounts[date] = { ops: 0, ocr: 0 }

          // Use same matching logic as Schedule Page for consistency
          const worker = workers.find((w: any) => w.id === s.user.id)
          const posString = (s.user.position || worker?.position || "").toUpperCase()
          const crewName = (s.crew?.name || worker?.crew?.name || "").toUpperCase()
          const posType = s.user.positionType || worker?.positionType

          // 1. Check Control Room FIRST (to catch "OCR Ops" before it matches generic "Ops")
          const isOCR = posType === "ONSHORE_CONTROL_ROOM" || 
                        posString.includes("OCR") || 
                        posString.includes("CONTROL") || 
                        posString.includes("ROOM") || 
                        posString.includes("CO TRIP") || 
                        crewName.includes("OCR") ||
                        crewName.includes("CONTROL") ||
                        crewName.includes("ROOM")

          // 2. Check Operators (excluding those already matched as Control Room)
          const isOp = !isOCR && (
                        posType === "OPERATOR" || 
                        posString.includes("OPS") || 
                        posString.includes("OPERATOR") || 
                        posString.includes("TECH") ||
                        posString.includes("PRODUCTION") ||
                        crewName.includes("OPS") ||
                        crewName.includes("OPERATOR")
                      )

          if (isOCR) dailyCounts[date].ocr++
          if (isOp) dailyCounts[date].ops++
        })

        // Calculate Compliance
        const understaffed: Array<{ date: string; type: "Operator" | "OCR"; actual: number; required: number }> = []
        let totalDays = 0
        let compliantOpsDays = 0
        let compliantOCRDays = 0

        // Iterate through date range
        const start = new Date(startDate)
        const end = new Date(endDate)
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split("T")[0]
          if (dailyCounts[dateStr]) {
            totalDays++
            const counts = dailyCounts[dateStr]
            
            if (counts.ops >= minOperators) compliantOpsDays++
            else understaffed.push({ date: dateStr, type: "Operator", actual: counts.ops, required: minOperators })

            if (counts.ocr >= minOCR) compliantOCRDays++
            else understaffed.push({ date: dateStr, type: "OCR", actual: counts.ocr, required: minOCR })
          }
        }

        setComplianceStats({
          operatorCompliance: totalDays > 0 ? Math.round((compliantOpsDays / totalDays) * 100) : 100,
          ocrCompliance: totalDays > 0 ? Math.round((compliantOCRDays / totalDays) * 100) : 100,
          understaffedDays: understaffed.sort((a, b) => a.date.localeCompare(b.date))
        })
      }

      // Existing logic for basic stats...
      if (schedulesData.success) {
        // ... (rest of existing logic using schedulesData)
        const schedules = schedulesData.data
        const stats: ScheduleStats = {
          totalSchedules: schedules.length,
          dayShifts: schedules.filter((s: { shiftType: string }) => s.shiftType === "DAY").length,
          nightShifts: schedules.filter((s: { shiftType: string }) => s.shiftType === "NIGHT").length,
          offDays: schedules.filter((s: { shiftType: string }) => s.shiftType === "OFF").length,
          vacationDays: schedules.filter((s: { shiftType: string }) => s.shiftType === "VACATION").length,
          sickDays: schedules.filter((s: { shiftType: string }) => s.shiftType === "SICK").length,
        }
        setScheduleStats(stats)
      }

      // Fetch workers logic...
      if (workersData.success) {
         // ... (rest of existing worker logic)
         const workers = workersData.data
         // ... existing worker stats logic
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
      }


      // Fetch crews
      const crewsRes = await fetch("/api/crews") 
      const crewsData = await crewsRes.json()
      if (crewsData.success) {
         const crews = crewsData.data
         setCrewStats({
           totalCrews: crews.length,
           crews: crews.map((c: { id: string; name: string; color: string; _count?: { workers: number } }) => ({
             id: c.id,
             name: c.name,
             color: c.color,
             workerCount: c._count?.workers || 0,
             scheduledDays: 0,
           })),
         })
      }

    } catch (error) {
      console.error("Failed to fetch report data:", error)
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

  const totalWorkDays = scheduleStats.dayShifts + scheduleStats.nightShifts
  const workPercentage = scheduleStats.totalSchedules > 0
    ? Math.round((totalWorkDays / scheduleStats.totalSchedules) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground mt-1">
            View scheduling statistics and workforce metrics
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => window.open("/api/export?type=all", "_blank")} disabled={isLoading}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

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

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Staffing Compliance Section */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Staffing Compliance
                </CardTitle>
                <CardDescription>Percentage of shifts meeting minimum requirements</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Operators</span>
                      <span className={complianceStats.operatorCompliance < 90 ? "text-red-500 font-bold" : "text-green-600"}>
                        {complianceStats.operatorCompliance}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${complianceStats.operatorCompliance < 90 ? "bg-red-500" : "bg-green-500"}`}
                        style={{ width: `${complianceStats.operatorCompliance}%` }} 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Control Room (OCR)</span>
                      <span className={complianceStats.ocrCompliance < 90 ? "text-red-500 font-bold" : "text-green-600"}>
                        {complianceStats.ocrCompliance}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${complianceStats.ocrCompliance < 90 ? "bg-red-500" : "bg-green-500"}`}
                        style={{ width: `${complianceStats.ocrCompliance}%` }} 
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Recent Gaps
                </CardTitle>
                <CardDescription>Days with insufficient staffing</CardDescription>
              </CardHeader>
              <CardContent>
                {complianceStats.understaffedDays.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mb-2 text-green-500" />
                    <p>No staffing gaps found in this period!</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                    {complianceStats.understaffedDays.map((gap, i) => (
                      <div key={i} className="flex items-center justify-between text-sm p-2 bg-red-50 dark:bg-red-950/20 rounded border border-red-100 dark:border-red-900">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-red-500" />
                          <span>{new Date(gap.date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{gap.type}</span>
                          <span className="text-red-600 font-bold">{gap.actual}/{gap.required}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

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
                  <span>{workerStats.activeWorkers} active</span>
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
                  <span>Managing workers</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Scheduled Days</CardDescription>
                <CardTitle className="text-3xl">{scheduleStats.totalSchedules}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>In selected period</span>
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
                  <span>Days worked vs total</span>
                </div>
              </CardContent>
            </Card>
          </div>

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
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sun className="h-4 w-4 text-green-500" />
                        <span>Day Shifts</span>
                      </div>
                      <span className="font-medium">{scheduleStats.dayShifts}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{
                          width: `${scheduleStats.totalSchedules > 0 ? (scheduleStats.dayShifts / scheduleStats.totalSchedules) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Moon className="h-4 w-4 text-blue-500" />
                        <span>Night Shifts</span>
                      </div>
                      <span className="font-medium">{scheduleStats.nightShifts}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{
                          width: `${scheduleStats.totalSchedules > 0 ? (scheduleStats.nightShifts / scheduleStats.totalSchedules) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CalendarOff className="h-4 w-4 text-gray-500" />
                        <span>Off Days</span>
                      </div>
                      <span className="font-medium">{scheduleStats.offDays}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gray-400 rounded-full"
                        style={{
                          width: `${scheduleStats.totalSchedules > 0 ? (scheduleStats.offDays / scheduleStats.totalSchedules) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-emerald-500" />
                        <span>Vacation</span>
                      </div>
                      <span className="font-medium">{scheduleStats.vacationDays}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{
                          width: `${scheduleStats.totalSchedules > 0 ? (scheduleStats.vacationDays / scheduleStats.totalSchedules) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-red-500" />
                        <span>Sick Days</span>
                      </div>
                      <span className="font-medium">{scheduleStats.sickDays}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full"
                        style={{
                          width: `${scheduleStats.totalSchedules > 0 ? (scheduleStats.sickDays / scheduleStats.totalSchedules) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
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
                    {crewStats.crews.map((crew) => (
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
                          {crew.workerCount} worker{crew.workerCount !== 1 ? "s" : ""}
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
                  {Object.entries(workerStats.byPosition).map(([position, count]) => (
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
