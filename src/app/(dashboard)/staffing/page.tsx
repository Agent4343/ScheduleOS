"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertTriangle,
  CheckCircle2,
  Users,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Info,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface StaffingGap {
  date: string
  position: {
    id: string
    name: string
    code: string | null
    category: string | null
    shiftType: string
  }
  required: number
  scheduled: number
  gap: number
  workers: Array<{
    id: string
    name: string
    isBackfill: boolean
  }>
  backfillAvailable: Array<{
    id: string
    name: string
    qualification: string
  }>
}

interface DailyStaffing {
  date: string
  dayOfWeek: string
  positions: Array<{
    position: {
      id: string
      name: string
      code: string | null
      category: string | null
      shiftType: string
      minStaffing: number
      maxStaffing: number
    }
    scheduled: number
    workers: Array<{
      id: string
      name: string
      shiftType: string
      isBackfill: boolean
      backfillRole: string | null
    }>
    status: "ok" | "understaffed" | "overstaffed"
    backfillsAvailable: Array<{
      id: string
      name: string
      qualification: string
    }>
  }>
  hasGaps: boolean
  totalGaps: number
}

interface StaffingData {
  summary: {
    totalDays: number
    daysWithGaps: number
    totalGaps: number
    gapsByPosition: Array<{
      position: string
      gapCount: number
    }>
  }
  gaps: StaffingGap[]
  dailyStaffing: DailyStaffing[]
}

