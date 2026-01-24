"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Calendar, Loader2, RefreshCw, CalendarOff, ArrowRightLeft } from "lucide-react"
import { addDaysUTC, getTodayUTC, toDateString } from "@/lib/timezone"

interface ScheduleEntry {
  id: string
  date: string
  shiftType: string
  crew: { name: string; color: string } | null
}

export default function MySchedulePage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [entries, setEntries] = useState<ScheduleEntry[]>([])

  const getShiftVariant = (shiftType: string) => {
    if (shiftType === "NIGHT") return "night"
    if (["OFF", "VACATION", "SICK", "LEAVE", "SHUTDOWN"].includes(shiftType)) return "off"
    return "day"
  }

  const range = useMemo(() => {
    const start = getTodayUTC()
    const end = addDaysUTC(start, 30)
    return {
      startDate: toDateString(start),
      endDate: toDateString(end),
    }
  }, [])

  const fetchSchedule = async () => {
    if (!session?.user?.id) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/schedules?startDate=${range.startDate}&endDate=${range.endDate}&userId=${session.user.id}`
      )
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to load schedule")
      }
      setEntries(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schedule")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSchedule()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id])

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Schedule"
        description="Your upcoming shifts for the next 30 days."
        actions={(
          <Button variant="outline" onClick={fetchSchedule} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        )}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Date Range
            </CardTitle>
            <CardDescription>
              {range.startDate} → {range.endDate}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <a href="/time-off">
                <CalendarOff className="h-4 w-4 mr-2" />
                Request Time Off
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/shift-swaps">
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Request Shift Swap
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load schedule</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Shifts</CardTitle>
          <CardDescription>Showing scheduled shifts only.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No scheduled shifts found in this range.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Crew</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={getShiftVariant(entry.shiftType)}>
                        {entry.shiftType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {entry.crew ? (
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: entry.crew.color }}
                          />
                          {entry.crew.name}
                        </span>
                      ) : (
                        "Unassigned"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
