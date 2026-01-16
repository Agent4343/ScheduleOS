"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  Users,
  Pencil,
  Loader2,
  CalendarPlus,
  RotateCcw,
  Check,
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

// Position-based color coding for offshore operations
const POSITION_COLORS: Record<string, string> = {
  // Leadership
  "OIM": "bg-purple-700",
  "Production Supervisor": "bg-purple-600",
  "Production Lead": "bg-purple-500",

  // Control Room
  "OCR Operator": "bg-teal-500",
  "CCR Operator": "bg-cyan-600",

  // Field Operations
  "Ops Tech": "bg-blue-500",

  // Legacy/Generic
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

// Shift colors for all offshore shift types
const SHIFT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  // Field Operations
  DAY: { bg: "bg-green-500", text: "text-white", border: "border-green-600" },
  NIGHT: { bg: "bg-blue-600", text: "text-white", border: "border-blue-700" },

  // Control Room
  OCR_DAY: { bg: "bg-teal-500", text: "text-white", border: "border-teal-600" },
  OCR_NIGHT: { bg: "bg-indigo-600", text: "text-white", border: "border-indigo-700" },
  CCR_DAY: { bg: "bg-cyan-500", text: "text-white", border: "border-cyan-600" },
  CCR_NIGHT: { bg: "bg-purple-600", text: "text-white", border: "border-purple-700" },

  // Backfill/Acting Roles
  PS: { bg: "bg-amber-500", text: "text-white", border: "border-amber-600" },
  PL_DAY: { bg: "bg-orange-400", text: "text-white", border: "border-orange-500" },
  PL_NIGHT: { bg: "bg-orange-600", text: "text-white", border: "border-orange-700" },

  // Non-operational
  TRAINING: { bg: "bg-yellow-300", text: "text-yellow-900", border: "border-yellow-400" },
  OSCC: { bg: "bg-yellow-500", text: "text-white", border: "border-yellow-600" },

  // Absence
  OFF: { bg: "", text: "text-transparent", border: "" }, // Blank for OFF days
  LEAVE: { bg: "bg-gray-400", text: "text-white", border: "border-gray-500" },
  SICK: { bg: "bg-red-400", text: "text-red-900", border: "border-red-500" },
  VACATION: { bg: "bg-emerald-400", text: "text-emerald-900", border: "border-emerald-500" },

  // Other
  SHUTDOWN: { bg: "bg-slate-500", text: "text-white", border: "border-slate-600" },
}

// Shift abbreviations for display
const SHIFT_ABBREV: Record<string, string> = {
  DAY: "D",
  NIGHT: "N",
  OCR_DAY: "OR",
  OCR_NIGHT: "OR",
  CCR_DAY: "CR",
  CCR_NIGHT: "CR",
  PS: "PS",
  PL_DAY: "PL",
  PL_NIGHT: "PL",
  TRAINING: "TR",
  OSCC: "OS",
  OFF: "",
  LEAVE: "L",
  SICK: "SL",
  VACATION: "V",
  SHUTDOWN: "X",
}

const SHIFT_ICONS: Record<string, React.ReactNode> = {
  DAY: <Sun className="h-3 w-3" />,
  NIGHT: <Moon className="h-3 w-3" />,
  OCR_DAY: <Sun className="h-3 w-3" />,
  OCR_NIGHT: <Moon className="h-3 w-3" />,
  CCR_DAY: <Sun className="h-3 w-3" />,
  CCR_NIGHT: <Moon className="h-3 w-3" />,
  OFF: null,
  LEAVE: null,
  VACATION: null,
  SICK: null,
  TRAINING: null,
  OSCC: null,
  SHUTDOWN: null,
  PS: null,
  PL_DAY: null,
  PL_NIGHT: null,
}

