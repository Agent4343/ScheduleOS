"use client"

import { Suspense, useEffect, useState, useMemo } from "react"
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
  customShiftCode: string | null
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

interface CustomShiftType {
  id: string
  code: string
  name: string
  color: string
  textColor: string
  description: string | null
  isActive: boolean
}

// Built-in shift colors for the Excel-like cells
const BUILT_IN_SHIFT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  DAY: { bg: "#22c55e", text: "#ffffff", label: "D" },
  NIGHT: { bg: "#2563eb", text: "#ffffff", label: "N" },
  OFF: { bg: "#e5e7eb", text: "#6b7280", label: "O" },
  LEAVE: { bg: "#f97316", text: "#ffffff", label: "L" },
  PL_DAY: { bg: "#14b8a6", text: "#ffffff", label: "PD" },
  PL_NIGHT: { bg: "#6366f1", text: "#ffffff", label: "PN" },
  VACATION: { bg: "#10b981", text: "#ffffff", label: "V" },
  SICK: { bg: "#ef4444", text: "#ffffff", label: "S" },
  TRAINING: { bg: "#eab308", text: "#000000", label: "T" },
  SHUTDOWN: { bg: "#64748b", text: "#ffffff", label: "X" },
}

// Format date as YYYY-MM-DD
function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

