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

// Shift colors for the Excel-like cells
const SHIFT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
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

// Get days in a month
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function SchedulePageContent() {
  const searchParams = useSearchParams()
  const yearFromUrl = searchParams.get("year")
  const monthFromUrl = searchParams.get("month")

  const [currentYear, setCurrentYear] = useState(() => {
    if (yearFromUrl) {
      const parsed = parseInt(yearFromUrl)
      if (!isNaN(parsed) && parsed >= 2020 && parsed <= 2100) return parsed
    }
    return new Date().getFullYear()
  })

  const [currentMonth, setCurrentMonth] = useState(() => {
    if (monthFromUrl) {
      const parsed = parseInt(monthFromUrl)
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 11) return parsed
    }
    return new Date().getMonth()
  })

  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [selectedCrew, setSelectedCrew] = useState<string>("")
  const [loading, setLoading] = useState(true)
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

  // Get days for current month
  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]

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

  // Fetch schedules for the month
  useEffect(() => {
    async function fetchSchedules() {
      setLoading(true)
      try {
        const startDate = formatDate(currentYear, currentMonth, 1)
        const endDate = formatDate(currentYear, currentMonth, daysInMonth)

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
  }, [currentYear, currentMonth, daysInMonth, selectedCrew])

  // Build schedule lookup map
  const scheduleMap = useMemo(() => {
    const map = new Map<string, Schedule>()
    for (const schedule of schedules) {
      // Extract date part from ISO string
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

  function navigateMonth(direction: number) {
    let newMonth = currentMonth + direction
    let newYear = currentYear

    if (newMonth < 0) {
      newMonth = 11
      newYear -= 1
    } else if (newMonth > 11) {
      newMonth = 0
      newYear += 1
    }

    setCurrentMonth(newMonth)
    setCurrentYear(newYear)
  }

  function goToToday() {
    const today = new Date()
    setCurrentYear(today.getFullYear())
    setCurrentMonth(today.getMonth())
  }

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

      setGenerateSuccess(
        `Generated ${result.data?.daysGenerated || 0} schedule days`
      )

      // Refresh schedules
      const fetchStartDate = formatDate(currentYear, currentMonth, 1)
      const fetchEndDate = formatDate(currentYear, currentMonth, daysInMonth)
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

  function getScheduleForDay(workerId: string, day: number): Schedule | undefined {
    const dateStr = formatDate(currentYear, currentMonth, day)
    return scheduleMap.get(`${workerId}-${dateStr}`)
  }

  const today = new Date()
  const isCurrentMonth = today.getFullYear() === currentYear && today.getMonth() === currentMonth
  const todayDate = today.getDate()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Schedule Calendar</h1>
          <p className="text-muted-foreground">
            {monthNames[currentMonth]} {currentYear} - {sortedWorkers.length} Workers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold px-2 min-w-[140px] text-center">
            {monthNames[currentMonth]} {currentYear}
          </span>
          <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
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
        {Object.entries(SHIFT_STYLES).map(([type, style]) => (
          <div
            key={type}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs"
            style={{ backgroundColor: style.bg, color: style.text }}
          >
            <span className="font-bold">{style.label}</span>
            <span>= {type}</span>
          </div>
        ))}
      </div>

      {/* Schedule Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {monthNames[currentMonth]} {currentYear}
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
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border p-2 text-left font-semibold sticky left-0 bg-muted/50 min-w-[180px]">
                      Worker
                    </th>
                    {monthDays.map((day) => {
                      const date = new Date(currentYear, currentMonth, day)
                      const dayName = date.toLocaleDateString("en-US", { weekday: "short" })
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6
                      const isTodayCell = isCurrentMonth && day === todayDate

                      return (
                        <th
                          key={day}
                          className={cn(
                            "border p-1 text-center min-w-[36px] font-normal",
                            isWeekend && "bg-gray-100",
                            isTodayCell && "bg-blue-100 font-bold"
                          )}
                        >
                          <div className="text-xs text-muted-foreground">{dayName.charAt(0)}</div>
                          <div className={cn(isTodayCell && "text-blue-600")}>{day}</div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sortedWorkers.map((worker) => (
                    <tr key={worker.id} className="hover:bg-muted/30">
                      <td
                        className="border p-2 sticky left-0 bg-background cursor-pointer hover:bg-muted/50"
                        onClick={() => openEditModal(worker)}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-8 rounded"
                            style={{ backgroundColor: worker.crew?.color || "#gray" }}
                          />
                          <div>
                            <div className="font-medium">{worker.name || "Unnamed"}</div>
                            <div className="text-xs text-muted-foreground">
                              {worker.crew?.name || "No crew"}
                            </div>
                          </div>
                          <Pencil className="h-3 w-3 text-muted-foreground ml-auto" />
                        </div>
                      </td>
                      {monthDays.map((day) => {
                        const schedule = getScheduleForDay(worker.id, day)
                        const date = new Date(currentYear, currentMonth, day)
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6
                        const isTodayCell = isCurrentMonth && day === todayDate
                        const style = schedule ? SHIFT_STYLES[schedule.shiftType] : null

                        return (
                          <td
                            key={day}
                            className={cn(
                              "border text-center font-bold",
                              isWeekend && !style && "bg-gray-50",
                              isTodayCell && "ring-2 ring-blue-400 ring-inset"
                            )}
                            style={
                              style
                                ? { backgroundColor: style.bg, color: style.text }
                                : undefined
                            }
                            title={schedule ? `${schedule.shiftType}` : "No schedule"}
                          >
                            {style ? style.label : "-"}
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