export default function StaffingPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<StaffingData | null>(null)
  const [error, setError] = useState<string>("")

  // Date range state - default to current week
  const [startDate, setStartDate] = useState(() => {
    const today = new Date()
    const monday = new Date(today)
    monday.setUTCDate(today.getUTCDate() - today.getUTCDay() + 1)
    return monday.toISOString().split("T")[0]
  })
  const [endDate, setEndDate] = useState(() => {
    const today = new Date()
    const sunday = new Date(today)
    sunday.setUTCDate(today.getUTCDate() - today.getUTCDay() + 7)
    return sunday.toISOString().split("T")[0]
  })

  // View state
  const [viewMode, setViewMode] = useState<"summary" | "daily" | "gaps">("summary")
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  useEffect(() => {
    fetchStaffingData()
  }, [startDate, endDate])

  async function fetchStaffingData() {
    setLoading(true)
    setError("")

    try {
      const response = await fetch(
        `/api/staffing-validation?startDate=${startDate}&endDate=${endDate}`
      )
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        setError(result.error || "Failed to fetch staffing data")
      }
    } catch (err) {
      console.error("Error fetching staffing data:", err)
      setError("Failed to fetch staffing data")
    } finally {
      setLoading(false)
    }
  }

  function navigateWeek(direction: "prev" | "next") {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const days = direction === "prev" ? -7 : 7

    start.setUTCDate(start.getUTCDate() + days)
    end.setUTCDate(end.getUTCDate() + days)

    setStartDate(start.toISOString().split("T")[0])
    setEndDate(end.toISOString().split("T")[0])
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
  }

  function formatDateLong(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid gap-4 md:grid-cols-4">
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Staffing Validation</h1>
          <p className="text-muted-foreground">
            Check staffing levels and identify gaps
          </p>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateWeek("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-36"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-36"
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => navigateWeek("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Days Analyzed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.summary.totalDays}</div>
              </CardContent>
            </Card>

            <Card className={data.summary.daysWithGaps > 0 ? "border-red-500" : "border-green-500"}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Days with Gaps
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-2xl font-bold",
                    data.summary.daysWithGaps > 0 ? "text-red-500" : "text-green-500"
                  )}>
                    {data.summary.daysWithGaps}
                  </span>
                  {data.summary.daysWithGaps === 0 ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className={data.summary.totalGaps > 0 ? "border-amber-500" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Staffing Gaps
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.summary.totalGaps}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Coverage Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.summary.totalDays > 0
                    ? Math.round(
                        ((data.summary.totalDays - data.summary.daysWithGaps) /
                          data.summary.totalDays) *
                          100
                      )
                    : 100}
                  %
                </div>
              </CardContent>
            </Card>
          </div>

          {/* View Mode Tabs */}
          <div className="flex gap-2">
            <Button
              variant={viewMode === "summary" ? "default" : "outline"}
              onClick={() => setViewMode("summary")}
            >
              Summary
            </Button>
            <Button
              variant={viewMode === "daily" ? "default" : "outline"}
              onClick={() => setViewMode("daily")}
            >
              Daily View
            </Button>
            <Button
              variant={viewMode === "gaps" ? "default" : "outline"}
              onClick={() => setViewMode("gaps")}
            >
              Gaps Only ({data.gaps.length})
            </Button>
          </div>

          {/* Summary View */}
          {viewMode === "summary" && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Gaps by Position */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Gaps by Position
                  </CardTitle>
                  <CardDescription>Positions with staffing shortages</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.summary.gapsByPosition.filter((p) => p.gapCount > 0).length === 0 ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-5 w-5" />
                      All positions fully staffed
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {data.summary.gapsByPosition
                        .filter((p) => p.gapCount > 0)
                        .sort((a, b) => b.gapCount - a.gapCount)
                        .map((pos) => (
                          <div
                            key={pos.position}
                            className="flex items-center justify-between p-2 rounded border"
                          >
                            <span className="font-medium">{pos.position}</span>
                            <Badge variant="destructive">{pos.gapCount} gaps</Badge>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Week at a Glance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Week at a Glance
                  </CardTitle>
                  <CardDescription>Click a day to view details</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-2">
                    {data.dailyStaffing.slice(0, 7).map((day) => (
                      <button
                        key={day.date}
                        onClick={() => {
                          setSelectedDay(day.date)
                          setViewMode("daily")
                        }}
                        className={cn(
                          "p-2 rounded-lg border text-center transition-colors",
                          day.hasGaps
                            ? "border-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-950 dark:hover:bg-red-900"
                            : "border-green-500 bg-green-50 hover:bg-green-100 dark:bg-green-950 dark:hover:bg-green-900"
                        )}
                      >
                        <div className="text-xs text-muted-foreground">
                          {day.dayOfWeek.slice(0, 3)}
                        </div>
                        <div className="font-bold">{formatDate(day.date).split(" ")[1]}</div>
                        {day.hasGaps ? (
                          <AlertTriangle className="h-4 w-4 mx-auto text-red-500 mt-1" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 mx-auto text-green-500 mt-1" />
                        )}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Daily View */}
          {viewMode === "daily" && (
            <div className="space-y-4">
              {data.dailyStaffing.map((day) => (
                <Card
                  key={day.date}
                  className={cn(
                    selectedDay === day.date && "ring-2 ring-primary",
                    day.hasGaps && "border-red-300"
                  )}
                >
                  <CardHeader
                    className="cursor-pointer"
                    onClick={() => setSelectedDay(selectedDay === day.date ? null : day.date)}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        {formatDateLong(day.date)}
                        {day.hasGaps ? (
                          <Badge variant="destructive">{day.totalGaps} gaps</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                            Fully Staffed
                          </Badge>
                        )}
                      </CardTitle>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardHeader>

                  {selectedDay === day.date && (
                    <CardContent>
                      <div className="space-y-4">
                        {/* Group by category */}
                        {["Leadership", "Control Room", "Field Ops", null].map((category) => {
                          const categoryPositions = day.positions.filter(
                            (p) => (p.position.category || null) === category
                          )
                          if (categoryPositions.length === 0) return null

                          return (
                            <div key={category || "other"}>
                              <h4 className="font-semibold text-sm text-muted-foreground mb-2">
                                {category || "Other"}
                              </h4>
                              <div className="space-y-2">
                                {categoryPositions.map((pos) => (
                                  <div
                                    key={pos.position.id}
                                    className={cn(
                                      "p-3 rounded-lg border",
                                      pos.status === "understaffed" && "bg-red-50 border-red-300 dark:bg-red-950",
                                      pos.status === "overstaffed" && "bg-amber-50 border-amber-300 dark:bg-amber-950",
                                      pos.status === "ok" && "bg-green-50 border-green-300 dark:bg-green-950"
                                    )}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{pos.position.name}</span>
                                        <Badge variant="outline" className="text-xs">
                                          {pos.position.shiftType}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className={cn(
                                          "text-sm font-medium",
                                          pos.status === "understaffed" && "text-red-600",
                                          pos.status === "ok" && "text-green-600"
                                        )}>
                                          {pos.scheduled} / {pos.position.minStaffing} min
                                        </span>
                                        {pos.status === "understaffed" && (
                                          <AlertTriangle className="h-4 w-4 text-red-500" />
                                        )}
                                        {pos.status === "ok" && (
                                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                                        )}
                                      </div>
                                    </div>

                                    {/* Workers assigned */}
                                    {pos.workers.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mb-2">
                                        {pos.workers.map((w) => (
                                          <Badge
                                            key={w.id}
                                            variant={w.isBackfill ? "secondary" : "default"}
                                            className="text-xs"
                                          >
                                            {w.name}
                                            {w.isBackfill && " (Backfill)"}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}

                                    {/* Backfills available */}
                                    {pos.status === "understaffed" && pos.backfillsAvailable.length > 0 && (
                                      <div className="mt-2 pt-2 border-t">
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                          <Info className="h-3 w-3" />
                                          Available backfills:
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                          {pos.backfillsAvailable.map((bf) => (
                                            <Badge
                                              key={bf.id}
                                              variant="outline"
                                              className="text-xs bg-blue-50 text-blue-700 border-blue-300"
                                            >
                                              {bf.name} ({bf.qualification})
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}

          {/* Gaps Only View */}
          {viewMode === "gaps" && (
            <Card>
              <CardHeader>
                <CardTitle>All Staffing Gaps</CardTitle>
                <CardDescription>
                  {data.gaps.length === 0
                    ? "No staffing gaps found in the selected date range"
                    : `${data.gaps.length} staffing gaps found`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.gaps.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-green-600">
                    <CheckCircle2 className="h-12 w-12 mb-2" />
                    <p className="font-medium">All positions are adequately staffed!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.gaps.map((gap, idx) => (
                      <div
                        key={`${gap.date}-${gap.position.id}-${idx}`}
                        className="p-4 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold">{gap.position.name}</span>
                              <Badge variant="outline">{gap.position.shiftType}</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatDateLong(gap.date)}
                            </div>
                          </div>
                          <Badge variant="destructive">
                            Need {gap.gap} more ({gap.scheduled}/{gap.required})
                          </Badge>
                        </div>

                        {gap.backfillAvailable.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-red-200">
                            <div className="text-sm font-medium mb-2">Suggested Backfills:</div>
                            <div className="flex flex-wrap gap-2">
                              {gap.backfillAvailable.map((bf) => (
                                <Badge
                                  key={bf.id}
                                  variant="outline"
                                  className="bg-blue-50 text-blue-700 border-blue-300"
                                >
                                  {bf.name} - {bf.qualification}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
