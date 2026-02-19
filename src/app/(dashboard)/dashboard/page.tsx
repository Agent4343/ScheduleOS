"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Users,
  Calendar,
  Clock,
  AlertTriangle,
  CalendarOff,
  Sun,
  Moon,
  TrendingUp,
  ClipboardCheck,
  LogIn,
  UserCheck,
  QrCode,
  ScanLine,
  Rocket,
  ArrowRight,
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
  staffingGapDetails: Array<{ date: Date; shiftType: string; shortage: number }>
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

interface AttendanceData {
  checkedIn: number
  checkedOut: number
  onSite: number
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [attendance, setAttendance] = useState<AttendanceData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [dashRes, attendanceRes] = await Promise.all([
          fetch("/api/dashboard"),
          fetch("/api/attendance"),
        ])

        const dashData = await dashRes.json()
        if (dashData.success) setData(dashData.data)

        const attendanceData = await attendanceRes.json()
        if (attendanceData.success) {
          const records = attendanceData.data || []
          const checkedIn = records.length
          const checkedOut = records.filter((r: { checkOutTime: string | null }) => r.checkOutTime).length
          setAttendance({ checkedIn, checkedOut, onSite: checkedIn - checkedOut })
        }
      } catch (error) {
        console.error("Failed to fetch dashboard:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
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
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your workforce scheduling</p>
      </div>

      {/* Getting started banner for new orgs */}
      {stats.totalWorkers === 0 && stats.activeCrews === 0 && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Rocket className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold">Welcome to ShiftSync!</h3>
                <p className="text-sm text-muted-foreground">
                  Get started by setting up your crews, adding workers, and generating your first schedule.
                </p>
              </div>
              <a href="/getting-started">
                <Button className="gap-2">
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Staffing alert */}
      {stats.staffingGaps > 0 && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Staffing Alert</AlertTitle>
          <AlertDescription>
            There are {stats.staffingGaps} staffing gaps this week that need attention.
            <a href="/schedule" className="ml-2 underline">View schedule</a>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              On Site Now
            </CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attendance?.onSite ?? 0}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                <LogIn className="h-3 w-3 mr-1" />
                {attendance?.checkedIn ?? 0} in
              </Badge>
            </div>
          </CardContent>
        </Card>

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

      {/* Main content */}
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
              This Week&apos;s Coverage
            </CardTitle>
            <CardDescription>Staffing levels for the current week</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.staffingGapDetails && data.staffingGapDetails.length > 0 ? (
              <div className="space-y-3">
                {data.staffingGapDetails.map((gap, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <span>{new Date(gap.date).toLocaleDateString()}</span>
                    </div>
                    <Badge variant="destructive">
                      {gap.shiftType}: -{gap.shortage}
                    </Badge>
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

      {/* Quick actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <a
          href="/attendance/qr"
          className="group rounded-lg border p-4 hover:border-primary hover:bg-accent transition-colors"
        >
          <QrCode className="h-8 w-8 text-primary mb-2" />
          <h3 className="font-semibold group-hover:text-primary">My QR Code</h3>
          <p className="text-sm text-muted-foreground">Show your check-in code</p>
        </a>

        <a
          href="/attendance/scan"
          className="group rounded-lg border p-4 hover:border-primary hover:bg-accent transition-colors"
        >
          <ScanLine className="h-8 w-8 text-primary mb-2" />
          <h3 className="font-semibold group-hover:text-primary">Scan Check-In</h3>
          <p className="text-sm text-muted-foreground">Scan a worker&apos;s code</p>
        </a>

        <a
          href="/attendance"
          className="group rounded-lg border p-4 hover:border-primary hover:bg-accent transition-colors"
        >
          <ClipboardCheck className="h-8 w-8 text-primary mb-2" />
          <h3 className="font-semibold group-hover:text-primary">Attendance</h3>
          <p className="text-sm text-muted-foreground">View today&apos;s attendance records</p>
        </a>
      </div>
    </div>
  )
}
