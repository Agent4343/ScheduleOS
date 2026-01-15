"use client"

import { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  AlertTriangle,
  CheckCircle,
  Users,
} from "lucide-react"

interface Schedule {
  id: string
  date: string
  shiftType: string
  isBackfill: boolean
  backfillRole: string | null
  user: {
    id: string
    name: string
    primaryPosition: string | null
    isCCRQualified: boolean
  }
}

interface Position {
  id: string
  name: string
  code: string | null
  category: string | null
  shiftType: string
  minStaffing: number
  maxStaffing: number
  sortOrder: number
}

// Position categories for grouping
const POSITION_CATEGORIES = ["Leadership", "Control Room", "Field Ops"]

// Shift type to position mapping
const SHIFT_TO_POSITIONS: Record<string, string[]> = {
  DAY: ["Outside Ops - Day"],
  NIGHT: ["Outside Ops - Night"],
  OCR_DAY: ["OCR Operator - Day Slot 1", "OCR Operator - Day Slot 2"],
  OCR_NIGHT: ["OCR Operator - Night Slot 1", "OCR Operator - Night Slot 2"],
}

// Helper to get week dates
function getWeekDates(startDate: Date): Date[] {
  const dates: Date[] = []
  const current = new Date(startDate)
  for (let i = 0; i < 7; i++) {
    dates.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }
  return dates
}