// Get all days in a year grouped by month
function getYearDays(year: number) {
  const months: { month: number; days: number[] }[] = []
  for (let month = 0; month < 12; month++) {
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    months.push({ month, days })
  }
  return months
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function SchedulePageContent() {
  const searchParams = useSearchParams()
  const yearFromUrl = searchParams.get("year")

  const [currentYear, setCurrentYear] = useState(() => {
    if (yearFromUrl) {
      const parsed = parseInt(yearFromUrl)
      if (!isNaN(parsed) && parsed >= 2020 && parsed <= 2100) return parsed
    }
    return new Date().getFullYear()
  })

  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [selectedCrew, setSelectedCrew] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [rotationPatterns, setRotationPatterns] = useState<RotationPattern[]>([])
  const [customShiftTypes, setCustomShiftTypes] = useState<CustomShiftType[]>([])

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

  // Schedule edit modal state (for updating individual days)
  const [scheduleEditModalOpen, setScheduleEditModalOpen] = useState(false)
  const [scheduleEditWorker, setScheduleEditWorker] = useState<Worker | null>(null)
  const [scheduleEditStartDate, setScheduleEditStartDate] = useState<string>("")
  const [scheduleEditEndDate, setScheduleEditEndDate] = useState<string>("")
  const [scheduleEditShiftType, setScheduleEditShiftType] = useState<ShiftType>("SICK")
  const [scheduleEditReason, setScheduleEditReason] = useState<string>("")
  const [scheduleEditSaving, setScheduleEditSaving] = useState(false)
  const [scheduleEditError, setScheduleEditError] = useState<string | null>(null)
  const [scheduleEditSuccess, setScheduleEditSuccess] = useState<string | null>(null)

  // Get all days for the year
  const yearMonths = useMemo(() => getYearDays(currentYear), [currentYear])

  // Combine built-in and custom shift styles
  const SHIFT_STYLES = useMemo(() => {
    const styles = { ...BUILT_IN_SHIFT_STYLES }
    for (const customType of customShiftTypes) {
      if (customType.isActive) {
        styles[`CUSTOM:${customType.code}`] = {
          bg: customType.color,
          text: customType.textColor,
          label: customType.code,
        }
      }
    }
    return styles
  }, [customShiftTypes])

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

  // Fetch custom shift types
  useEffect(() => {
    async function fetchCustomShiftTypes() {
      try {
        const response = await fetch("/api/custom-shift-types")
        const result = await response.json()
        if (result.success) {
          setCustomShiftTypes(result.data)
        }
      } catch (error) {
        console.error("Failed to fetch custom shift types:", error)
      }
    }
    fetchCustomShiftTypes()
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

  // Fetch schedules for the full year
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

  // Build schedule lookup map
  const scheduleMap = useMemo(() => {
    const map = new Map<string, Schedule>()
    for (const schedule of schedules) {
      const dateStr = schedule.date.split("T")[0]
      const key = `${schedule.user.id}-${dateStr}`
      map.set(key, schedule)
    }
    return map
  }, [schedules])

  // Sort workers
  const sortedWorkers = useMemo(() => {
    return [...workers].sort((a, b) => {
      const crewCompare = (a.crew?.name || "ZZZ").localeCompare(b.crew?.name || "ZZZ")
      if (crewCompare !== 0) return crewCompare
      return (a.name || "").localeCompare(b.name || "")
    })
  }, [workers])

  function openEditModal(worker: Worker) {
    setSelectedWorker(worker)

    let hireDateStr = ""
    if (worker.hireDate) {
      const hireDate = new Date(worker.hireDate)
      if (!isNaN(hireDate.getTime()) && hireDate.getFullYear() > 1970) {
        hireDateStr = formatDate(hireDate.getFullYear(), hireDate.getMonth(), hireDate.getDate())
      }
    }

    const today = new Date()
    const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate())

    setEditForm({
      name: worker.name || "",
      position: worker.position || "",
      phone: worker.phone || "",
      crewId: worker.crew?.id || "",
      role: worker.role || "WORKER",
      hireDate: hireDateStr,
    })
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
      const startDate = new Date(scheduleStartDate)
      const endDate = new Date(startDate.getFullYear(), 11, 31)
      const endDateStr = formatDate(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())

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

      setGenerateSuccess(`Generated ${result.data?.daysGenerated || 0} schedule days`)

      // Refresh schedules
      const schedulesResponse = await fetch(
        `/api/schedules?startDate=${currentYear}-01-01&endDate=${currentYear}-12-31`
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

  function getScheduleForDay(workerId: string, month: number, day: number): Schedule | undefined {
    const dateStr = formatDate(currentYear, month, day)
    return scheduleMap.get(`${workerId}-${dateStr}`)
  }

  // Open schedule edit modal when clicking on a cell
  function openScheduleEditModal(worker: Worker, month: number, day: number) {
    const dateStr = formatDate(currentYear, month, day)
    setScheduleEditWorker(worker)
    setScheduleEditStartDate(dateStr)
    setScheduleEditEndDate(dateStr)
    setScheduleEditShiftType("SICK")
    setScheduleEditReason("")
    setScheduleEditError(null)
    setScheduleEditSuccess(null)
    setScheduleEditModalOpen(true)
  }

  function closeScheduleEditModal() {
    setScheduleEditModalOpen(false)
    setScheduleEditWorker(null)
    setScheduleEditError(null)
    setScheduleEditSuccess(null)
  }

  async function saveScheduleEdit() {
    if (!scheduleEditWorker || !scheduleEditStartDate || !scheduleEditEndDate) return

    setScheduleEditSaving(true)
    setScheduleEditError(null)
    setScheduleEditSuccess(null)

    try {
      // Generate all dates in the range
      const start = new Date(scheduleEditStartDate)
      const end = new Date(scheduleEditEndDate)

      if (end < start) {
        throw new Error("End date must be on or after start date")
      }

      const datesToUpdate: string[] = []
      const current = new Date(start)
      while (current <= end) {
        // Use UTC methods to avoid timezone issues
        datesToUpdate.push(formatDate(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate()))
        current.setUTCDate(current.getUTCDate() + 1)
      }

      // Determine if this is a custom shift type
      const shiftTypeStr = String(scheduleEditShiftType)
      const isCustomType = shiftTypeStr.startsWith("CUSTOM:")
      const actualShiftType = isCustomType ? "CUSTOM" : shiftTypeStr
      const customShiftCode = isCustomType ? shiftTypeStr.split(":")[1] : null

      // Update each date
      for (const dateStr of datesToUpdate) {
        const requestBody = {
          userId: scheduleEditWorker.id,
          date: dateStr,
          shiftType: actualShiftType,
          customShiftCode: customShiftCode,
          isOverride: true,
          overrideReason: scheduleEditReason || null,
        }

        console.log("Saving schedule:", requestBody)

        const response = await fetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        })

        const result = await response.json()
        console.log("Save response:", result)

        if (!response.ok) {
          throw new Error(result.error || result.details || "Failed to update schedule")
        }
      }

      const displayName = isCustomType
        ? customShiftTypes.find(t => t.code === customShiftCode)?.name || customShiftCode
        : shiftTypeStr
      setScheduleEditSuccess(`Updated ${datesToUpdate.length} day(s) to ${displayName}`)

      // Refresh schedules - wait for completion
      const refreshUrl = `/api/schedules?startDate=${currentYear}-01-01&endDate=${currentYear}-12-31${selectedCrew ? `&crewId=${selectedCrew}` : ""}`
      console.log("Refreshing schedules from:", refreshUrl)

      const schedulesResponse = await fetch(refreshUrl)
      const schedulesResult = await schedulesResponse.json()

      console.log("Refresh result:", schedulesResult.success, "count:", schedulesResult.data?.length)

      if (schedulesResult.success && schedulesResult.data) {
        setSchedules(schedulesResult.data)
      } else {
        console.error("Failed to refresh schedules:", schedulesResult)
      }

      // Close modal after short delay to show success message
      setTimeout(() => {
        closeScheduleEditModal()
      }, 1500)
    } catch (error) {
      console.error("Schedule edit error:", error)
      setScheduleEditError(error instanceof Error ? error.message : "Failed to update schedule")
    } finally {
      setScheduleEditSaving(false)
    }
  }

  const today = new Date()
  const isCurrentYear = today.getFullYear() === currentYear
  const todayMonth = today.getMonth()
  const todayDate = today.getDate()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Schedule Calendar</h1>
          <p className="text-muted-foreground">
            {currentYear} - Full Year View - {sortedWorkers.length} Workers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentYear(new Date().getFullYear())}>
            This Year
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentYear(currentYear - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold px-4 text-lg">{currentYear}</span>
          <Button variant="outline" size="icon" onClick={() => setCurrentYear(currentYear + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Filter by Crew:</span>
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
        {Object.entries(BUILT_IN_SHIFT_STYLES).map(([type, style]) => (
          <div
            key={type}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs"
            style={{ backgroundColor: style.bg, color: style.text }}
          >
            <span className="font-bold">{style.label}</span>
            <span>= {type.replace("_", " ")}</span>
          </div>
        ))}
        {customShiftTypes.filter(t => t.isActive).map((t) => (
          <div
            key={t.code}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs"
            style={{ backgroundColor: t.color, color: t.textColor }}
          >
            <span className="font-bold">{t.code}</span>
            <span>= {t.name}</span>
          </div>
        ))}
      </div>

      {/* Schedule Table */}
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
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sortedWorkers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No workers found</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[80vh] overflow-y-auto">
              <table className="border-collapse text-sm" style={{ minWidth: "max-content" }}>
                <thead className="sticky top-0 z-30 shadow-[0_2px_5px_-2px_rgba(0,0,0,0.15)]">
                  {/* Month headers */}
                  <tr>
                    <th className="border p-2 text-left font-semibold sticky left-0 bg-gray-100 z-40 min-w-[200px]">
                      Worker
                    </th>
                    {yearMonths.map(({ month, days }) => (
                      <th
                        key={month}
                        colSpan={days.length}
                        className="border p-2 text-center font-semibold bg-gray-100 text-base"
                      >
                        {MONTH_NAMES[month]}
                      </th>
                    ))}
                  </tr>
                  {/* Day headers */}
                  <tr>
                    <th className="border p-1 sticky left-0 bg-gray-50 z-40"></th>
                    {yearMonths.map(({ month, days }) =>
                      days.map((day) => {
                        const date = new Date(currentYear, month, day)
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6
                        const isTodayCell = isCurrentYear && month === todayMonth && day === todayDate

                        return (
                          <th
                            key={`${month}-${day}`}
                            className={cn(
                              "border p-1 text-center font-normal w-8 min-w-[32px]",
                              isWeekend ? "bg-gray-200" : "bg-gray-50",
                              isTodayCell && "bg-blue-200 font-bold"
                            )}
                          >
                            <div className={cn("text-xs", isTodayCell && "text-blue-600")}>{day}</div>
                          </th>
                        )
                      })
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sortedWorkers.map((worker) => (
                    <tr key={worker.id} className="hover:bg-muted/20">
                      <td
                        className="border p-2 sticky left-0 bg-white cursor-pointer hover:bg-gray-50 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                        onClick={() => openEditModal(worker)}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-8 rounded"
                            style={{ backgroundColor: worker.crew?.color || "#ccc" }}
                          />
                          <div className="truncate max-w-[160px]">
                            <div className="font-medium truncate text-sm">{worker.name || "Unnamed"}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {worker.crew?.name || "No crew"}
                            </div>
                          </div>
                          <Pencil className="h-3 w-3 text-muted-foreground ml-auto flex-shrink-0" />
                        </div>
                      </td>
                      {yearMonths.map(({ month, days }) =>
                        days.map((day) => {
                          const schedule = getScheduleForDay(worker.id, month, day)
                          const date = new Date(currentYear, month, day)
                          const isWeekend = date.getDay() === 0 || date.getDay() === 6
                          const isTodayCell = isCurrentYear && month === todayMonth && day === todayDate
                          // Handle custom shift types by building the key
                          const shiftKey = schedule
                            ? schedule.shiftType === "CUSTOM" && schedule.customShiftCode
                              ? `CUSTOM:${schedule.customShiftCode}`
                              : schedule.shiftType
                            : null
                          const style = shiftKey ? SHIFT_STYLES[shiftKey] : null

                          return (
                            <td
                              key={`${month}-${day}`}
                              className={cn(
                                "border text-center w-8 min-w-[32px] h-8 cursor-pointer hover:ring-2 hover:ring-blue-300 hover:ring-inset transition-all",
                                isWeekend && !style && "bg-gray-100",
                                isTodayCell && "ring-2 ring-blue-400 ring-inset"
                              )}
                              style={
                                style
                                  ? { backgroundColor: style.bg, color: style.text }
                                  : undefined
                              }
                              title={schedule ? `${shiftKey} - Click to edit` : "Click to add schedule"}
                              onClick={() => openScheduleEditModal(worker, month, day)}
                            >
                              <span className="text-xs font-bold">
                                {style ? style.label : ""}
                              </span>
                            </td>
                          )
                        })
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
              placeholder="e.g., Operator, Technician"
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
            <Label htmlFor="hireDate">Hire Date</Label>
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
                    label: `${p.name} (${p.daysOn}/${p.daysOff}${p.includesNights ? ` + ${p.nightDays}N` : ""})`,
                  })),
                ]}
              />
            </div>

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
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="scheduleStart">Start Date</Label>
              <Input
                id="scheduleStart"
                type="date"
                value={scheduleStartDate}
                onChange={(e) => setScheduleStartDate(e.target.value)}
              />
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
                  Generate Schedule
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Schedule Edit Modal - for updating individual days or ranges */}
      <Modal
        isOpen={scheduleEditModalOpen}
        onClose={closeScheduleEditModal}
        title="Update Schedule"
        description={scheduleEditWorker?.name || "Update schedule entry"}
      >
        <div className="space-y-4">
          {scheduleEditError && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
              {scheduleEditError}
            </div>
          )}

          {scheduleEditSuccess && (
            <div className="p-3 text-sm text-green-600 bg-green-50 rounded-md">
              {scheduleEditSuccess}
            </div>
          )}

          <div className="p-3 bg-blue-50 rounded-md text-sm">
            <p className="font-medium text-blue-900">Worker: {scheduleEditWorker?.name}</p>
            <p className="text-blue-700">Select a date range and shift type below</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduleStartDate">Start Date</Label>
              <Input
                id="scheduleStartDate"
                type="date"
                value={scheduleEditStartDate}
                onChange={(e) => setScheduleEditStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduleEndDate">End Date</Label>
              <Input
                id="scheduleEndDate"
                type="date"
                value={scheduleEditEndDate}
                onChange={(e) => setScheduleEditEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="shiftType">Shift Type</Label>
            <Select
              id="shiftType"
              value={scheduleEditShiftType}
              onChange={(e) => setScheduleEditShiftType(e.target.value as ShiftType)}
              options={[
                { value: "SICK", label: "🤒 Sick" },
                { value: "VACATION", label: "🏖️ Vacation" },
                { value: "LEAVE", label: "📋 Leave" },
                { value: "DAY", label: "☀️ Day Shift" },
                { value: "NIGHT", label: "🌙 Night Shift" },
                { value: "OFF", label: "🏠 Off" },
                { value: "PL_DAY", label: "📅 PL Day" },
                { value: "PL_NIGHT", label: "🌃 PL Night" },
                { value: "TRAINING", label: "📚 Training" },
                { value: "SHUTDOWN", label: "🔧 Shutdown" },
                // Custom shift types
                ...customShiftTypes.filter(t => t.isActive).map(t => ({
                  value: `CUSTOM:${t.code}`,
                  label: `${t.name} (${t.code})`,
                })),
              ]}
            />
          </div>

          {/* Quick action buttons */}
          <div className="space-y-2">
            <Label>Quick Select</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { type: "SICK", label: "Sick", bg: "#ef4444" },
                { type: "VACATION", label: "Vacation", bg: "#10b981" },
                { type: "LEAVE", label: "Leave", bg: "#f97316" },
                { type: "OFF", label: "Off", bg: "#e5e7eb", text: "#6b7280" },
                { type: "DAY", label: "Day", bg: "#22c55e" },
                { type: "NIGHT", label: "Night", bg: "#2563eb" },
                // Add custom shift types to quick select
                ...customShiftTypes.filter(t => t.isActive).map(t => ({
                  type: `CUSTOM:${t.code}`,
                  label: t.code,
                  bg: t.color,
                  text: t.textColor,
                })),
              ].map(({ type, label, bg, text }) => (
                <Button
                  key={type}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setScheduleEditShiftType(type as ShiftType)}
                  className={cn(
                    "transition-all",
                    scheduleEditShiftType === type && "ring-2 ring-offset-2 ring-blue-500"
                  )}
                  style={{
                    backgroundColor: scheduleEditShiftType === type ? bg : undefined,
                    color: scheduleEditShiftType === type ? (text || "#ffffff") : undefined,
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scheduleReason">Reason (optional)</Label>
            <Input
              id="scheduleReason"
              value={scheduleEditReason}
              onChange={(e) => setScheduleEditReason(e.target.value)}
              placeholder="e.g., Doctor's appointment, Family vacation"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={closeScheduleEditModal} disabled={scheduleEditSaving}>
              Cancel
            </Button>
            <Button
              onClick={saveScheduleEdit}
              disabled={scheduleEditSaving || !scheduleEditStartDate || !scheduleEditEndDate}
            >
              {scheduleEditSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Schedule"
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
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SchedulePageContent />
    </Suspense>
  )
}
