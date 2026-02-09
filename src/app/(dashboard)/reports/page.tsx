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
  UserCheck,
  Briefcase,
  Heart,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ShieldCheck,
  ShieldAlert,
  UserX,
  GraduationCap,
  CheckCircle2,
  XCircle,
} from "lucide-react"

interface ComplianceIssue {
  date: string
  ruleName: string
  shiftType: string
  required: number
  actual: number
  shortage: number
  positionType?: string
  certificationName?: string
}

interface ComplianceData {
  summary: {
    totalDaysChecked: number
    daysInCompliance: number
    daysWithIssues: number
    complianceRate: number
  }
  staffingRules: Array<{
    id: string
    name: string
    description: string | null
    shiftType: string
    minWorkers: number
    positionType: string | null
    crew: { id: string; name: string; color: string } | null
    issueCount: number
  }>
  certificationRequirements: Array<{
    id: string
    name: string
    color: string
    minPerDayShift: number
    minPerNightShift: number
    dayIssueCount: number
    nightIssueCount: number
  }>
  trainingCoverageRequirements: Array<{
    name: string
    color: string
    description: string
    dayIssueCount: number
    nightIssueCount: number
  }>
  issues: ComplianceIssue[]
  totalIssues: number
  excludedWorkers: Array<{
    id: string
    name: string
    position: string | null
    crew: { id: string; name: string; color: string } | null
  }>
  countedWorkers: Array<{
    id: string
    name: string
    position: string | null
    positionType: string | null
    crew: { id: string; name: string; color: string } | null
    isControlRoomTrained: boolean
    isOilOperatorTrained: boolean
    isUtilityOperatorTrained: boolean
    isGasOperatorTrained: boolean
    certifications: Array<{ id: string; name: string; color: string }>
  }>
  trainingStats: {
    controlRoomTrained: number
    oilOperatorTrained: number
    utilityOperatorTrained: number
    gasOperatorTrained: number
    totalCounted: number
    totalExcluded: number
  }
}

interface ReportData {
  period: { start: string; end: string }
  scheduleStats: {
    totalSchedules: number
    dayShifts: number
    nightShifts: number
    offDays: number
    vacationDays: number
    sickDays: number
    trainingDays: number
    leaveDays: number
    plDays: number
  }
  trends: {
    workDaysChange: number
    totalSchedulesChange: number
  }
  workerStats: {
    total: number
    active: number
    onLeave: number
    byPosition: Record<string, { count: number; dayShifts: number; nightShifts: number }>
  }
  topWorkers: Array<{
    id: string
    name: string
    position: string | null
    crew: { id: string; name: string; color: string } | null
    totalShifts: number
    dayShifts: number
    nightShifts: number
  }>
  highSickDays: Array<{
    id: string
    name: string
    sickDays: number
  }>
  highVacation: Array<{
    id: string
    name: string
    vacationDays: number
  }>
  nightShiftLeaders: Array<{
    id: string
    name: string
    nightRatio: number
    nightShifts: number
    totalShifts: number
  }>
  crewAnalytics: Array<{
    id: string
    name: string
    color: string
    workerCount: number
    totalShifts: number
    dayShifts: number
    nightShifts: number
    avgShiftsPerWorker: number
  }>
  timeOffStats: {
    total: number
    pending: number
    approved: number
    denied: number
    byType: {
      vacation: number
      sick: number
      personal: number
      bereavement: number
      juryDuty: number
      other: number
    }
  }
  holidayFairness: Array<{
    id: string
    name: string
    holidaysWorked: number
    totalTracked: number
  }>
  compliance: ComplianceData
}

function TrendBadge({ value, suffix = "%" }: { value: number; suffix?: string }) {
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <Minus className="h-3 w-3" />
        No change
      </span>
    )
  }
  if (value > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-green-600">
        <ArrowUpRight className="h-3 w-3" />
        +{value}{suffix} vs prev period
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm text-red-600">
      <ArrowDownRight className="h-3 w-3" />
      {value}{suffix} vs prev period
    </span>
  )
}

function ProgressBar({
  value,
  max,
  color = "bg-primary",
  showPercent = true
}: {
  value: number
  max: number
  color?: string
  showPercent?: boolean
}) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showPercent && <span className="text-sm text-muted-foreground w-12 text-right">{percent}%</span>}
    </div>
  )
}