// Get start of week (Sunday)
function getWeekStart(date: Date): Date {
  const result = new Date(date)
  result.setDate(result.getDate() - result.getDay())
  result.setHours(0, 0, 0, 0)
  return result
}

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])

  // Fetch positions
  useEffect(() => {
    async function fetchPositions() {
      try {
        const response = await fetch("/api/positions")
        const result = await response.json()
        if (result.success) {
          setPositions(result.data)
        }
      } catch (error) {
        console.error("Failed to fetch positions:", error)
      }
    }
    fetchPositions()
  }, [])

  // Fetch schedules for the week
  useEffect(() => {
    async function fetchSchedules() {
      setLoading(true)
      try {
        const startDate = weekStart.toISOString().split("T")[0]
        const endDate = new Date(weekStart)
        endDate.setDate(endDate.getDate() + 6)
        const endDateStr = endDate.toISOString().split("T")[0]

        const response = await fetch(`/api/schedules?startDate=${startDate}&endDate=${endDateStr}`)
        const result = await response.json()
        if (result.success) {
          setSchedules(result.data)
        }
      } catch (error) {
        console.error("Failed to fetch schedules:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchSchedules()
  }, [weekStart])

  // Group schedules by date and shift type
  const schedulesByDateAndShift = useMemo(() => {
    const map = new Map<string, Map<string, Schedule[]>>()

    for (const schedule of schedules) {
      const dateKey = schedule.date.includes("T")
        ? schedule.date.split("T")[0]
        : schedule.date

      if (!map.has(dateKey)) {
        map.set(dateKey, new Map())
      }

      const dateMap = map.get(dateKey)!
      if (!dateMap.has(schedule.shiftType)) {
        dateMap.set(schedule.shiftType, [])
      }
      dateMap.get(schedule.shiftType)!.push(schedule)
    }

    return map
  }, [schedules])

  // Calculate staffing for a position on a given date
  function getStaffingForPosition(position: Position, date: Date): { workers: Schedule[]; status: "ok" | "under" | "over" } {
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    const dateSchedules = schedulesByDateAndShift.get(dateKey)

    if (!dateSchedules) {
      return { workers: [], status: position.minStaffing > 0 ? "under" : "ok" }
    }

    // Map position to relevant shift types
    let relevantShiftTypes: string[] = []

    if (position.name.includes("OIM") || position.name.includes("Production Supervisor")) {
      // Leadership - on duty all day, check for DAY shift workers in these positions
      relevantShiftTypes = ["DAY"]
    } else if (position.name.includes("Production Lead - Days")) {
      relevantShiftTypes = ["DAY"]
    } else if (position.name.includes("Production Lead - Nights")) {
      relevantShiftTypes = ["NIGHT"]
    } else if (position.name.includes("OCR") && position.name.includes("Day")) {
      relevantShiftTypes = ["OCR_DAY"]
    } else if (position.name.includes("OCR") && position.name.includes("Night")) {
      relevantShiftTypes = ["OCR_NIGHT"]
    } else if (position.name.includes("Outside Ops - Day")) {
      relevantShiftTypes = ["DAY"]
    } else if (position.name.includes("Outside Ops - Night")) {
      relevantShiftTypes = ["NIGHT"]
    }

    const workers: Schedule[] = []
    for (const shiftType of relevantShiftTypes) {
      const shiftWorkers = dateSchedules.get(shiftType) || []
      // Filter by position if specific
      const filtered = shiftWorkers.filter(s => {
        if (position.name.includes("OIM")) {
          return s.user.primaryPosition === "OIM"
        }
        if (position.name.includes("Production Supervisor")) {
          return s.user.primaryPosition === "Production Supervisor"
        }
        if (position.name.includes("Production Lead")) {
          return s.user.primaryPosition === "Production Lead"
        }
        if (position.name.includes("OCR")) {
          return s.user.primaryPosition === "OCR Operator"
        }
        // For outside ops, include Ops Tech
        return s.user.primaryPosition === "Ops Tech"
      })
      workers.push(...filtered)
    }

    const count = workers.length
    let status: "ok" | "under" | "over" = "ok"
    if (count < position.minStaffing) status = "under"
    else if (count > position.maxStaffing) status = "over"

    return { workers, status }
  }

  function navigateWeek(direction: number) {
    setWeekStart(prev => {
      const next = new Date(prev)
      next.setDate(next.getDate() + direction * 7)
      return next
    })
  }

  function goToCurrentWeek() {
    setWeekStart(getWeekStart(new Date()))
  }

  // Group positions by category
  const positionsByCategory = useMemo(() => {
    const groups: Record<string, Position[]> = {}
    for (const category of POSITION_CATEGORIES) {
      groups[category] = positions
        .filter(p => p.category === category)
        .sort((a, b) => a.sortOrder - b.sortOrder)
    }
    return groups
  }, [positions])

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
  }

  const formatWeekRange = () => {
    const endDate = new Date(weekStart)
    endDate.setDate(endDate.getDate() + 6)
    return `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Position Coverage</h1>
          <p className="text-muted-foreground">
            Who fills each position - {formatWeekRange()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
            This Week
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateWeek(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateWeek(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-100 border border-green-300 rounded" />
          <span>Adequately Staffed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-100 border border-red-300 rounded" />
          <span>Understaffed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded" />
          <span>Overstaffed</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">(Backfill)</Badge>
          <span>Acting in role</span>
        </div>
      </div>

      {/* Position Coverage Grid */}
      {loading ? (
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {POSITION_CATEGORIES.map(category => {
            const categoryPositions = positionsByCategory[category] || []
            if (categoryPositions.length === 0) return null

            return (
              <Card key={category}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <LayoutGrid className="h-5 w-5" />
                    {category}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3 font-medium min-w-[200px] bg-muted/50">
                            Position
                          </th>
                          {weekDates.map(date => (
                            <th
                              key={date.toISOString()}
                              className={cn(
                                "text-center p-2 min-w-[140px] border-l",
                                date.toDateString() === new Date().toDateString() && "bg-primary/10"
                              )}
                            >
                              <div className="text-sm font-medium">
                                {date.toLocaleDateString("en-US", { weekday: "short" })}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {categoryPositions.map(position => (
                          <tr key={position.id} className="border-b hover:bg-muted/30">
                            <td className="p-3 font-medium">
                              <div>{position.name}</div>
                              <div className="text-xs text-muted-foreground">
                                Min: {position.minStaffing} | Max: {position.maxStaffing}
                              </div>
                            </td>
                            {weekDates.map(date => {
                              const { workers, status } = getStaffingForPosition(position, date)
                              const isToday = date.toDateString() === new Date().toDateString()

                              return (
                                <td
                                  key={date.toISOString()}
                                  className={cn(
                                    "p-2 border-l text-center align-top",
                                    status === "under" && "bg-red-50",
                                    status === "over" && "bg-yellow-50",
                                    status === "ok" && workers.length > 0 && "bg-green-50",
                                    isToday && "ring-2 ring-primary ring-inset"
                                  )}
                                >
                                  {workers.length === 0 ? (
                                    <span className="text-xs text-muted-foreground">-</span>
                                  ) : (
                                    <div className="space-y-1">
                                      {workers.slice(0, position.maxStaffing).map((worker, idx) => (
                                        <div
                                          key={worker.id}
                                          className="text-xs truncate"
                                          title={worker.user.name}
                                        >
                                          {worker.user.name?.split(" ")[0] || "Unknown"}
                                          {worker.user.isCCRQualified && (
                                            <span className="text-amber-600">*</span>
                                          )}
                                          {worker.isBackfill && (
                                            <span className="text-xs text-muted-foreground ml-1">(BF)</span>
                                          )}
                                        </div>
                                      ))}
                                      {workers.length > position.maxStaffing && (
                                        <div className="text-xs text-amber-600">
                                          +{workers.length - position.maxStaffing} overflow
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Daily Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Daily Coverage Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {weekDates.map(date => {
              const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
              const dateSchedules = schedulesByDateAndShift.get(dateKey)

              const dayCount = (dateSchedules?.get("DAY")?.length || 0) + (dateSchedules?.get("OCR_DAY")?.length || 0)
              const nightCount = (dateSchedules?.get("NIGHT")?.length || 0) + (dateSchedules?.get("OCR_NIGHT")?.length || 0)

              const isToday = date.toDateString() === new Date().toDateString()

              return (
                <div
                  key={date.toISOString()}
                  className={cn(
                    "p-3 rounded-lg border text-center",
                    isToday && "border-primary bg-primary/5"
                  )}
                >
                  <div className="text-sm font-medium">
                    {date.toLocaleDateString("en-US", { weekday: "short" })}
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-green-600 font-medium">{dayCount}</span>
                      <span className="text-xs text-muted-foreground">Day</span>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-blue-600 font-medium">{nightCount}</span>
                      <span className="text-xs text-muted-foreground">Night</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
