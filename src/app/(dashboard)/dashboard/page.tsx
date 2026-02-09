"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
  OTHER: "Staff",
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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>([])
  const [processingTransfer, setProcessingTransfer] = useState<string | null>(null)
  const { addToast } = useToast()
  const router = useRouter()

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
  }, [])

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

      {/* All Clear Banner - Show when no staffing issues */}
      {stats.staffingGaps === 0 && (
        <Alert className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-700 dark:text-green-400">All Staffing Requirements Met</AlertTitle>
          <AlertDescription className="text-green-600 dark:text-green-500">
            All shifts are fully staffed this week with proper coverage and certifications.
          </AlertDescription>
        </Alert>
      )}

      {/* Info Cards - 3 column layout */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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

        {/* Coverage Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              This Week&apos;s Coverage
            </CardTitle>
            <CardDescription>Staffing levels overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Gaps</span>
                <Badge variant={stats.staffingGaps > 0 ? "destructive" : "secondary"}>
                  {stats.staffingGaps}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Position Issues</span>
                <Badge variant={positionGaps.length > 0 ? "destructive" : "secondary"}>
                  {positionGaps.length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Certification Issues</span>
                <Badge variant={certificationGaps.length > 0 ? "destructive" : "secondary"}>
                  {certificationGaps.length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Upcoming Shutdowns</span>
                <Badge variant="outline">{stats.upcomingShutdowns}</Badge>
              </div>
            </div>
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
