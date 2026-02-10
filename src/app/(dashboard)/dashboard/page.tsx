"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Users,
  Users2,
  Calendar,
  Clock,
  AlertTriangle,
  CalendarOff,
  Sun,
  Moon,
  TrendingUp,
  ShieldAlert,
  Bell,
  CheckCircle,
  Award,
  UserPlus,
  Building,
  ChevronDown,
  ChevronUp,
  Minus,
  RefreshCw,
} from "lucide-react"
import { GettingStartedChecklist } from "@/components/onboarding/getting-started-checklist"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useRouter } from "next/navigation"

interface DashboardStats {
  totalWorkers: number
  activeCrews: number
  onDutyToday: number
  pendingRequests: number
  upcomingShutdowns: number
  staffingGaps: number
}

// Labels for position types
const POSITION_TYPE_LABELS: Record<string, string> = {
  OPERATOR: "Operator",
  ONSHORE_CONTROL_ROOM: "Control Room",
  OTHER: "Staff",
}

// Staffing coverage types
interface CoveragePosition {
  positionType: string
  label: string
  actual: number
  required: number
  status: "met" | "warning" | "critical"
  workers: Array<{ id: string; name: string; crew: string | null; crewColor: string | null }>
}

interface CoverageRule {
  id: string
  name: string
  minWorkers: number
  maxVacation: number
  actual: number
  shortage: number
  status: "met" | "critical"
  positionType: string | null
  positionLabel: string
  crew: { id: string; name: string; color: string } | null
}

interface ShiftCoverage {
  totalOnDuty: number
  totalCountable: number
  positions: CoveragePosition[]
  rules: CoverageRule[]
}

interface WorkforceTotal {
  positionType: string
  label: string
  total: number
  countable: number
}

interface StaffingCoverageData {
  date: string
  coverage: {
    DAY: ShiftCoverage
    NIGHT: ShiftCoverage
  }
  summary: {
    totalRules: number
    rulesMet: number
    rulesNotMet: number
    overallStatus: "all_met" | "some_gaps" | "critical"
  }
  workforce: WorkforceTotal[]
  timeOffToday: Array<{
    id: string
    name: string
    positionType: string
    positionLabel: string
    crew: string | null
  }>
}

interface StaffingGapDetail {
  date: Date
  shiftType: string
  shortage: number
  positionType?: string
  certificationName?: string
}

interface RecentActivity {
  id: string
  type: string
  title: string
  message: string
  createdAt: string
  user: { name: string }
}

interface TransferRequest {
  id: string
  status: string
  role: string
  message: string | null
  expiresAt: string
  organization: {
    id: string
    name: string
  }
  createdBy: {
    id: string
    name: string | null
    email: string
  }
}

interface DashboardData {
  stats: DashboardStats
  staffingGapDetails: StaffingGapDetail[]
  upcomingTimeOff: Array<{
    id: string
    startDate: string
    endDate: string
    user: { name: string; crew: { name: string } | null }
  }>
  recentActivity: RecentActivity[]
  todayBreakdown: {
    dayShift: number
    nightShift: number
  }
}

