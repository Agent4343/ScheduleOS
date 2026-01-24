"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { PageHeader } from "@/components/layout/page-header"
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
} from "lucide-react"

interface DashboardStats {
  totalWorkers: number
  activeCrews: number
  onDutyToday: number
  pendingRequests: number
  upcomingShutdowns: number
  staffingGaps: number
}

interface DashboardData {
  stats: DashboardStats
  staffingGapDetails: Array<{
    date: string
    shiftType: string
    shortage: number
    required: number
    scheduled: number
    ruleName: string
    crew?: { id: string; name: string }
    positionType?: string
    role?: string
    scheduledWorkers: Array<{
      id: string
      name: string | null
      crewName: string | null
      role: string
      positionType: string
    }>
    availableWorkers: Array<{
      id: string
      name: string | null
      crewName: string | null
      role: string
      positionType: string
    }>
  }>
  upcomingTimeOff: Array<{
    id: string
    startDate: string
    endDate: string
    user: { name: string; crew: { name: string } | null }
  }>
  todayBreakdown: {
    dayShift: number
    nightShift: number
  }
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const response = await fetch("/api/dashboard")
        const result = await response.json()
        if (result.success) {
          setData(result.data)
        } else {
          setError(result.error || "Failed to load dashboard data.")
        }
      } catch (error) {
        console.error("Failed to fetch dashboard:", error)
        setError("Failed to load dashboard data.")
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [])

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

  return (
    <div className="space-y-6">
      {/* Page header */}
      <PageHeader
        title="Dashboard"
        description="Overview of your workforce scheduling"
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Dashboard unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* Staffing alert */}
      {stats.staffingGaps > 0 && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Staffing Alert</AlertTitle>
          <AlertDescription>
            There are {stats.staffingGaps} staffing gaps in the next 3 weeks that need attention.
            <a href="/schedule" className="ml-2 underline">View schedule</a>
          </AlertDescription>
        </Alert>
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

      {/* Quick actions & info */}
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
                    className="flex items-center justify-between py-2 border-b last:border-0"
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

        {/* Staffing gaps */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Next 3 Weeks Coverage
            </CardTitle>
            <CardDescription>Staffing levels for the next 3 weeks</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.staffingGapDetails && data.staffingGapDetails.length > 0 ? (
              <div className="space-y-3">
                {data.staffingGapDetails.map((gap, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-2 py-3 border-b last:border-0"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span className="font-medium">
                          {new Date(gap.date).toLocaleDateString()} • {gap.shiftType}
                        </span>
                      </div>
                      <Badge variant="destructive">
                        Missing {gap.shortage}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Rule: {gap.ruleName}
                      {gap.crew ? ` • Crew: ${gap.crew.name}` : ""}
                      {gap.positionType ? ` • Position: ${gap.positionType}` : ""}
                      {gap.role ? ` • Role: ${gap.role}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Required: {gap.required} • Scheduled: {gap.scheduled}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Scheduled: {gap.scheduledWorkers.length > 0
                        ? gap.scheduledWorkers.map((w) => w.name || "Unnamed").slice(0, 5).join(", ")
                        : "None"}
                      {gap.scheduledWorkers.length > 5 ? ` +${gap.scheduledWorkers.length - 5} more` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Available: {gap.availableWorkers.length > 0
                        ? gap.availableWorkers.map((w) => w.name || "Unnamed").slice(0, 5).join(", ")
                        : "None"}
                      {gap.availableWorkers.length > 5 ? ` +${gap.availableWorkers.length - 5} more` : ""}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-600">
                <TrendingUp className="h-4 w-4" />
                <span>All shifts fully staffed this week</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

        <a
          href="/staffing"
          className="group rounded-lg border p-4 hover:border-primary hover:bg-accent transition-colors"
        >
          <AlertTriangle className="h-8 w-8 text-primary mb-2" />
          <h3 className="font-semibold group-hover:text-primary">Staffing</h3>
          <p className="text-sm text-muted-foreground">Review minimums and coverage gaps</p>
        </a>
      </div>
    </div>
  )
}
