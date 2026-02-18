"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ClipboardCheck,
  QrCode,
  ScanLine,
  Clock,
  UserCheck,
  UserMinus,
  LogIn,
  LogOut,
} from "lucide-react"

interface CheckInRecord {
  id: string
  date: string
  checkInTime: string
  checkOutTime: string | null
  autoCheckedOut: boolean
  user: {
    id: string
    name: string | null
    email: string
    crew: { id: string; name: string; color: string } | null
  }
  scannedBy: { id: string; name: string | null } | null
}

export default function AttendancePage() {
  const { data: session } = useSession()
  const [records, setRecords] = useState<CheckInRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [selfChecking, setSelfChecking] = useState(false)

  const isAdminOrSupervisor = session?.user?.role === "ADMIN" || session?.user?.role === "SUPERVISOR"

  useEffect(() => {
    fetchRecords()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  async function fetchRecords() {
    setLoading(true)
    try {
      const res = await fetch(`/api/attendance?date=${date}`)
      const data = await res.json()
      if (data.success) {
        setRecords(data.data)
      }
    } catch (error) {
      console.error("Failed to fetch attendance:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSelfCheckIn() {
    setSelfChecking(true)
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session?.user?.id }),
      })
      await res.json()
      fetchRecords()
    } catch (error) {
      console.error("Self check-in failed:", error)
    } finally {
      setSelfChecking(false)
    }
  }

  async function handleSelfCheckOut() {
    setSelfChecking(true)
    try {
      const res = await fetch("/api/attendance/check-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session?.user?.id }),
      })
      await res.json()
      fetchRecords()
    } catch (error) {
      console.error("Self check-out failed:", error)
    } finally {
      setSelfChecking(false)
    }
  }

  const myRecord = records.find((r) => r.user.id === session?.user?.id)
  const checkedInCount = records.length
  const checkedOutCount = records.filter((r) => r.checkOutTime).length
  const stillOnSite = checkedInCount - checkedOutCount

  function formatTime(isoString: string) {
    return new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  function getDuration(checkIn: string, checkOut: string | null) {
    const start = new Date(checkIn).getTime()
    const end = checkOut ? new Date(checkOut).getTime() : Date.now()
    const hours = Math.floor((end - start) / (1000 * 60 * 60))
    const minutes = Math.floor(((end - start) % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-muted-foreground">Track check-ins and check-outs</p>
        </div>
        <div className="flex gap-2">
          <Input
            id="attendance-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-auto"
          />
          <a href="/attendance/qr">
            <Button variant="outline" size="default">
              <QrCode className="h-4 w-4 mr-2" />
              My QR
            </Button>
          </a>
          {isAdminOrSupervisor && (
            <a href="/attendance/scan">
              <Button size="default">
                <ScanLine className="h-4 w-4 mr-2" />
                Scan
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Checked In</CardTitle>
            <LogIn className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{checkedInCount}</div>
            <p className="text-xs text-muted-foreground">Total today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Checked Out</CardTitle>
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{checkedOutCount}</div>
            <p className="text-xs text-muted-foreground">Completed shifts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">On Site</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stillOnSite}</div>
            <p className="text-xs text-muted-foreground">Currently working</p>
          </CardContent>
        </Card>
      </div>

      {/* Self check-in/out */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardCheck className="h-5 w-5" />
            My Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {myRecord ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="default">Checked In</Badge>
                <span className="text-sm text-muted-foreground">
                  at {formatTime(myRecord.checkInTime)}
                  {myRecord.checkOutTime && ` — out at ${formatTime(myRecord.checkOutTime)}`}
                </span>
                <span className="text-sm font-medium">
                  ({getDuration(myRecord.checkInTime, myRecord.checkOutTime)})
                </span>
              </div>
              {!myRecord.checkOutTime && (
                <Button
                  variant="outline"
                  onClick={handleSelfCheckOut}
                  disabled={selfChecking}
                >
                  <UserMinus className="h-4 w-4 mr-2" />
                  {selfChecking ? "Processing..." : "Check Out"}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="secondary">Not Checked In</Badge>
                <span className="text-sm text-muted-foreground">You haven&apos;t checked in today</span>
              </div>
              <Button onClick={handleSelfCheckIn} disabled={selfChecking}>
                <UserCheck className="h-4 w-4 mr-2" />
                {selfChecking ? "Processing..." : "Check In"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Records list */}
      {isAdminOrSupervisor && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              All Records
            </CardTitle>
            <CardDescription>
              {new Date(date).toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : records.length > 0 ? (
              <div className="space-y-2">
                {records.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2 h-10 rounded-full"
                        style={{ backgroundColor: record.user.crew?.color || "#6b7280" }}
                      />
                      <div>
                        <p className="font-medium">{record.user.name || record.user.email}</p>
                        <p className="text-sm text-muted-foreground">
                          {record.user.crew?.name || "No crew"}
                          {record.scannedBy && ` — scanned by ${record.scannedBy.name}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="text-right">
                        <p>
                          <span className="text-green-600 font-medium">In:</span>{" "}
                          {formatTime(record.checkInTime)}
                        </p>
                        {record.checkOutTime ? (
                          <p>
                            <span className="text-red-600 font-medium">Out:</span>{" "}
                            {formatTime(record.checkOutTime)}
                            {record.autoCheckedOut && (
                              <Badge variant="outline" className="ml-1 text-xs">Auto</Badge>
                            )}
                          </p>
                        ) : (
                          <Badge variant="default" className="text-xs">On Site</Badge>
                        )}
                      </div>
                      <Badge variant="outline">
                        {getDuration(record.checkInTime, record.checkOutTime)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No attendance records for this date
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