// Staffing Coverage Panel Component
function StaffingCoveragePanel({ coverageData, onRefresh }: { coverageData: StaffingCoverageData | null; onRefresh: () => void }) {
  const [expandedShift, setExpandedShift] = useState<"DAY" | "NIGHT" | null>("DAY")
  const [showWorkers, setShowWorkers] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    await onRefresh()
    setRefreshing(false)
  }

  if (!coverageData) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          No staffing rules configured. Add rules in Settings to track coverage.
        </CardContent>
      </Card>
    )
  }

  const { coverage, summary, workforce, timeOffToday } = coverageData
  const hasRules = summary.totalRules > 0

  const statusColors = {
    all_met: "border-green-500/50 bg-green-50 dark:bg-green-950/20",
    some_gaps: "border-amber-500/50 bg-amber-50 dark:bg-amber-950/20",
    critical: "border-red-500/50 bg-red-50 dark:bg-red-950/20",
  }

  const statusIcons = {
    all_met: <CheckCircle className="h-5 w-5 text-green-600" />,
    some_gaps: <AlertTriangle className="h-5 w-5 text-amber-600" />,
    critical: <ShieldAlert className="h-5 w-5 text-red-600" />,
  }

  const statusLabels = {
    all_met: "All Requirements Met",
    some_gaps: "Some Gaps Detected",
    critical: "Critical Shortages",
  }

  const renderProgressBar = (actual: number, required: number, status: string) => {
    if (required === 0) return null
    const pct = Math.min(100, (actual / required) * 100)
    const barColor =
      status === "met" ? "bg-green-500" :
      status === "warning" ? "bg-amber-500" : "bg-red-500"

    return (
      <div className="w-full bg-muted rounded-full h-2.5 mt-1">
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    )
  }

  const renderShiftSection = (shiftType: "DAY" | "NIGHT", shiftData: ShiftCoverage) => {
    const isExpanded = expandedShift === shiftType
    const icon = shiftType === "DAY" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
    const label = shiftType === "DAY" ? "Day Shift" : "Night Shift"
    const criticalRules = shiftData.rules.filter(r => r.status === "critical")

    return (
      <div className="border rounded-lg overflow-hidden">
        {/* Shift header - clickable to expand */}
        <button
          onClick={() => setExpandedShift(isExpanded ? null : shiftType)}
          className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-accent/50 transition-colors touch-action-manipulation min-h-[44px]"
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <Badge variant={shiftType === "DAY" ? "day" : "night"} className="text-xs">
              {icon}
              <span className="ml-1">{label}</span>
            </Badge>
            <span className="text-sm font-medium">{shiftData.totalOnDuty} on duty</span>
          </div>
          <div className="flex items-center gap-2">
            {criticalRules.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {criticalRules.length} below min
              </Badge>
            )}
            {criticalRules.length === 0 && shiftData.rules.length > 0 && (
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                All met
              </Badge>
            )}
            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="border-t p-3 sm:p-4 space-y-4">
            {/* Position type breakdown */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Coverage by Position
              </h4>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {shiftData.positions.map(pos => {
                  const hasRequirement = pos.required > 0
                  const bgColor =
                    !hasRequirement ? "bg-muted/30" :
                    pos.status === "met" ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" :
                    pos.status === "warning" ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800" :
                    "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"

                  return (
                    <div key={pos.positionType} className={`rounded-lg border p-3 ${bgColor}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{pos.label}</span>
                        <div className="flex items-center gap-1">
                          <span className={`text-lg font-bold ${
                            !hasRequirement ? "text-foreground" :
                            pos.status === "met" ? "text-green-700 dark:text-green-400" :
                            pos.status === "warning" ? "text-amber-700 dark:text-amber-400" :
                            "text-red-700 dark:text-red-400"
                          }`}>
                            {pos.actual}
                          </span>
                          {hasRequirement && (
                            <>
                              <span className="text-muted-foreground text-sm">/</span>
                              <span className="text-sm text-muted-foreground">{pos.required}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {hasRequirement && renderProgressBar(pos.actual, pos.required, pos.status)}
                      {!hasRequirement && pos.actual > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">No minimum set</p>
                      )}
                      {hasRequirement && pos.status === "critical" && (
                        <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-1">
                          Need {pos.required - pos.actual} more
                        </p>
                      )}
                      {/* Expandable worker list */}
                      {pos.workers.length > 0 && (
                        <button
                          onClick={() => setShowWorkers(showWorkers === `${shiftType}-${pos.positionType}` ? null : `${shiftType}-${pos.positionType}`)}
                          className="text-xs text-primary hover:underline mt-2 touch-action-manipulation"
                        >
                          {showWorkers === `${shiftType}-${pos.positionType}` ? "Hide" : "Show"} workers ({pos.workers.length})
                        </button>
                      )}
                      {showWorkers === `${shiftType}-${pos.positionType}` && (
                        <div className="mt-2 space-y-1">
                          {pos.workers.map(w => (
                            <div key={w.id} className="flex items-center gap-2 text-xs py-0.5">
                              {w.crewColor && (
                                <span
                                  className="inline-block w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: w.crewColor }}
                                />
                              )}
                              <span>{w.name}</span>
                              {w.crew && <span className="text-muted-foreground">({w.crew})</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Staffing rules compliance */}
            {shiftData.rules.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Staffing Rules
                </h4>
                <div className="space-y-2">
                  {shiftData.rules.map(rule => (
                    <div
                      key={rule.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg border text-sm gap-2 ${
                        rule.status === "met"
                          ? "bg-green-50/50 dark:bg-green-950/10 border-green-200/50 dark:border-green-800/50"
                          : "bg-red-50/50 dark:bg-red-950/10 border-red-200/50 dark:border-red-800/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {rule.status === "met" ? (
                          <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                        )}
                        <span className="font-medium truncate">{rule.name}</span>
                        {rule.crew && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            <span
                              className="inline-block w-2 h-2 rounded-full mr-1"
                              style={{ backgroundColor: rule.crew.color }}
                            />
                            {rule.crew.name}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 sm:shrink-0 ml-6 sm:ml-0">
                        <span className="text-xs text-muted-foreground">{rule.positionLabel}</span>
                        <Minus className="h-3 w-3 text-muted-foreground" />
                        <span className={`font-bold ${
                          rule.status === "met" ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                        }`}>
                          {rule.actual}/{rule.minWorkers}
                        </span>
                        {rule.status === "critical" && (
                          <Badge variant="destructive" className="text-xs">-{rule.shortage}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className={hasRules ? statusColors[summary.overallStatus] : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hasRules ? statusIcons[summary.overallStatus] : <TrendingUp className="h-5 w-5" />}
            <div>
              <CardTitle className="text-base sm:text-lg">Staffing Coverage</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {coverageData.date && new Date(coverageData.date + "T00:00:00").toLocaleDateString(undefined, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasRules && (
              <Badge variant={summary.overallStatus === "all_met" ? "secondary" : "destructive"} className="text-xs">
                {summary.overallStatus === "all_met"
                  ? statusLabels.all_met
                  : `${summary.rulesNotMet} of ${summary.totalRules} rules not met`}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Workforce totals */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {workforce.map(wf => (
            <div key={wf.positionType} className="text-center p-2 sm:p-3 rounded-lg bg-background border">
              <p className="text-xs text-muted-foreground">{wf.label}</p>
              <p className="text-xl sm:text-2xl font-bold">{wf.total}</p>
              <p className="text-xs text-muted-foreground">total workforce</p>
            </div>
          ))}
        </div>

        {/* Time off impact */}
        {timeOffToday.length > 0 && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3">
            <div className="flex items-center gap-2 mb-2">
              <CalendarOff className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                {timeOffToday.length} worker{timeOffToday.length !== 1 ? "s" : ""} off today
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {timeOffToday.map(w => (
                <Badge key={w.id} variant="outline" className="text-xs bg-background">
                  {w.name}
                  <span className="text-muted-foreground ml-1">({w.positionLabel})</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Shift sections */}
        {hasRules ? (
          <div className="space-y-3">
            {renderShiftSection("DAY", coverage.DAY)}
            {renderShiftSection("NIGHT", coverage.NIGHT)}
          </div>
        ) : (
          <div className="text-center py-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              No staffing rules configured yet. Set up minimum staffing requirements to track coverage.
            </p>
            <a href="/settings" className="text-sm font-medium text-primary hover:underline">
              Configure Staffing Rules in Settings →
            </a>
          </div>
        )}

        {/* Link to settings */}
        {hasRules && (
          <div className="pt-2 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <a href="/settings" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
              Manage staffing rules in Settings
            </a>
            <a href="/schedule" className="text-sm font-medium text-primary hover:underline">
              View full schedule →
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>([])
  const [processingTransfer, setProcessingTransfer] = useState<string | null>(null)
  const [coverageData, setCoverageData] = useState<StaffingCoverageData | null>(null)
  const { addToast } = useToast()
  const router = useRouter()

  const fetchCoverage = useCallback(async () => {
    try {
      const res = await fetch("/api/staffing-coverage")
      const result = await res.json()
      if (result.success) {
        setCoverageData(result.data)
      }
    } catch (error) {
      console.error("Failed to fetch staffing coverage:", error)
    }
  }, [])

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const [dashboardRes, transfersRes] = await Promise.all([
          fetch("/api/dashboard"),
          fetch("/api/transfer-requests?type=incoming"),
        ])

        const dashboardResult = await dashboardRes.json()
        const transfersResult = await transfersRes.json()

        if (dashboardResult.success) {
          setData(dashboardResult.data)
        }
        if (transfersResult.success) {
          setTransferRequests(transfersResult.data)
        }
      } catch (error) {
        console.error("Failed to fetch dashboard:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
    fetchCoverage()
  }, [fetchCoverage])

  async function handleTransferAction(transferId: string, action: "accept" | "decline") {
    setProcessingTransfer(transferId)
    try {
      const response = await fetch(`/api/transfer-requests/${transferId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const result = await response.json()

      if (result.success) {
        setTransferRequests((prev) => prev.filter((t) => t.id !== transferId))
        if (action === "accept") {
          addToast({
            type: "success",
            message: `You have joined ${result.data.organizationName}! Refreshing...`,
          })
          // Refresh the page to load the new organization context
          setTimeout(() => {
            router.refresh()
            window.location.reload()
          }, 1500)
        } else {
          addToast({ type: "success", message: "Transfer request declined" })
        }
      } else {
        addToast({ type: "error", message: result.error || "Failed to process request" })
      }
    } catch (error) {
      console.error("Failed to process transfer request:", error)
      addToast({ type: "error", message: "Failed to process request" })
    } finally {
      setProcessingTransfer(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 w-24 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const stats = data?.stats || {
    totalWorkers: 0,
    activeCrews: 0,
    onDutyToday: 0,
    pendingRequests: 0,
    upcomingShutdowns: 0,
    staffingGaps: 0,
  }

  // Separate staffing gaps by type (position-based vs certification-based)
  const positionGaps = data?.staffingGapDetails?.filter(gap => !gap.certificationName) || []
  const certificationGaps = data?.staffingGapDetails?.filter(gap => gap.certificationName) || []
  const recentActivity = data?.recentActivity || []

  return (
    <div className="space-y-6">
      {/* Transfer Request Alerts */}
      {transferRequests.length > 0 && (
        <Card className="border-blue-500/50 bg-blue-50 dark:bg-blue-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <UserPlus className="h-5 w-5" />
              Organization Transfer Request
              <Badge variant="secondary" className="ml-2">
                {transferRequests.length}
              </Badge>
            </CardTitle>
            <CardDescription className="text-blue-600 dark:text-blue-300">
              You have been invited to join another organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {transferRequests.map((request) => (
              <div
                key={request.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg bg-background border gap-4"
              >
                <div className="flex items-start gap-3">
                  <Building className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <p className="font-medium">{request.organization.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Invited by {request.createdBy.name || request.createdBy.email} as{" "}
                      <span className="font-medium">{request.role}</span>
                    </p>
                    {request.message && (
                      <p className="text-sm text-muted-foreground mt-1 italic">&ldquo;{request.message}&rdquo;</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Expires: {new Date(request.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 sm:flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTransferAction(request.id, "decline")}
                    disabled={processingTransfer === request.id}
                  >
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleTransferAction(request.id, "accept")}
                    disabled={processingTransfer === request.id}
                  >
                    {processingTransfer === request.id ? "Processing..." : "Accept & Join"}
                  </Button>
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Accepting will transfer you to the new organization. Your current schedules and data will be removed.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your workforce scheduling</p>
      </div>

      {/* Getting Started Checklist - shown for new users */}
      <GettingStartedChecklist />

      {/* Staffing Alerts Section - Prominent display when there are issues */}
      {stats.staffingGaps > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Staffing Alerts
              <Badge variant="destructive" className="ml-2">
                {stats.staffingGaps} {stats.staffingGaps === 1 ? "issue" : "issues"}
              </Badge>
            </CardTitle>
            <CardDescription>
              The following staffing gaps require your attention this week
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Position-based gaps */}
            {positionGaps.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Position Shortages
                </h4>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {positionGaps.map((gap, i) => {
                    const positionLabel = gap.positionType ? POSITION_TYPE_LABELS[gap.positionType] || gap.positionType : "All Positions"
                    return (
                      <div
                        key={`pos-${i}`}
                        className="flex items-center justify-between p-3 rounded-lg bg-background border"
                      >
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                          <div className="text-sm">
                            <p className="font-medium">{new Date(gap.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</p>
                            <p className="text-muted-foreground">{positionLabel}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={gap.shiftType === "DAY" ? "day" : "night"} className="text-xs">
                            {gap.shiftType === "DAY" ? <Sun className="h-3 w-3 mr-1" /> : <Moon className="h-3 w-3 mr-1" />}
                            {gap.shiftType === "DAY" ? "Day" : "Night"}
                          </Badge>
                          <Badge variant="destructive">-{gap.shortage}</Badge>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Certification-based gaps */}
            {certificationGaps.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Certification Shortages
                </h4>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {certificationGaps.map((gap, i) => (
                    <div
                      key={`cert-${i}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-background border"
                    >
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-amber-500 shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium">{new Date(gap.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</p>
                          <p className="text-muted-foreground">{gap.certificationName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={gap.shiftType === "DAY" ? "day" : "night"} className="text-xs">
                          {gap.shiftType === "DAY" ? <Sun className="h-3 w-3 mr-1" /> : <Moon className="h-3 w-3 mr-1" />}
                          {gap.shiftType === "DAY" ? "Day" : "Night"}
                        </Badge>
                        <Badge variant="destructive">-{gap.shortage}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 border-t">
              <a
                href="/schedule"
                className="text-sm font-medium text-primary hover:underline"
              >
                View schedule to resolve these issues →
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Workers
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalWorkers}</div>
            <p className="text-xs text-muted-foreground">Active employees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Crews
            </CardTitle>
            <Users2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCrews}</div>
            <p className="text-xs text-muted-foreground">Configured crews</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              On Duty Today
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.onDutyToday}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="day" className="text-xs">
                <Sun className="h-3 w-3 mr-1" />
                {data?.todayBreakdown?.dayShift || 0}
              </Badge>
              <Badge variant="night" className="text-xs">
                <Moon className="h-3 w-3 mr-1" />
                {data?.todayBreakdown?.nightShift || 0}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Requests
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingRequests}</div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>
      </div>

      {/* Staffing Coverage Panel - Main coverage dashboard */}
      <StaffingCoveragePanel coverageData={coverageData} onRefresh={fetchCoverage} />

      {/* Info Cards - 2 column layout */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Upcoming time off */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarOff className="h-5 w-5" />
              Upcoming Time Off
            </CardTitle>
            <CardDescription>Workers on leave in the next 2 weeks</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.upcomingTimeOff && data.upcomingTimeOff.length > 0 ? (
              <div className="space-y-3">
                {data.upcomingTimeOff.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between py-2 border-b last:border-0 min-h-[44px]"
                  >
                    <div>
                      <p className="font-medium">{request.user.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {request.user.crew?.name || "Unassigned"}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p>{new Date(request.startDate).toLocaleDateString()}</p>
                      <p className="text-muted-foreground">
                        to {new Date(request.endDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No upcoming time off scheduled</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest notifications and updates</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.slice(0, 5).map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 py-2 border-b last:border-0 min-h-[44px]"
                  >
                    <div className="shrink-0 mt-0.5">
                      {activity.type === "STAFFING_ALERT" ? (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      ) : activity.type === "SCHEDULE_CHANGE" ? (
                        <Calendar className="h-4 w-4 text-blue-500" />
                      ) : activity.type.startsWith("TIME_OFF") ? (
                        <CalendarOff className="h-4 w-4 text-purple-500" />
                      ) : (
                        <Bell className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{activity.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{activity.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(activity.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No recent activity</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div className="grid gap-4 md:grid-cols-3">
        <a
          href="/schedule"
          className="group rounded-lg border p-4 hover:border-primary hover:bg-accent transition-colors"
        >
          <Calendar className="h-8 w-8 text-primary mb-2" />
          <h3 className="font-semibold group-hover:text-primary">View Schedule</h3>
          <p className="text-sm text-muted-foreground">See the full schedule calendar</p>
        </a>

        <a
          href="/workers"
          className="group rounded-lg border p-4 hover:border-primary hover:bg-accent transition-colors"
        >
          <Users className="h-8 w-8 text-primary mb-2" />
          <h3 className="font-semibold group-hover:text-primary">Manage Workers</h3>
          <p className="text-sm text-muted-foreground">Add or edit worker information</p>
        </a>

        <a
          href="/time-off"
          className="group rounded-lg border p-4 hover:border-primary hover:bg-accent transition-colors"
        >
          <Clock className="h-8 w-8 text-primary mb-2" />
          <h3 className="font-semibold group-hover:text-primary">Time Off Requests</h3>
          <p className="text-sm text-muted-foreground">Review pending requests</p>
        </a>
      </div>
    </div>
  )
}
