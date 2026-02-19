"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
  ArrowLeftRight,
  CalendarDays,
  Download,
  Upload,
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

interface MyScheduleDay {
  id: string
  date: string
  shiftType: string
  customShiftCode: string | null
}

interface MyScheduleData {
  schedules: MyScheduleDay[]
  nextShift: MyScheduleDay | null
  pendingSwaps: Array<{ id: string; date: string; requester: { name: string | null }; target: { name: string | null } }>
  pendingTimeOff: Array<{ id: string; startDate: string; endDate: string }>
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [attendance, setAttendance] = useState<AttendanceData | null>(null)
  const [mySchedule, setMySchedule] = useState<MyScheduleData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [dashRes, attendanceRes, myScheduleRes] = await Promise.all([
          fetch("/api/dashboard"),
          fetch("/api/attendance"),
          fetch("/api/my-schedule?days=14"),
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

        const myScheduleData = await myScheduleRes.json()
        if (myScheduleData.success) setMySchedule(myScheduleData.data)
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

      {/* My Schedule - Next 14 Days */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                My Schedule
              </CardTitle>
              <CardDescription>Your shifts for the next 2 weeks</CardDescription>
            </div>
            <div className="flex gap-2">
              <a href="/api/export/ical" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1">
                  <Download className="h-3.5 w-3.5" />
                  iCal
                </Button>
              </a>
              <a href="/schedule">
                <Button variant="outline" size="sm" className="gap-1">
                  Full Schedule
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </a>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {mySchedule?.nextShift && (
            <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-xs text-muted-foreground">Next Shift</p>
              <p className="font-semibold">
                {new Date(mySchedule.nextShift.date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                {" - "}
                <Badge variant={mySchedule.nextShift.shiftType === "NIGHT" ? "night" : "day"} className="text-xs">
                  {mySchedule.nextShift.shiftType === "DAY" ? "Day Shift" : mySchedule.nextShift.shiftType === "NIGHT" ? "Night Shift" : mySchedule.nextShift.shiftType}
                </Badge>
              </p>
            </div>
          )}

          {mySchedule?.schedules && mySchedule.schedules.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {mySchedule.schedules.map(day => {
                const date = new Date(day.date)
                const dayName = date.toLocaleDateString("en-US", { weekday: "short" })
                const dayNum = date.getDate()
                const isOff = ["OFF", "LEAVE", "VACATION", "SICK"].includes(day.shiftType)
                const isNight = day.shiftType === "NIGHT" || day.shiftType === "PL_NIGHT"
                return (
                  <div
                    key={day.id}
                    className={`flex flex-col items-center p-1.5 rounded-md text-xs w-12 border ${
                      isOff ? "bg-muted/50 text-muted-foreground" : isNight ? "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800" : "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800"
                    }`}
                    title={`${dayName} ${dayNum} - ${day.shiftType}`}
                  >
                    <span className="text-[10px] text-muted-foreground">{dayName}</span>
                    <span className="font-bold">{dayNum}</span>
                    <span className="text-[10px]">{day.shiftType === "DAY" ? "D" : day.shiftType === "NIGHT" ? "N" : day.shiftType.slice(0, 3)}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No schedule data for the next 2 weeks</p>
          )}

          {/* Pending swaps / time-off */}
          {((mySchedule?.pendingSwaps?.length ?? 0) > 0 || (mySchedule?.pendingTimeOff?.length ?? 0) > 0) && (
            <div className="mt-4 pt-4 border-t space-y-2">
              {(mySchedule?.pendingSwaps?.length ?? 0) > 0 && (
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {mySchedule?.pendingSwaps?.length} pending swap request{(mySchedule?.pendingSwaps?.length ?? 0) !== 1 ? "s" : ""}
                  </span>
                  <a href="/shift-swaps" className="text-xs text-primary hover:underline ml-auto">View</a>
                </div>
              )}
              {(mySchedule?.pendingTimeOff?.length ?? 0) > 0 && (
                <div className="flex items-center gap-2">
                  <CalendarOff className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {mySchedule?.pendingTimeOff?.length} pending time-off request{(mySchedule?.pendingTimeOff?.length ?? 0) !== 1 ? "s" : ""}
                  </span>
                  <a href="/time-off" className="text-xs text-primary hover:underline ml-auto">View</a>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
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
          <p className="text-sm text-muted-foreground">Today&apos;s records</p>
        </a>

        <a
          href="/shift-swaps"
          className="group rounded-lg border p-4 hover:border-primary hover:bg-accent transition-colors"
        >
          <ArrowLeftRight className="h-8 w-8 text-primary mb-2" />
          <h3 className="font-semibold group-hover:text-primary">Shift Swaps</h3>
          <p className="text-sm text-muted-foreground">Swap shifts with coworkers</p>
        </a>

        <a
          href="/api/export/ical"
          target="_blank"
          rel="noopener noreferrer"
          className="group rounded-lg border p-4 hover:border-primary hover:bg-accent transition-colors"
        >
          <Download className="h-8 w-8 text-primary mb-2" />
          <h3 className="font-semibold group-hover:text-primary">Export Calendar</h3>
          <p className="text-sm text-muted-foreground">Sync to phone calendar</p>
        </a>

        <a
          href="/assistant"
          className="group rounded-lg border p-4 hover:border-primary hover:bg-accent transition-colors"
        >
          <Upload className="h-8 w-8 text-primary mb-2" />
          <h3 className="font-semibold group-hover:text-primary">AI Assistant</h3>
          <p className="text-sm text-muted-foreground">Ask questions about schedule</p>
        </a>
      </div>
    </div>
  )
}