// Get all days in a year (using UTC to avoid timezone issues)
function getDaysInYear(year: number) {
  const days: Date[] = []
  const date = new Date(Date.UTC(year, 0, 1))
  while (date.getUTCFullYear() === year) {
    days.push(new Date(date))
    date.setUTCDate(date.getUTCDate() + 1)
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

export default function SchedulePage() {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
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
  const [startOnNights, setStartOnNights] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateSuccess, setGenerateSuccess] = useState<string | null>(null)

  // Collapsible legend state
  const [showShiftLegend, setShowShiftLegend] = useState(false)

  // Cell editing state
  const [selectedCell, setSelectedCell] = useState<{ workerId: string; date: string; x: number; y: number } | null>(null)
  const [cellSaving, setCellSaving] = useState(false)

  // Bulk update state (for vacation, training, sick, etc.)
  const [bulkStartDate, setBulkStartDate] = useState<string>("")
  const [bulkEndDate, setBulkEndDate] = useState<string>("")
  const [bulkShiftType, setBulkShiftType] = useState<string>("VACATION")
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null)

  const yearDays = useMemo(() => getDaysInYear(currentYear), [currentYear])

  // Group days by month for header
  const monthGroups = useMemo(() => {
    const groups: { month: number; days: Date[] }[] = []
    let currentMonth = -1
    let currentGroup: Date[] = []

    for (const day of yearDays) {
      if (day.getUTCMonth() !== currentMonth) {
        if (currentGroup.length > 0) {
          groups.push({ month: currentMonth, days: currentGroup })
        }
        currentMonth = day.getUTCMonth()
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
        } else {
          console.error("Failed to fetch schedules:", result.error)
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
      // Date is already YYYY-MM-DD from API, but handle both formats
      const dateKey = schedule.date.includes("T")
        ? schedule.date.split("T")[0]
        : schedule.date
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
        const cellWidth = 32 // width per day cell (w-8 = 32px)
        scrollRef.current.scrollLeft = Math.max(0, (dayOfYear - 20) * cellWidth)
      }
    }, 100)
  }

  function openEditModal(worker: Worker) {
    setSelectedWorker(worker)
    const hireDateStr = worker.hireDate
      ? new Date(worker.hireDate).toISOString().split("T")[0]
      : ""
    setEditForm({
      name: worker.name || "",
      position: worker.position || "",
      phone: worker.phone || "",
      crewId: worker.crew?.id || "",
      role: worker.role || "WORKER",
      hireDate: hireDateStr,
    })
    // Reset schedule generation fields
    setSelectedPatternId("")
    setScheduleStartDate(hireDateStr || new Date().toISOString().split("T")[0])
    setStartOnNights(false)
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
      const generatedYear = startDate.getUTCFullYear()
      const endDate = new Date(Date.UTC(generatedYear, 11, 31)) // End of year (UTC)

      const response = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedWorker.id,
          patternId: selectedPatternId,
          startDate: scheduleStartDate,
          endDate: endDate.toISOString().split("T")[0],
          startPhase: 0,
          startOnNights,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to generate schedule")
      }

      const counts = result.data?.shiftCounts || {}
      const pattern = result.data?.patternUsed || {}
      setGenerateSuccess(
        `Generated ${result.data?.daysGenerated || 0} days: ${counts.DAY || 0} day shifts, ${counts.NIGHT || 0} night shifts, ${counts.OFF || 0} off days. Pattern: ${pattern.name || 'unknown'} (includesNights: ${pattern.includesNights ? 'YES' : 'NO'})`
      )

      // Switch to the generated year if different from current view
      if (generatedYear !== currentYear) {
        setCurrentYear(generatedYear)
      }

      // Refresh schedules for the generated year
      const fetchStartDate = `${generatedYear}-01-01`
      const fetchEndDate = `${generatedYear}-12-31`

      // Clear crew filter to ensure we see the worker's schedule
      setSelectedCrew("")

      const schedulesResponse = await fetch(
        `/api/schedules?startDate=${fetchStartDate}&endDate=${fetchEndDate}`
      )
      const schedulesResult = await schedulesResponse.json()
      if (schedulesResult.success) {
        setSchedules(schedulesResult.data)
      }
    } catch (error) {
      console.error("Generate schedule error:", error)
      setSaveError(error instanceof Error ? error.message : "Failed to generate")
    } finally {
      setGenerating(false)
    }
  }

  // Bulk update schedule (for vacation, training, sick, etc.)
  async function applyBulkUpdate() {
    if (!selectedWorker || !bulkStartDate || !bulkEndDate || !bulkShiftType) return

    setBulkUpdating(true)
    setBulkSuccess(null)
    setSaveError(null)

    try {
      // Calculate all dates in the range
      const start = new Date(bulkStartDate)
      const end = new Date(bulkEndDate)
      const dates: string[] = []
      const current = new Date(start)

      while (current <= end) {
        dates.push(current.toISOString().split("T")[0])
        current.setUTCDate(current.getUTCDate() + 1)
      }

      // Create/update schedule entries for each date
      const results = await Promise.all(
        dates.map(async (date) => {
          const response = await fetch("/api/schedules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: selectedWorker.id,
              date,
              shiftType: bulkShiftType,
              isOverride: true, // Mark as override so it won't be cleared when regenerating
            }),
          })
          return response.ok
        })
      )

      const successCount = results.filter(Boolean).length
      setBulkSuccess(`Updated ${successCount} days to ${bulkShiftType}`)

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

      // Clear the form
      setBulkStartDate("")
      setBulkEndDate("")
    } catch (error) {
      console.error("Bulk update error:", error)
      setSaveError(error instanceof Error ? error.message : "Failed to update")
    } finally {
      setBulkUpdating(false)
    }
  }

  // Save cell shift type
  async function saveCellShift(workerId: string, date: string, shiftType: ShiftType | null) {
    setCellSaving(true)
    try {
      if (shiftType === null || shiftType === "OFF") {
        // Delete the schedule entry
        const existingSchedule = schedulesByUser.get(workerId)?.get(date)
        if (existingSchedule) {
          await fetch(`/api/schedules/${existingSchedule.id}`, {
            method: "DELETE",
          })
          // Remove from local state
          setSchedules((prev) => prev.filter((s) => s.id !== existingSchedule.id))
        }
      } else {
        // Create or update schedule entry
        const existingSchedule = schedulesByUser.get(workerId)?.get(date)

        if (existingSchedule) {
          // Update existing
          const response = await fetch(`/api/schedules/${existingSchedule.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shiftType }),
          })
          await response.json()
          if (response.ok) {
            setSchedules((prev) =>
              prev.map((s) =>
                s.id === existingSchedule.id ? { ...s, shiftType } : s
              )
            )
          }
        } else {
          // Create new
          const response = await fetch("/api/schedules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: workerId,
              date,
              shiftType,
            }),
          })
          const result = await response.json()
          if (response.ok && result.data) {
            const worker = workers.find((w) => w.id === workerId)
            setSchedules((prev) => [
              ...prev,
              {
                id: result.data.id,
                date: result.data.date?.split?.('T')?.[0] || date,
                shiftType,
                user: {
                  id: workerId,
                  name: worker?.name || "",
                  position: worker?.position || null,
                },
                crew: worker?.crew || null,
              },
            ])
          }
        }
      }
    } catch (error) {
      console.error("Failed to save cell:", error)
    } finally {
      setCellSaving(false)
      setSelectedCell(null)
    }
  }

  function handleCellClick(e: React.MouseEvent, workerId: string, date: string) {
    e.stopPropagation()
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setSelectedCell({
      workerId,
      date,
      x: rect.left,
      y: rect.bottom,
    })
  }

  // Get today's date at UTC midnight for consistent comparison
  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-4 lg:-m-6">
      {/* Compact Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-background shrink-0">
        {/* Left: Title and stats */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <span className="font-semibold text-lg">{currentYear} Schedule</span>
          </div>
          <Badge variant="secondary" className="hidden sm:flex">
            <Users className="h-3 w-3 mr-1" />
            {sortedWorkers.length} workers
          </Badge>
          <span className="text-sm text-muted-foreground hidden md:block">
            {schedules.length} entries
          </span>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          {/* Filter */}
          <Select
            value={selectedCrew}
            onChange={(e) => setSelectedCrew(e.target.value)}
            options={[
              { value: "", label: "All Crews" },
              ...crews.map((crew) => ({ value: crew.id, label: crew.name })),
            ]}
            className="w-32 h-8 text-sm"
          />

          {/* Legend toggles */}
          <Button
            variant={showShiftLegend ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowShiftLegend(!showShiftLegend)}
            className="h-8 text-xs"
          >
            Legend
          </Button>

          {/* Year navigation */}
          <div className="flex items-center border rounded-md">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateYear(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold px-2 text-sm min-w-[50px] text-center">{currentYear}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateYear(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button variant="outline" size="sm" className="h-8" onClick={goToCurrentYear}>
            Today
          </Button>
        </div>
      </div>

      {/* Collapsible Legend Panel */}
      {showShiftLegend && (
        <div className="px-3 py-2 border-b bg-muted/30 flex flex-wrap gap-2 shrink-0">
          {Object.entries(SHIFT_COLORS)
            .filter(([type]) => type !== "OFF")
            .map(([type, colors]) => (
              <Badge key={type} className={cn(colors.bg, colors.text, colors.border, "border text-xs")}>
                {SHIFT_ICONS[type as ShiftType]}
                <span className="ml-1">{type}</span>
              </Badge>
            ))}
          <div className="border-l pl-2 ml-2 flex flex-wrap gap-2">
            {Object.entries(POSITION_COLORS)
              .filter(([key]) => key !== "default")
              .slice(0, 6)
              .map(([position, color]) => (
                <div key={position} className="flex items-center gap-1">
                  <div className={cn("w-2 h-2 rounded-full", color)} />
                  <span className="text-xs text-muted-foreground">{position}</span>
                </div>
              ))}
            <span className="text-xs text-muted-foreground">...</span>
          </div>
        </div>
      )}

      {/* Full-page Schedule Grid */}
      <div className="flex-1 overflow-auto border-t">
          {loading ? (
            <div className="animate-pulse space-y-2 p-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-8 bg-muted rounded" />
              ))}
            </div>
          ) : sortedWorkers.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No workers found</p>
                <p className="text-sm">Add workers to see their schedules</p>
              </div>
            </div>
          ) : (
            <div className="flex min-h-full">
              {/* Fixed left column for worker info */}
              <div className="sticky left-0 z-20 bg-background border-r shadow-md shrink-0">
                {/* Header for worker column */}
                <div className="h-[66px] border-b flex items-end p-2 bg-muted/50 sticky top-0 z-10">
                  <span className="font-semibold text-sm">Worker</span>
                </div>
                {/* Worker rows */}
                {sortedWorkers.map((worker) => (
                  <div
                    key={worker.id}
                    className="h-10 border-b flex items-center px-2 min-w-[180px] hover:bg-muted/50 cursor-pointer group"
                    onClick={() => openEditModal(worker)}
                  >
                    <div
                      className={cn(
                        "w-2 h-8 rounded-full mr-2 flex-shrink-0",
                        getPositionColor(worker.position)
                      )}
                      title={worker.position || "No position"}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{worker.name || "Unnamed"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {worker.crew?.name || "No crew"}
                      </p>
                    </div>
                    <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                  </div>
                ))}
              </div>

              {/* Scrollable calendar grid */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-x-auto"
              >
                  <div className="inline-block min-w-max">
                    {/* Sticky header container */}
                    <div className="sticky top-0 z-10 bg-background">
                      {/* Month headers */}
                      <div className="flex h-6 border-b bg-muted/50">
                        {monthGroups.map(({ month, days }) => (
                          <div
                            key={month}
                            className="text-center text-xs font-semibold border-r flex items-center justify-center"
                            style={{ width: `${days.length * 32}px` }}
                          >
                            {getMonthName(month)}
                          </div>
                        ))}
                      </div>

                      {/* Day headers */}
                      <div className="flex h-10 border-b">
                        {yearDays.map((day) => {
                          const isToday = day.toISOString().split('T')[0] === today.toISOString().split('T')[0]
                          const isWeekend = day.getUTCDay() === 0 || day.getUTCDay() === 6
                          const isFirstOfMonth = day.getUTCDate() === 1

                          return (
                            <div
                              key={day.toISOString()}
                              className={cn(
                                "w-8 text-center text-xs flex flex-col items-center justify-center",
                                isWeekend && "bg-muted/50",
                                isToday && "bg-primary/20 font-bold",
                                isFirstOfMonth && "border-l border-gray-300"
                              )}
                            >
                              <span className="text-muted-foreground text-[10px]">
                                {["S", "M", "T", "W", "T", "F", "S"][day.getUTCDay()]}
                              </span>
                              <span className={cn("text-xs", isToday && "text-primary")}>
                                {day.getUTCDate()}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Schedule rows */}
                    {sortedWorkers.map((worker) => {
                      const userSchedules = schedulesByUser.get(worker.id)

                      return (
                        <div key={worker.id} className="flex h-10 border-b hover:bg-muted/20">
                          {yearDays.map((day) => {
                            // Use UTC date format to match schedule dates from API
                            const dateKey = `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, '0')}-${String(day.getUTCDate()).padStart(2, '0')}`
                            const schedule = userSchedules?.get(dateKey)
                            const isToday = day.toISOString().split('T')[0] === today.toISOString().split('T')[0]
                            const isWeekend = day.getUTCDay() === 0 || day.getUTCDay() === 6
                            const isFirstOfMonth = day.getUTCDate() === 1
                            const isOff = schedule?.shiftType === "OFF"

                            const isSelected = selectedCell?.workerId === worker.id && selectedCell?.date === dateKey

                            return (
                              <div
                                key={dateKey}
                                onClick={(e) => handleCellClick(e, worker.id, dateKey)}
                                className={cn(
                                  "w-8 h-10 flex items-center justify-center text-xs font-bold border-r cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all",
                                  isFirstOfMonth && "border-l border-l-gray-400",
                                  isToday && "ring-1 ring-primary ring-inset",
                                  isSelected && "ring-2 ring-primary",
                                  schedule && !isOff
                                    ? cn(
                                        SHIFT_COLORS[schedule.shiftType].bg,
                                        SHIFT_COLORS[schedule.shiftType].text
                                      )
                                    : cn(
                                        isWeekend ? "bg-gray-50" : "bg-white"
                                      )
                                )}
                                title={schedule && !isOff ? `${schedule.shiftType} - ${worker.name}` : "Click to add shift"}
                              >
                                {schedule && !isOff ? SHIFT_ABBREV[schedule.shiftType] : ""}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
          )}
      </div>

      {/* Shift Type Selection Popover */}
      {selectedCell && (
        <div
          className="fixed z-50 bg-background border rounded-lg shadow-lg p-2 min-w-[140px]"
          style={{
            left: Math.min(selectedCell.x, window.innerWidth - 160),
            top: Math.min(selectedCell.y + 4, window.innerHeight - 300),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
            {workers.find((w) => w.id === selectedCell.workerId)?.name} - {selectedCell.date}
          </div>
          <div className="grid gap-1">
            {/* Working shifts */}
            <div className="text-xs font-semibold text-muted-foreground px-2 pt-1">Working</div>
            {(["DAY", "NIGHT", "OCR_DAY", "OCR_NIGHT", "CCR_DAY", "CCR_NIGHT", "PS", "PL_DAY", "PL_NIGHT"] as ShiftType[]).map((type) => (
              <button
                key={type}
                disabled={cellSaving}
                onClick={() => saveCellShift(selectedCell.workerId, selectedCell.date, type)}
                className={cn(
                  "flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-muted transition-colors w-full text-left",
                  SHIFT_COLORS[type].bg,
                  SHIFT_COLORS[type].text
                )}
              >
                {SHIFT_ICONS[type]}
                <span>{type.replace(/_/g, " ")}</span>
                <span className="ml-auto opacity-70">{SHIFT_ABBREV[type]}</span>
              </button>
            ))}

            {/* Non-operational */}
            <div className="text-xs font-semibold text-muted-foreground px-2 pt-2">Other</div>
            {(["TRAINING", "OSCC"] as ShiftType[]).map((type) => (
              <button
                key={type}
                disabled={cellSaving}
                onClick={() => saveCellShift(selectedCell.workerId, selectedCell.date, type)}
                className={cn(
                  "flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-muted transition-colors w-full text-left",
                  SHIFT_COLORS[type].bg,
                  SHIFT_COLORS[type].text
                )}
              >
                <span>{type}</span>
                <span className="ml-auto opacity-70">{SHIFT_ABBREV[type]}</span>
              </button>
            ))}

            {/* Absence */}
            <div className="text-xs font-semibold text-muted-foreground px-2 pt-2">Absence</div>
            {(["VACATION", "SICK", "LEAVE"] as ShiftType[]).map((type) => (
              <button
                key={type}
                disabled={cellSaving}
                onClick={() => saveCellShift(selectedCell.workerId, selectedCell.date, type)}
                className={cn(
                  "flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-muted transition-colors w-full text-left",
                  SHIFT_COLORS[type].bg,
                  SHIFT_COLORS[type].text
                )}
              >
                <span>{type}</span>
                <span className="ml-auto opacity-70">{SHIFT_ABBREV[type]}</span>
              </button>
            ))}

            {/* Clear */}
            <div className="border-t mt-2 pt-2">
              <button
                disabled={cellSaving}
                onClick={() => saveCellShift(selectedCell.workerId, selectedCell.date, null)}
                className="flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-red-100 transition-colors w-full text-left text-red-600"
              >
                <span>Clear / Off</span>
              </button>
            </div>
          </div>
          {cellSaving && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* Click outside to close popover */}
      {selectedCell && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setSelectedCell(null)}
        />
      )}

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

            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="flex gap-2 w-full">
                <button
                  type="button"
                  onClick={() => setStartOnNights(false)}
                  className={cn(
                    "flex-1 py-3 px-4 rounded-lg font-medium text-base transition-colors",
                    !startOnNights
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                  )}
                >
                  ☀️ Start on Days
                </button>
                <button
                  type="button"
                  onClick={() => setStartOnNights(true)}
                  className={cn(
                    "flex-1 py-3 px-4 rounded-lg font-medium text-base transition-colors",
                    startOnNights
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                  )}
                >
                  🌙 Start on Nights
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              First rotation will be {startOnNights ? "nights" : "days"}, then alternate each cycle
            </p>

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

          {/* Quick Update Section (Vacation, Training, Sick, etc.) */}
          <div className="pt-4 border-t space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <h3 className="font-semibold">Quick Update (Vacation, Training, Sick, etc.)</h3>
            </div>

            {bulkSuccess && (
              <div className="p-3 text-sm text-green-600 bg-green-50 rounded-md">
                {bulkSuccess}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="bulkStart">Start Date</Label>
                <Input
                  id="bulkStart"
                  type="date"
                  value={bulkStartDate}
                  onChange={(e) => setBulkStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulkEnd">End Date</Label>
                <Input
                  id="bulkEnd"
                  type="date"
                  value={bulkEndDate}
                  onChange={(e) => setBulkEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulkType">Type</Label>
              <Select
                id="bulkType"
                value={bulkShiftType}
                onChange={(e) => setBulkShiftType(e.target.value)}
                options={[
                  // Absence / Leave
                  { value: "VACATION", label: "🏖️ Vacation" },
                  { value: "SICK", label: "🤒 Sick Leave" },
                  { value: "LEAVE", label: "📋 Scheduled Leave" },
                  { value: "OFF", label: "🏠 Off / Home" },
                  // Training
                  { value: "TRAINING", label: "📚 Training" },
                  { value: "OSCC", label: "🎓 OSCC Course" },
                  // Field Operations
                  { value: "DAY", label: "☀️ Day Shift" },
                  { value: "NIGHT", label: "🌙 Night Shift" },
                  // Control Room
                  { value: "OCR_DAY", label: "🖥️ OCR Day" },
                  { value: "OCR_NIGHT", label: "🖥️ OCR Night" },
                  { value: "CCR_DAY", label: "🎛️ CCR Day" },
                  { value: "CCR_NIGHT", label: "🎛️ CCR Night" },
                  // Backfill/Acting
                  { value: "PS", label: "👔 Production Supervisor" },
                  { value: "PL_DAY", label: "🧑‍💼 PL Day" },
                  { value: "PL_NIGHT", label: "🧑‍💼 PL Night" },
                  // Other
                  { value: "SHUTDOWN", label: "🔧 Shutdown" },
                ]}
              />
            </div>

            <Button
              onClick={applyBulkUpdate}
              disabled={bulkUpdating || !bulkStartDate || !bulkEndDate}
              className="w-full"
              variant="outline"
            >
              {bulkUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Apply to Date Range
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              These updates are saved as overrides and won&apos;t be cleared when regenerating the schedule.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
