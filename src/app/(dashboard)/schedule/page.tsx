"use client"

import { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/select"
import { cn, addDays, startOfWeek, formatDateShort } from "@/lib/utils"
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Sun,
  Moon,
  Home,
  Filter,
} from "lucide-react"
import { ShiftType } from "@/types"

interface Schedule {
  id: string
  date: string
  shiftType: ShiftType
  user: {
    id: string
    name: string
  }
  crew: {
    id: string
    name: string
    color: string
  } | null
}

interface Crew {
  id: string
  name: string
  color: string
}

const SHIFT_COLORS: Record<ShiftType, string> = {
  DAY: "bg-amber-100 text-amber-800 border-amber-300",
  NIGHT: "bg-indigo-100 text-indigo-800 border-indigo-300",
  OFF: "bg-gray-100 text-gray-500 border-gray-200",
  VACATION: "bg-green-100 text-green-800 border-green-300",
  SICK: "bg-red-100 text-red-800 border-red-300",
  TRAINING: "bg-yellow-100 text-yellow-800 border-yellow-300",
  SHUTDOWN: "bg-slate-200 text-slate-600 border-slate-300",
}

const SHIFT_ICONS: Record<ShiftType, React.ReactNode> = {
  DAY: <Sun className="h-3 w-3" />,
  NIGHT: <Moon className="h-3 w-3" />,
  OFF: <Home className="h-3 w-3" />,
  VACATION: null,
  SICK: null,
  TRAINING: null,
  SHUTDOWN: null,
}

export default function SchedulePage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [selectedCrew, setSelectedCrew] = useState<string>("")
  const [loading, setLoading] = useState(true)

  const weekStart = startOfWeek(currentDate)
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  }, [weekStart])

  useEffect(() => {
    async function fetchCrews() {
      try {
        const response = await fetch("/api/crews")
        const result = await response.json()
        if (result.success) {
          setCrews(result.data)
        }
      } catch (error) {
        console.error("Failed to fetch crews:", error)
      }
    }
    fetchCrews()
  }, [])

  useEffect(() => {
    async function fetchSchedules() {
      setLoading(true)
      try {
        const startDate = weekDays[0].toISOString().split("T")[0]
        const endDate = weekDays[6].toISOString().split("T")[0]

        let url = `/api/schedules?startDate=${startDate}&endDate=${endDate}`
        if (selectedCrew) {
          url += `&crewId=${selectedCrew}`
        }

        const response = await fetch(url)
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
  }, [weekDays, selectedCrew])

  // Group schedules by user
  const schedulesByUser = useMemo(() => {
    const grouped = new Map<string, { user: Schedule["user"]; crew: Schedule["crew"]; schedules: Map<string, Schedule> }>()

    for (const schedule of schedules) {
      if (!grouped.has(schedule.user.id)) {
        grouped.set(schedule.user.id, {
          user: schedule.user,
          crew: schedule.crew,
          schedules: new Map(),
        })
      }
      const dateKey = schedule.date.split("T")[0]
      grouped.get(schedule.user.id)!.schedules.set(dateKey, schedule)
    }

    return Array.from(grouped.values()).sort((a, b) => {
      // Sort by crew name, then user name
      const crewCompare = (a.crew?.name || "ZZZ").localeCompare(b.crew?.name || "ZZZ")
      if (crewCompare !== 0) return crewCompare
      return (a.user.name || "").localeCompare(b.user.name || "")
    })
  }, [schedules])

  function navigateWeek(direction: number) {
    setCurrentDate(addDays(currentDate, direction * 7))
  }

  function goToToday() {
    setCurrentDate(new Date())
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Schedule</h1>
          <p className="text-muted-foreground">
            Week of {weekDays[0].toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateWeek(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateWeek(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filter:</span>
        </div>
        <Select
          value={selectedCrew}
          onChange={(e) => setSelectedCrew(e.target.value)}
          options={[
            { value: "", label: "All Crews" },
            ...crews.map((crew) => ({ value: crew.id, label: crew.name })),
          ]}
          className="w-40"
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(SHIFT_COLORS).map(([type, colorClass]) => (
          <Badge key={type} className={cn(colorClass, "border")}>
            {SHIFT_ICONS[type as ShiftType]}
            <span className="ml-1">{type}</span>
          </Badge>
        ))}
      </div>

      {/* Schedule grid */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Weekly Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded" />
              ))}
            </div>
          ) : schedulesByUser.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No schedules found for this week</p>
              <p className="text-sm">Generate schedules for your crews to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr>
                    <th className="text-left p-2 border-b w-48">Worker</th>
                    {weekDays.map((day) => {
                      const isToday = day.getTime() === today.getTime()
                      return (
                        <th
                          key={day.toISOString()}
                          className={cn(
                            "text-center p-2 border-b min-w-[100px]",
                            isToday && "bg-primary/10"
                          )}
                        >
                          <div className="text-xs text-muted-foreground">
                            {day.toLocaleDateString("en-US", { weekday: "short" })}
                          </div>
                          <div className={cn("text-sm", isToday && "font-bold text-primary")}>
                            {formatDateShort(day)}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {schedulesByUser.map(({ user, crew, schedules: userSchedules }) => (
                    <tr key={user.id} className="hover:bg-muted/50">
                      <td className="p-2 border-b">
                        <div className="flex items-center gap-2">
                          {crew && (
                            <div
                              className="w-2 h-8 rounded-full"
                              style={{ backgroundColor: crew.color }}
                              title={crew.name}
                            />
                          )}
                          <div>
                            <p className="font-medium text-sm">{user.name}</p>
                            {crew && (
                              <p className="text-xs text-muted-foreground">{crew.name}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      {weekDays.map((day) => {
                        const dateKey = day.toISOString().split("T")[0]
                        const schedule = userSchedules.get(dateKey)
                        const isToday = day.getTime() === today.getTime()

                        return (
                          <td
                            key={dateKey}
                            className={cn(
                              "p-1 border-b text-center",
                              isToday && "bg-primary/5"
                            )}
                          >
                            {schedule ? (
                              <Badge
                                className={cn(
                                  SHIFT_COLORS[schedule.shiftType],
                                  "border cursor-pointer hover:opacity-80"
                                )}
                              >
                                {SHIFT_ICONS[schedule.shiftType]}
                                <span className="ml-1 text-xs">{schedule.shiftType}</span>
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
