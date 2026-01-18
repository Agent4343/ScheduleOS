"use client"

import { Suspense, useEffect, useState, useMemo, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/ui/modal"
import { cn } from "@/lib/utils"
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Sun,
  Moon,
  Home,
  Filter,
  Users,
  Pencil,
  Loader2,
  CalendarPlus,
  RotateCcw,
} from "lucide-react"
import { ShiftType, UserRole } from "@/types"

interface Schedule {
  id: string
  date: string
  shiftType: ShiftType
  user: {
    id: string
    name: string
    position: string | null
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

interface Worker {
  id: string
  name: string | null
  email?: string
  position: string | null
  phone?: string | null
  role?: UserRole
  hireDate?: string | null
  crew: {
    id: string
    name: string
    color: string
  } | null
}

interface WorkerEditForm {
  name: string
  position: string
  phone: string
  crewId: string
  role: UserRole
  hireDate: string
}

interface RotationPattern {
  id: string
  name: string
  daysOn: number
  daysOff: number
  includesNights: boolean
  nightDays: number
}

// Position-based color coding
const POSITION_COLORS: Record<string, string> = {
  "Operator": "bg-blue-500",
  "Senior Operator": "bg-blue-600",
  "Lead Operator": "bg-blue-700",
  "Technician": "bg-green-500",
  "Senior Technician": "bg-green-600",
  "Lead Technician": "bg-green-700",
  "Supervisor": "bg-purple-500",
  "Manager": "bg-purple-700",
  "Engineer": "bg-orange-500",
  "Maintenance": "bg-yellow-500",
  "Safety": "bg-red-500",
  "Quality": "bg-pink-500",
  "Logistics": "bg-cyan-500",
  "default": "bg-gray-500",
}

const SHIFT_COLORS: Record<ShiftType, { bg: string; text: string; border: string }> = {
  DAY: { bg: "bg-green-500", text: "text-white", border: "border-green-600" },
  NIGHT: { bg: "bg-blue-600", text: "text-white", border: "border-blue-700" },
  OFF: { bg: "bg-gray-200", text: "text-gray-600", border: "border-gray-300" },
  LEAVE: { bg: "bg-orange-400", text: "text-orange-900", border: "border-orange-500" },
  PL_DAY: { bg: "bg-teal-400", text: "text-teal-900", border: "border-teal-500" },
  PL_NIGHT: { bg: "bg-indigo-400", text: "text-indigo-900", border: "border-indigo-500" },
  VACATION: { bg: "bg-emerald-400", text: "text-emerald-900", border: "border-emerald-500" },
  SICK: { bg: "bg-red-400", text: "text-red-900", border: "border-red-500" },
  TRAINING: { bg: "bg-yellow-300", text: "text-yellow-900", border: "border-yellow-400" },
  SHUTDOWN: { bg: "bg-slate-500", text: "text-white", border: "border-slate-600" },
}

const SHIFT_ABBREV: Record<ShiftType, string> = {
  DAY: "D",
  NIGHT: "N",
  OFF: "O",
  LEAVE: "L",
  PL_DAY: "PD",
  PL_NIGHT: "PN",
  VACATION: "V",
  SICK: "S",
  TRAINING: "T",
  SHUTDOWN: "X",
}

const SHIFT_ICONS: Record<ShiftType, React.ReactNode> = {
  DAY: <Sun className="h-3 w-3" />,
  NIGHT: <Moon className="h-3 w-3" />,
  OFF: <Home className="h-3 w-3" />,
  LEAVE: null,
  PL_DAY: <Sun className="h-3 w-3" />,
  PL_NIGHT: <Moon className="h-3 w-3" />,
  VACATION: null,
  SICK: null,
  TRAINING: null,
  SHUTDOWN: null,
}

// Format date as YYYY-MM-DD using local timezone
function formatDateLocal(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Get all days in a year
function getDaysInYear(year: number) {
  const days: Date[] = []
  const date = new Date(year, 0, 1)
  while (date.getFullYear() === year) {
    days.push(new Date(date))
    date.setDate(date.getDate() + 1)
  }
  return days
}

// Get month name
function getMonthName(month: number) {
  return new Date(2024, month, 1).toLocaleDateString("en-US", { month: "short" })
}

// Get position color
function getPositionColor(position: string | null): string {
  if (!position) return POSITION_COLORS.default

  // Check for exact match first
  if (POSITION_COLORS[position]) return POSITION_COLORS[position]

  // Check for partial match
  for (const [key, value] of Object.entries(POSITION_COLORS)) {
    if (position.toLowerCase().includes(key.toLowerCase())) {
      return value
    }
  }

  return POSITION_COLORS.default
}

function SchedulePageContent() {
  const searchParams = useSearchParams()
  const yearFromUrl = searchParams.get("year")
  const [currentYear, setCurrentYear] = useState(() => {
    if (yearFromUrl) {
      const parsed = parseInt(yearFromUrl)
      if (!isNaN(parsed) && parsed >= 2020 && parsed <= 2100) {
        return parsed
      }
    }
    return new Date().getFullYear()
  })
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [selectedCrew, setSelectedCrew] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Rotation patterns
  const [rotationPatterns, setRotationPatterns] = useState<RotationPattern[]>([])

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null)
  const [editForm, setEditForm] = useState<WorkerEditForm>({
    name: "",
    position: "",
    phone: "",
    crewId: "",
    role: "WORKER" as UserRole,
    hireDate: "",
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Schedule generation state
  const [selectedPatternId, setSelectedPatternId] = useState<string>("")
  const [scheduleStartDate, setScheduleStartDate] = useState<string>("")
  const [startingShift, setStartingShift] = useState<"DAY" | "NIGHT">("DAY")
  const [generating, setGenerating] = useState(false)
  const [generateSuccess, setGenerateSuccess] = useState<string | null>(null)

  const yearDays = useMemo(() => getDaysInYear(currentYear), [currentYear])

  // Group days by month for header
  const monthGroups = useMemo(() => {
    const groups: { month: number; days: Date[] }[] = []
    let currentMonth = -1
    let currentGroup: Date[] = []

    for (const day of yearDays) {
      if (day.getMonth() !== currentMonth) {
        if (currentGroup.length > 0) {
          groups.push({ month: currentMonth, days: currentGroup })
        }
        currentMonth = day.getMonth()
        currentGroup = []
      }
      currentGroup.push(day)
    }
    if (currentGroup.length > 0) {
      groups.push({ month: currentMonth, days: currentGroup })
    }

    return groups
  }, [yearDays])

  // Fetch crews
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

  // Fetch rotation patterns
  useEffect(() => {
    async function fetchPatterns() {
      try {
        const response = await fetch("/api/rotation-patterns")
        const result = await response.json()
        if (result.success) {
          setRotationPatterns(result.data)
        }
      } catch (error) {
        console.error("Failed to fetch rotation patterns:", error)
      }
    }
    fetchPatterns()
  }, [])

  // Fetch workers
  useEffect(() => {
    async function fetchWorkers() {
      try {
        let url = "/api/users?status=ACTIVE"
        if (selectedCrew) {
          url += `&crewId=${selectedCrew}`
        }
        const response = await fetch(url)
        const result = await response.json()
        if (result.success) {
          setWorkers(result.data)
        }
      } catch (error) {
        console.error("Failed to fetch workers:", error)
      }
    }
    fetchWorkers()
  }, [selectedCrew])

  // Fetch schedules for the year
  useEffect(() => {
    async function fetchSchedules() {
      setLoading(true)
      try {
        const startDate = `${currentYear}-01-01`
        const endDate = `${currentYear}-12-31`

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
  }, [currentYear, selectedCrew])

  // Group schedules by user
  const schedulesByUser = useMemo(() => {
    const map = new Map<string, Map<string, Schedule>>()

    for (const schedule of schedules) {
      if (!map.has(schedule.user.id)) {
        map.set(schedule.user.id, new Map())
      }
      const dateKey = schedule.date.split("T")[0]
      map.get(schedule.user.id)!.set(dateKey, schedule)
    }

    return map
  }, [schedules])

  // Sort workers by crew name, then position, then name
  const sortedWorkers = useMemo(() => {
    return [...workers].sort((a, b) => {
      const crewCompare = (a.crew?.name || "ZZZ").localeCompare(b.crew?.name || "ZZZ")
      if (crewCompare !== 0) return crewCompare
      const posCompare = (a.position || "ZZZ").localeCompare(b.position || "ZZZ")
      if (posCompare !== 0) return posCompare
      return (a.name || "").localeCompare(b.name || "")
    })
  }, [workers])

  function navigateYear(direction: number) {
    setCurrentYear(currentYear + direction)
  }

  function goToCurrentYear() {
    setCurrentYear(new Date().getFullYear())
    // Scroll to today
    setTimeout(() => {
      const today = new Date()
      const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)
      if (scrollRef.current) {
        const cellWidth = 28 // approximate width per day
        scrollRef.current.scrollLeft = Math.max(0, (dayOfYear - 15) * cellWidth)
      }
    }, 100)
  }

  function openEditModal(worker: Worker) {
    setSelectedWorker(worker)

    // Safely parse hire date (using local timezone)
    let hireDateStr = ""
    if (worker.hireDate) {
      const hireDate = new Date(worker.hireDate)
      // Check if date is valid and not 1970 (Unix epoch)
      if (!isNaN(hireDate.getTime()) && hireDate.getFullYear() > 1970) {
        hireDateStr = formatDateLocal(hireDate)
      }
    }

    // Always use today's date for schedule generation start (local timezone)
    const todayStr = formatDateLocal(new Date())

    setEditForm({
      name: worker.name || "",
      position: worker.position || "",
      phone: worker.phone || "",
      crewId: worker.crew?.id || "",
      role: worker.role || "WORKER",
      hireDate: hireDateStr,
    })
    // Reset schedule generation fields - always start from today
    setSelectedPatternId("")
    setScheduleStartDate(todayStr)
    setStartingShift("DAY")
    setGenerateSuccess(null)
    setSaveError(null)
    setEditModalOpen(true)
  }

  function closeEditModal() {
    setEditModalOpen(false)
    setSelectedWorker(null)
    setSaveError(null)
  }

  async function saveWorker() {
    if (!selectedWorker) return

    setSaving(true)
    setSaveError(null)

    try {
      const response = await fetch(`/api/users/${selectedWorker.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          position: editForm.position || null,
          phone: editForm.phone || null,
          crewId: editForm.crewId || null,
          role: editForm.role,
          hireDate: editForm.hireDate || null,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to update worker")
      }

      // Update local state
      setWorkers((prev) =>
        prev.map((w) =>
          w.id === selectedWorker.id
            ? {
                ...w,
                name: editForm.name,
                position: editForm.position || null,
                phone: editForm.phone || null,
                role: editForm.role,
                hireDate: editForm.hireDate || null,
                crew: editForm.crewId
                  ? crews.find((c) => c.id === editForm.crewId) || null
                  : null,
              }
            : w
        )
      )

      closeEditModal()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function generateSchedule() {
    if (!selectedWorker || !selectedPatternId || !scheduleStartDate) return

    setGenerating(true)
    setSaveError(null)
    setGenerateSuccess(null)

    try {
      // Generate for the full year from start date
      const startDate = new Date(scheduleStartDate)
      const endDate = new Date(startDate.getFullYear(), 11, 31) // End of year

      // Format end date using local timezone
      const endDateStr = formatDateLocal(endDate)

      const response = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedWorker.id,
          patternId: selectedPatternId,
          startDate: scheduleStartDate,
          endDate: endDateStr,
          startPhase: 0,
          startingShift: startingShift,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to generate schedule")
      }

      setGenerateSuccess(
        `Generated ${result.data?.daysGenerated || 0} schedule days for ${startDate.getFullYear()}`
      )

      // Refresh schedules
      const fetchStartDate = `${currentYear}-01-01`
      const fetchEndDate = `${currentYear}-12-31`
      const schedulesResponse = await fetch(
        `/api/schedules?startDate=${fetchStartDate}&endDate=${fetchEndDate}`
      )
      const schedulesResult = await schedulesResponse.json()
      if (schedulesResult.success) {
        setSchedules(schedulesResult.data)
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to generate")
    } finally {
      setGenerating(false)
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Yearly Schedule</h1>
          <p className="text-muted-foreground">
            {currentYear} Annual View - {sortedWorkers.length} Workers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToCurrentYear}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateYear(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold px-2">{currentYear}</span>
          <Button variant="outline" size="icon" onClick={() => navigateYear(1)}>
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
        {Object.entries(SHIFT_COLORS).map(([type, colors]) => (
          <Badge key={type} className={cn(colors.bg, colors.text, colors.border, "border text-xs")}>
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
            {currentYear} Schedule
            <Badge variant="secondary" className="ml-2">
              <Users className="h-3 w-3 mr-1" />
              {sortedWorkers.length} workers
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="animate-pulse space-y-2 p-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-8 bg-muted rounded" />
              ))}
            </div>
          ) : sortedWorkers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No workers found</p>
              <p className="text-sm">Add workers to see their schedules</p>
            </div>
          ) : (
            <div className="relative">
              {/* Sticky worker info column */}
              <div className="flex">
                {/* Fixed left column for worker info */}
                <div className="sticky left-0 z-20 bg-background border-r shadow-sm">
                  {/* Header for worker column */}
                  <div className="h-16 border-b flex items-end p-2 bg-muted/50">
                    <span className="font-semibold text-sm">Worker</span>
                  </div>
                  {/* Worker rows */}
                  {sortedWorkers.map((worker) => (
                    <div
                      key={worker.id}
                      className="h-8 border-b flex items-center px-2 min-w-[200px] hover:bg-muted/50 cursor-pointer group"
                      onClick={() => openEditModal(worker)}
                    >
                      <div
                        className={cn(
                          "w-2 h-6 rounded-full mr-2 flex-shrink-0",
                          getPositionColor(worker.position)
                        )}
                        title={worker.position || "No position"}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-xs truncate">{worker.name || "Unnamed"}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {worker.position || "No position"}
                          {worker.crew && ` • ${worker.crew.name}`}
                        </p>
                      </div>
                      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                    </div>
                  ))}
                </div>

                {/* Scrollable calendar grid */}
                <div
                  ref={scrollRef}
                  className="overflow-x-auto flex-1"
                >
                  <div className="inline-block min-w-max">
                    {/* Month headers */}
                    <div className="flex h-8 border-b bg-muted/30">
                      {monthGroups.map(({ month, days }) => (
                        <div
                          key={month}
                          className="text-center text-xs font-semibold border-r flex items-center justify-center"
                          style={{ width: `${days.length * 28}px` }}
                        >
                          {getMonthName(month)}
                        </div>
                      ))}
                    </div>

                    {/* Day headers */}
                    <div className="flex h-8 border-b">
                      {yearDays.map((day) => {
                        const isToday = day.getTime() === today.getTime()
                        const isWeekend = day.getDay() === 0 || day.getDay() === 6
                        const isFirstOfMonth = day.getDate() === 1

                        return (
                          <div
                            key={day.toISOString()}
                            className={cn(
                              "w-7 text-center text-[10px] flex flex-col items-center justify-center",
                              isWeekend && "bg-muted/50",
                              isToday && "bg-primary/20 font-bold",
                              isFirstOfMonth && "border-l border-gray-300"
                            )}
                          >
                            <span className="text-muted-foreground">
                              {day.toLocaleDateString("en-US", { weekday: "narrow" })}
                            </span>
                            <span className={cn(isToday && "text-primary")}>
                              {day.getDate()}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {/* Schedule rows */}
                    {sortedWorkers.map((worker) => {
                      const userSchedules = schedulesByUser.get(worker.id)

                      return (
                        <div key={worker.id} className="flex h-8 border-b hover:bg-muted/30">
                          {yearDays.map((day) => {
                            // Use local date format to avoid timezone issues
                            const dateKey = formatDateLocal(day)
                            const schedule = userSchedules?.get(dateKey)
                            const isToday = day.getTime() === today.getTime()
                            const isWeekend = day.getDay() === 0 || day.getDay() === 6
                            const isFirstOfMonth = day.getDate() === 1

                            return (
                              <div
                                key={dateKey}
                                className={cn(
                                  "w-7 h-8 flex items-center justify-center text-[10px] font-bold border-r border-b",
                                  isFirstOfMonth && "border-l-2 border-l-gray-400",
                                  isToday && "ring-2 ring-primary ring-inset",
                                  schedule
                                    ? cn(
                                        SHIFT_COLORS[schedule.shiftType].bg,
                                        SHIFT_COLORS[schedule.shiftType].text,
                                        "border-white/20"
                                      )
                                    : cn(
                                        isWeekend ? "bg-gray-100" : "bg-white",
                                        "text-muted-foreground/30"
                                      )
                                )}
                                title={schedule ? `${schedule.shiftType} - ${worker.name}` : "No schedule"}
                              >
                                {schedule ? SHIFT_ABBREV[schedule.shiftType] : "-"}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Position Color Legend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Position Colors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(POSITION_COLORS)
              .filter(([key]) => key !== "default")
              .map(([position, color]) => (
                <div key={position} className="flex items-center gap-1">
                  <div className={cn("w-3 h-3 rounded-full", color)} />
                  <span className="text-xs text-muted-foreground">{position}</span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit Worker Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={closeEditModal}
        title="Edit Worker"
        description={selectedWorker?.email || "Update worker information"}
      >
        <div className="space-y-4">
          {saveError && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
              {saveError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              placeholder="Worker name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="position">Position</Label>
            <Input
              id="position"
              value={editForm.position}
              onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
              placeholder="e.g., Operator, Technician, Supervisor"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              placeholder="Phone number"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="crew">Crew</Label>
            <Select
              id="crew"
              value={editForm.crewId}
              onChange={(e) => setEditForm({ ...editForm, crewId: e.target.value })}
              options={[
                { value: "", label: "No Crew" },
                ...crews.map((crew) => ({ value: crew.id, label: crew.name })),
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              id="role"
              value={editForm.role}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
              options={[
                { value: "WORKER", label: "Worker" },
                { value: "SUPERVISOR", label: "Supervisor" },
                { value: "ADMIN", label: "Admin" },
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hireDate">Hire / Start Date</Label>
            <Input
              id="hireDate"
              type="date"
              value={editForm.hireDate}
              onChange={(e) => setEditForm({ ...editForm, hireDate: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-b pb-4">
            <Button variant="outline" onClick={closeEditModal} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveWorker} disabled={saving || !editForm.name}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>

          {/* Schedule Generation Section */}
          <div className="pt-4 space-y-4">
            <div className="flex items-center gap-2">
              <CalendarPlus className="h-4 w-4" />
              <h3 className="font-semibold">Generate Schedule</h3>
            </div>

            {generateSuccess && (
              <div className="p-3 text-sm text-green-600 bg-green-50 rounded-md">
                {generateSuccess}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="pattern">Rotation Pattern</Label>
              <Select
                id="pattern"
                value={selectedPatternId}
                onChange={(e) => setSelectedPatternId(e.target.value)}
                options={[
                  { value: "", label: "Select a pattern..." },
                  ...rotationPatterns.map((p) => ({
                    value: p.id,
                    label: `${p.name} (${p.daysOn} on / ${p.daysOff} off${p.includesNights ? `, ${p.nightDays} nights` : ""})`,
                  })),
                ]}
              />
            </div>

            {/* Show starting shift option if selected pattern includes nights */}
            {selectedPatternId && rotationPatterns.find(p => p.id === selectedPatternId)?.includesNights && (
              <div className="space-y-2">
                <Label htmlFor="startingShift">Starting Shift</Label>
                <Select
                  id="startingShift"
                  value={startingShift}
                  onChange={(e) => setStartingShift(e.target.value as "DAY" | "NIGHT")}
                  options={[
                    { value: "DAY", label: "Days First" },
                    { value: "NIGHT", label: "Nights First" },
                  ]}
                />
                <p className="text-xs text-muted-foreground">
                  Choose whether worker starts on day shift or night shift
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="scheduleStart">Schedule Start Date</Label>
              <Input
                id="scheduleStart"
                type="date"
                value={scheduleStartDate}
                onChange={(e) => setScheduleStartDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Schedule will be generated from this date to end of year
              </p>
            </div>

            <Button
              onClick={generateSchedule}
              disabled={generating || !selectedPatternId || !scheduleStartDate}
              className="w-full"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Generate Year Schedule
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default function SchedulePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <SchedulePageContent />
    </Suspense>
  )
}