export default function ReportsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(1)
    return date.toISOString().split("T")[0]
  })
  const [endDate, setEndDate] = useState(() => {
    const date = new Date()
    date.setMonth(date.getMonth() + 1)
    date.setDate(0)
    return date.toISOString().split("T")[0]
  })

  const fetchReportData = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/reports?startDate=${startDate}&endDate=${endDate}`)
      const data = await res.json()
      if (data.success) {
        setReportData(data.data)
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

  const exportCSV = () => {
    if (!reportData) return

    const rows: string[][] = []

    // Header
    rows.push(["ShiftSync Report", `${startDate} to ${endDate}`])
    rows.push([])

    // Schedule Overview
    rows.push(["SCHEDULE OVERVIEW"])
    rows.push(["Metric", "Value"])
    rows.push(["Total Scheduled Days", String(reportData.scheduleStats.totalSchedules)])
    rows.push(["Day Shifts", String(reportData.scheduleStats.dayShifts)])
    rows.push(["Night Shifts", String(reportData.scheduleStats.nightShifts)])
    rows.push(["Off Days", String(reportData.scheduleStats.offDays)])
    rows.push(["Vacation Days", String(reportData.scheduleStats.vacationDays)])
    rows.push(["Sick Days", String(reportData.scheduleStats.sickDays)])
    rows.push([])

    // Top Workers
    rows.push(["TOP WORKERS BY SHIFTS"])
    rows.push(["Name", "Position", "Crew", "Total Shifts", "Day", "Night"])
    reportData.topWorkers.forEach((w) => {
      rows.push([
        w.name,
        w.position || "-",
        w.crew?.name || "-",
        String(w.totalShifts),
        String(w.dayShifts),
        String(w.nightShifts),
      ])
    })
    rows.push([])

    // Crew Analytics
    rows.push(["CREW ANALYTICS"])
    rows.push(["Crew", "Workers", "Total Shifts", "Day", "Night", "Avg per Worker"])
    reportData.crewAnalytics.forEach((c) => {
      rows.push([
        c.name,
        String(c.workerCount),
        String(c.totalShifts),
        String(c.dayShifts),
        String(c.nightShifts),
        String(c.avgShiftsPerWorker),
      ])
    })
    rows.push([])

    // Time Off
    rows.push(["TIME OFF REQUESTS"])
    rows.push(["Status", "Count"])
    rows.push(["Pending", String(reportData.timeOffStats.pending)])
    rows.push(["Approved", String(reportData.timeOffStats.approved)])
    rows.push(["Denied", String(reportData.timeOffStats.denied)])

    const csvContent = rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `shiftsync-report-${startDate}-to-${endDate}.csv`
    link.click()
  }

  const totalWorkDays = reportData
    ? reportData.scheduleStats.dayShifts + reportData.scheduleStats.nightShifts
    : 0
  const workPercentage = reportData && reportData.scheduleStats.totalSchedules > 0
    ? Math.round((totalWorkDays / reportData.scheduleStats.totalSchedules) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground mt-1">
            Workforce analytics and scheduling insights
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={exportCSV} disabled={!reportData}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Report Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
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
            <Button onClick={fetchReportData} disabled={isLoading}>
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
      ) : reportData ? (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Work Days</CardDescription>
                <CardTitle className="text-3xl">{totalWorkDays}</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendBadge value={reportData.trends.workDaysChange} />
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
                  <span>Days worked vs scheduled</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Active Workers</CardDescription>
                <CardTitle className="text-3xl">{reportData.workerStats.active}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{reportData.workerStats.onLeave} on leave</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pending Time Off</CardDescription>
                <CardTitle className="text-3xl">{reportData.timeOffStats.pending}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{reportData.timeOffStats.total} total requests</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Staffing Compliance Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {reportData.compliance.summary.complianceRate >= 90 ? (
                  <ShieldCheck className="h-5 w-5 text-green-500" />
                ) : reportData.compliance.summary.complianceRate >= 70 ? (
                  <ShieldAlert className="h-5 w-5 text-amber-500" />
                ) : (
                  <ShieldAlert className="h-5 w-5 text-red-500" />
                )}
                Staffing Compliance
              </CardTitle>
              <CardDescription>
                Minimum requirements and training compliance for the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Compliance Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className={`text-3xl font-bold ${
                    reportData.compliance.summary.complianceRate >= 90 ? "text-green-600" :
                    reportData.compliance.summary.complianceRate >= 70 ? "text-amber-600" : "text-red-600"
                  }`}>
                    {reportData.compliance.summary.complianceRate}%
                  </p>
                  <p className="text-sm text-muted-foreground">Compliance Rate</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950">
                  <p className="text-3xl font-bold text-green-600">
                    {reportData.compliance.summary.daysInCompliance}
                  </p>
                  <p className="text-sm text-muted-foreground">Days Compliant</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-950">
                  <p className="text-3xl font-bold text-red-600">
                    {reportData.compliance.summary.daysWithIssues}
                  </p>
                  <p className="text-sm text-muted-foreground">Days with Issues</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-3xl font-bold">
                    {reportData.compliance.summary.totalDaysChecked}
                  </p>
                  <p className="text-sm text-muted-foreground">Days Checked</p>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                {/* Staffing Rules */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Minimum Staffing Rules
                  </h4>
                  {reportData.compliance.staffingRules.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No staffing rules configured.</p>
                  ) : (
                    <div className="space-y-2">
                      {reportData.compliance.staffingRules.map((rule) => (
                        <div key={rule.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{rule.name}</span>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                rule.shiftType === "DAY" ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" :
                                "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                              }`}>
                                {rule.shiftType}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Min {rule.minWorkers} worker{rule.minWorkers !== 1 ? "s" : ""}
                              {rule.positionType && ` (${rule.positionType})`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {rule.issueCount === 0 ? (
                              <span className="flex items-center gap-1 text-green-600 text-sm">
                                <CheckCircle2 className="h-4 w-4" />
                                OK
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-red-600 text-sm">
                                <XCircle className="h-4 w-4" />
                                {rule.issueCount} issue{rule.issueCount !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Certification Requirements */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" />
                    Certification Requirements
                  </h4>
                  {reportData.compliance.certificationRequirements.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No certification requirements configured.</p>
                  ) : (
                    <div className="space-y-2">
                      {reportData.compliance.certificationRequirements.map((cert) => (
                        <div key={cert.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: cert.color }}
                              />
                              <span className="font-medium">{cert.name}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Day: min {cert.minPerDayShift} | Night: min {cert.minPerNightShift}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            {cert.dayIssueCount === 0 && cert.nightIssueCount === 0 ? (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle2 className="h-4 w-4" />
                                OK
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-red-600">
                                <XCircle className="h-4 w-4" />
                                {cert.dayIssueCount + cert.nightIssueCount} issue{cert.dayIssueCount + cert.nightIssueCount !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Training Coverage Requirements */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" />
                    Training Coverage Requirements
                  </h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Each shift requires at least 1 person with each training type
                  </p>
                  <div className="space-y-2">
                    {reportData.compliance.trainingCoverageRequirements?.map((training) => (
                      <div key={training.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: training.color }}
                            />
                            <span className="font-medium">{training.name}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {training.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          {training.dayIssueCount === 0 && training.nightIssueCount === 0 ? (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="h-4 w-4" />
                              OK
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-600">
                              <XCircle className="h-4 w-4" />
                              D:{training.dayIssueCount} N:{training.nightIssueCount}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Training Stats and Excluded Workers */}
              <div className="grid lg:grid-cols-2 gap-6 mt-6 pt-6 border-t">
                {/* Training Stats */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" />
                    Training Qualifications (Counted Workers)
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                      <span className="text-sm">Control Room Trained</span>
                      <span className="font-medium">
                        {reportData.compliance.trainingStats.controlRoomTrained} / {reportData.compliance.trainingStats.totalCounted}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                      <span className="text-sm">Oil Operator Trained</span>
                      <span className="font-medium">
                        {reportData.compliance.trainingStats.oilOperatorTrained} / {reportData.compliance.trainingStats.totalCounted}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                      <span className="text-sm">Utility Operator Trained</span>
                      <span className="font-medium">
                        {reportData.compliance.trainingStats.utilityOperatorTrained} / {reportData.compliance.trainingStats.totalCounted}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                      <span className="text-sm">Gas Operator Trained</span>
                      <span className="font-medium">
                        {reportData.compliance.trainingStats.gasOperatorTrained} / {reportData.compliance.trainingStats.totalCounted}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Excluded Workers */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <UserX className="h-4 w-4 text-amber-500" />
                    Workers Excluded from Staffing Counts
                    <span className="text-xs font-normal text-muted-foreground">
                      ({reportData.compliance.trainingStats.totalExcluded} total)
                    </span>
                  </h4>
                  {reportData.compliance.excludedWorkers.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                      All active workers are counted in staffing compliance.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {reportData.compliance.excludedWorkers.map((worker) => (
                        <div key={worker.id} className="flex items-center justify-between p-2 rounded bg-amber-50 dark:bg-amber-950">
                          <div>
                            <span className="font-medium">{worker.name}</span>
                            {worker.position && (
                              <span className="text-sm text-muted-foreground ml-2">({worker.position})</span>
                            )}
                          </div>
                          {worker.crew && (
                            <span
                              className="text-xs px-2 py-0.5 rounded"
                              style={{ backgroundColor: worker.crew.color + "20", color: worker.crew.color }}
                            >
                              {worker.crew.name}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    These workers are scheduled but NOT counted toward minimum staffing requirements.
                  </p>
                </div>
              </div>

              {/* Recent Compliance Issues */}
              {reportData.compliance.totalIssues > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Recent Compliance Issues
                    <span className="text-xs font-normal text-muted-foreground">
                      ({reportData.compliance.totalIssues} total)
                    </span>
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2">Date</th>
                          <th className="text-left py-2 px-2">Rule</th>
                          <th className="text-left py-2 px-2">Shift</th>
                          <th className="text-right py-2 px-2">Required</th>
                          <th className="text-right py-2 px-2">Actual</th>
                          <th className="text-right py-2 px-2">Shortage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.compliance.issues.slice(0, 10).map((issue, idx) => (
                          <tr key={idx} className="border-b last:border-0">
                            <td className="py-2 px-2">{new Date(issue.date).toLocaleDateString()}</td>
                            <td className="py-2 px-2">{issue.ruleName}</td>
                            <td className="py-2 px-2">
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                issue.shiftType === "DAY" ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" :
                                "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                              }`}>
                                {issue.shiftType}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-right">{issue.required}</td>
                            <td className="py-2 px-2 text-right">{issue.actual}</td>
                            <td className="py-2 px-2 text-right text-red-600 font-medium">-{issue.shortage}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {reportData.compliance.totalIssues > 10 && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Showing first 10 of {reportData.compliance.totalIssues} issues
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Schedule Breakdown + Crew Performance */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Schedule Breakdown
                </CardTitle>
                <CardDescription>Distribution of shift types</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4 text-amber-500" />
                      <span>Day Shifts</span>
                    </div>
                    <span className="font-medium">{reportData.scheduleStats.dayShifts}</span>
                  </div>
                  <ProgressBar
                    value={reportData.scheduleStats.dayShifts}
                    max={reportData.scheduleStats.totalSchedules}
                    color="bg-amber-500"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4 text-blue-500" />
                      <span>Night Shifts</span>
                    </div>
                    <span className="font-medium">{reportData.scheduleStats.nightShifts}</span>
                  </div>
                  <ProgressBar
                    value={reportData.scheduleStats.nightShifts}
                    max={reportData.scheduleStats.totalSchedules}
                    color="bg-blue-500"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarOff className="h-4 w-4 text-gray-400" />
                      <span>Off Days</span>
                    </div>
                    <span className="font-medium">{reportData.scheduleStats.offDays}</span>
                  </div>
                  <ProgressBar
                    value={reportData.scheduleStats.offDays}
                    max={reportData.scheduleStats.totalSchedules}
                    color="bg-gray-400"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-emerald-500" />
                      <span>Vacation</span>
                    </div>
                    <span className="font-medium">{reportData.scheduleStats.vacationDays}</span>
                  </div>
                  <ProgressBar
                    value={reportData.scheduleStats.vacationDays}
                    max={reportData.scheduleStats.totalSchedules}
                    color="bg-emerald-500"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span>Sick Days</span>
                    </div>
                    <span className="font-medium">{reportData.scheduleStats.sickDays}</span>
                  </div>
                  <ProgressBar
                    value={reportData.scheduleStats.sickDays}
                    max={reportData.scheduleStats.totalSchedules}
                    color="bg-red-500"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Crew Performance
                </CardTitle>
                <CardDescription>Shifts by crew</CardDescription>
              </CardHeader>
              <CardContent>
                {reportData.crewAnalytics.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No crews configured.{" "}
                    <a href="/crews" className="text-primary hover:underline">
                      Create a crew
                    </a>
                  </p>
                ) : (
                  <div className="space-y-4">
                    {reportData.crewAnalytics.map((crew) => (
                      <div key={crew.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: crew.color }}
                            />
                            <span className="font-medium">{crew.name}</span>
                            <span className="text-sm text-muted-foreground">
                              ({crew.workerCount} workers)
                            </span>
                          </div>
                          <span className="font-medium">{crew.totalShifts} shifts</span>
                        </div>
                        <div className="flex gap-2 text-sm">
                          <div className="flex items-center gap-1">
                            <Sun className="h-3 w-3 text-amber-500" />
                            <span>{crew.dayShifts}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Moon className="h-3 w-3 text-blue-500" />
                            <span>{crew.nightShifts}</span>
                          </div>
                          <span className="text-muted-foreground ml-auto">
                            ~{crew.avgShiftsPerWorker} per worker
                          </span>
                        </div>
                        <ProgressBar
                          value={crew.totalShifts}
                          max={Math.max(...reportData.crewAnalytics.map((c) => c.totalShifts))}
                          color="bg-primary"
                          showPercent={false}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Worker Insights */}
          <div className="grid lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Award className="h-5 w-5 text-amber-500" />
                  Top Workers by Shifts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reportData.topWorkers.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No schedule data</p>
                ) : (
                  <div className="space-y-3">
                    {reportData.topWorkers.slice(0, 5).map((worker, index) => (
                      <div key={worker.id} className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{worker.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {worker.crew?.name || "No crew"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{worker.totalShifts}</p>
                          <p className="text-xs text-muted-foreground">shifts</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Moon className="h-5 w-5 text-blue-500" />
                  Night Shift Distribution
                </CardTitle>
                <CardDescription className="text-xs">Workers with most night shifts</CardDescription>
              </CardHeader>
              <CardContent>
                {reportData.nightShiftLeaders.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No night shift data</p>
                ) : (
                  <div className="space-y-3">
                    {reportData.nightShiftLeaders.map((worker) => (
                      <div key={worker.id} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium truncate">{worker.name}</span>
                          <span className="text-sm">{worker.nightRatio}% nights</span>
                        </div>
                        <ProgressBar
                          value={worker.nightShifts}
                          max={worker.totalShifts}
                          color="bg-blue-500"
                          showPercent={false}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Heart className="h-5 w-5 text-red-500" />
                  Sick Day Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reportData.highSickDays.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No sick days recorded</p>
                ) : (
                  <div className="space-y-3">
                    {reportData.highSickDays.map((worker) => (
                      <div key={worker.id} className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">{worker.name}</span>
                        <span className="text-sm font-medium text-red-600">
                          {worker.sickDays} day{worker.sickDays !== 1 ? "s" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Time Off + Holiday Fairness */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Time Off Requests
                </CardTitle>
                <CardDescription>Request status breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950">
                    <p className="text-2xl font-bold text-amber-600">{reportData.timeOffStats.pending}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950">
                    <p className="text-2xl font-bold text-green-600">{reportData.timeOffStats.approved}</p>
                    <p className="text-xs text-muted-foreground">Approved</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950">
                    <p className="text-2xl font-bold text-red-600">{reportData.timeOffStats.denied}</p>
                    <p className="text-xs text-muted-foreground">Denied</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">By Type</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span>Vacation</span>
                      <span className="font-medium">{reportData.timeOffStats.byType.vacation}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span>Sick</span>
                      <span className="font-medium">{reportData.timeOffStats.byType.sick}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span>Personal</span>
                      <span className="font-medium">{reportData.timeOffStats.byType.personal}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span>Bereavement</span>
                      <span className="font-medium">{reportData.timeOffStats.byType.bereavement}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Holiday Fairness
                </CardTitle>
                <CardDescription>Who worked the most holidays</CardDescription>
              </CardHeader>
              <CardContent>
                {reportData.holidayFairness.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No holiday tracking data yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {reportData.holidayFairness.slice(0, 6).map((worker) => (
                      <div key={worker.id} className="flex items-center justify-between">
                        <span className="font-medium">{worker.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">
                            {worker.holidaysWorked} / {worker.totalTracked}
                          </span>
                          <div className="w-16">
                            <ProgressBar
                              value={worker.holidaysWorked}
                              max={worker.totalTracked}
                              color={worker.holidaysWorked > worker.totalTracked / 2 ? "bg-amber-500" : "bg-green-500"}
                              showPercent={false}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Position Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Workers by Position
              </CardTitle>
              <CardDescription>Headcount and shift distribution by role</CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(reportData.workerStats.byPosition).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No workers found.{" "}
                  <a href="/workers" className="text-primary hover:underline">
                    Add workers
                  </a>
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {Object.entries(reportData.workerStats.byPosition).map(([position, stats]) => (
                    <div
                      key={position}
                      className="p-4 rounded-lg bg-muted/50"
                    >
                      <p className="text-2xl font-bold">{stats.count}</p>
                      <p className="text-sm font-medium">{position}</p>
                      <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Sun className="h-3 w-3 text-amber-500" />
                          <span>{stats.dayShifts}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Moon className="h-3 w-3 text-blue-500" />
                          <span>{stats.nightShifts}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Failed to load report data. Please try again.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
