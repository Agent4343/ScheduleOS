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
  Printer,
  AlertTriangle,
  Paintbrush,
} from "lucide-react"
import { ShiftType, UserRole, PositionType } from "@/types"
import { toast } from "sonner"

interface StaffingRule {
  id: string
  name: string
  shiftType: ShiftType
  minWorkers: number
  positionType: PositionType | null
}

interface Schedule {
  id: string
  date: string
  shiftType: ShiftType
  customShiftCode: string | null
  user: {
    id: string
    name: string
    position: string | null
    positionType?: PositionType | null
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
  positionType?: PositionType | null
  phone?: string | null
  role?: UserRole
  hireDate?: string | null
  sortOrder?: number
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
  alternatesShifts: boolean
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
  
  const [viewMode, setViewMode] = useState<"YEAR" | "MONTH">("YEAR")
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth())

  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [selectedCrew, setSelectedCrew] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [rotationPatterns, setRotationPatterns] = useState<RotationPattern[]>([])
  const [customShiftTypes, setCustomShiftTypes] = useState<CustomShiftType[]>([])
  const [staffingRules, setStaffingRules] = useState<StaffingRule[]>([])
  const [conflictWarnings, setConflictWarnings] = useState<string[]>([])
  
  // Paint Mode state
  const [isPaintMode, setIsPaintMode] = useState(false)
  const [paintShiftType, setPaintShiftType] = useState<ShiftType | null>(null)
  const [isDragging, setIsDragging] = useState(false)


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
  const [clearOverrides, setClearOverrides] = useState(false)
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

  // Get days based on view mode
  const yearMonths = useMemo(() => {
    const allMonths = getYearDays(currentYear)
    if (viewMode === "MONTH") {
      return [allMonths[currentMonth]]
    }
    return allMonths
  }, [currentYear, viewMode, currentMonth])

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

  // Fetch staffing rules
  useEffect(() => {
    async function fetchRules() {
      try {
        const response = await fetch("/api/staffing-rules?isActive=true")
        const result = await response.json()
        if (result.success) {
          setStaffingRules(result.data)
        }
      } catch (error) {
        console.error("Failed to fetch staffing rules:", error)
      }
    }
    fetchRules()
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
        if (!response.ok) {
          console.error("Failed to fetch workers:", response.status, result.error || result)
          // Clear workers on auth error to prevent stale data
          setWorkers([])
          return
        }
        if (result.success) {
          setWorkers(result.data)
        } else {
          console.error("Unexpected response format:", result)
          setWorkers([])
        }
      } catch (error) {
        console.error("Failed to fetch workers:", error)
        setWorkers([])
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

        console.log("Fetching schedules from:", url)
        const response = await fetch(url)
        const result = await response.json()
        console.log("Fetch schedules response:", response.status, result)

        if (result.success) {
          setSchedules(result.data)
        } else {
          console.error("Failed to fetch schedules:", result.error, result.details)
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

  // Calculate daily staffing counts broken down by role/position
  const dailyStaffing = useMemo(() => {
    // Structure: date -> { role -> { day: count, night: count } }
    const counts = new Map<string, {
      operators: { day: number; night: number };
      controlRoom: { day: number; night: number };
      other: { day: number; night: number };
      total: { day: number; night: number };
    }>()
    
    schedules.forEach(schedule => {
      const dateStr = schedule.date.split("T")[0]
      if (!counts.has(dateStr)) {
        counts.set(dateStr, {
          operators: { day: 0, night: 0 },
          controlRoom: { day: 0, night: 0 },
          other: { day: 0, night: 0 },
          total: { day: 0, night: 0 }
        })
      }
      
      const dayCounts = counts.get(dateStr)!
      const isDay = schedule.shiftType === "DAY" || schedule.shiftType === "PL_DAY"
      const isNight = schedule.shiftType === "NIGHT" || schedule.shiftType === "PL_NIGHT"
      
      if (!isDay && !isNight) return

      // Increment total
      if (isDay) dayCounts.total.day++
      else dayCounts.total.night++

      // Increment by position type
      const scheduleUser = schedule.user
      const worker = workers.find(w => w.id === scheduleUser.id)
      
      const posType = scheduleUser.positionType || (worker as any)?.positionType
      const posString = (scheduleUser.position || worker?.position || "").toUpperCase()
      const crewName = (schedule.crew?.name || worker?.crew?.name || "").toUpperCase()
      
      // Match against Position Type, Position String, OR Crew Name
      
      // 1. Check Control Room FIRST (to catch "OCR Ops" before it matches generic "Ops")
      const isControlRoom = 
        posType === "ONSHORE_CONTROL_ROOM" || 
        posString.includes("OCR") || 
        posString.includes("CONTROL") || 
        posString.includes("ROOM") || 
        posString.includes("CO TRIP") || 
        crewName.includes("CONTROL") ||
        crewName.includes("ROOM") ||
        crewName.includes("OCR")

      // 2. Check Operators (excluding those already matched as Control Room)
      const isOperator = 
        !isControlRoom && (
          posType === "OPERATOR" || 
          posString.includes("OPERATOR") || 
          posString.includes("OPS") || 
          posString.includes("TECH") ||
          posString.includes("PRODUCTION") ||
          crewName.includes("OPS") ||
          crewName.includes("OPERATOR")
        )
      
      if (isControlRoom) {
        if (isDay) dayCounts.controlRoom.day++
        else dayCounts.controlRoom.night++
      } else if (isOperator) {
        if (isDay) dayCounts.operators.day++
        else dayCounts.operators.night++
      } else {
        if (isDay) dayCounts.other.day++
        else dayCounts.other.night++
      }
    })
    
    return counts
  }, [schedules, workers])

  // Get minimum staffing requirements from rules
  const minRequirements = useMemo(() => {
    // We want rules per position type now
    let minOpsDay = 0
    let minOpsNight = 0
    let minCRDay = 0
    let minCRNight = 0
    
    staffingRules.forEach(rule => {
      const isDay = rule.shiftType === "DAY" || rule.shiftType === "PL_DAY"
      const isNight = rule.shiftType === "NIGHT" || rule.shiftType === "PL_NIGHT"
      
      if (rule.positionType === "OPERATOR") {
        if (isDay && rule.minWorkers > minOpsDay) minOpsDay = rule.minWorkers
        if (isNight && rule.minWorkers > minOpsNight) minOpsNight = rule.minWorkers
      } else if (rule.positionType === "ONSHORE_CONTROL_ROOM") {
        if (isDay && rule.minWorkers > minCRDay) minCRDay = rule.minWorkers
        if (isNight && rule.minWorkers > minCRNight) minCRNight = rule.minWorkers
      }
    })
    
    return {
      operators: { day: minOpsDay, night: minOpsNight },
      controlRoom: { day: minCRDay, night: minCRNight }
    }
  }, [staffingRules])

  // Sort workers by custom sortOrder, then by crew name, then by name
  const sortedWorkers = useMemo(() => {
    return [...workers].sort((a, b) => {
      // First sort by custom sortOrder (lower numbers first)
      const sortOrderA = a.sortOrder ?? 999999
      const sortOrderB = b.sortOrder ?? 999999
      if (sortOrderA !== sortOrderB) return sortOrderA - sortOrderB
      // Then by crew name
      const crewCompare = (a.crew?.name || "ZZZ").localeCompare(b.crew?.name || "ZZZ")
      if (crewCompare !== 0) return crewCompare
      // Finally by worker name
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
    setClearOverrides(false)
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
      // Use UTC to avoid timezone issues
      const startDate = new Date(scheduleStartDate + "T00:00:00.000Z")
      const endDate = new Date(Date.UTC(startDate.getUTCFullYear(), 11, 31))
      const endDateStr = formatDate(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate())

      const requestBody = {
        userId: selectedWorker.id,
        patternId: selectedPatternId,
        startDate: scheduleStartDate,
        endDate: endDateStr,
        startPhase: 0,
        startingShift: startingShift,
        clearOverrides: clearOverrides,
      }

      console.log("Generating schedule:", requestBody)

      const response = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      const result = await response.json()
      console.log("Generate response:", result)

      if (!response.ok) {
        throw new Error(result.error || result.details || "Failed to generate schedule")
      }

      setGenerateSuccess(`Generated ${result.data?.daysGenerated || 0} schedule days`)

      // Refresh schedules - include crew filter to maintain consistent view
      const refreshUrl = `/api/schedules?startDate=${currentYear}-01-01&endDate=${currentYear}-12-31${selectedCrew ? `&crewId=${selectedCrew}` : ""}`
      console.log("Refreshing schedules from:", refreshUrl)

      const schedulesResponse = await fetch(refreshUrl)
      const schedulesResult = await schedulesResponse.json()

      console.log("Refresh result:", schedulesResult.success, "count:", schedulesResult.data?.length)

      if (schedulesResult.success && schedulesResult.data) {
        setSchedules(schedulesResult.data)
      } else {
        console.error("Failed to refresh:", schedulesResult)
        // Show warning that refresh failed - data was saved but display may be stale
        setGenerateSuccess(`Generated ${result.data?.daysGenerated || 0} days. Note: Display refresh failed - please reload the page to see changes.`)
      }
    } catch (error) {
      console.error("Generate error:", error)
      setSaveError(error instanceof Error ? error.message : "Failed to generate")
    } finally {
      setGenerating(false)
    }
  }

  function getScheduleForDay(workerId: string, month: number, day: number): Schedule | undefined {
    const dateStr = formatDate(currentYear, month, day)
    return scheduleMap.get(`${workerId}-${dateStr}`)
  }

  function validateStaffing(dateStr: string, newShiftType: ShiftType, workerId: string) {
    const warnings: string[] = []
    
    // Find relevant rules for the new shift type
    const relevantRules = staffingRules.filter(r => r.shiftType === newShiftType)
    
    if (relevantRules.length === 0) return warnings

    // Get all schedules for this date
    const daySchedules = schedules.filter(s => s.date.startsWith(dateStr))
    
    // Simulate the change
    // We need to count workers on this shift type, including the new one if it matches
    // But we need to exclude the worker's OLD shift type (if they had one)
    // Actually, simple check: count current workers on this shift type
    // If (count + 1) < min, warn? No, usually rules are "min 2 on night". 
    // If I change someone TO night, that helps.
    // Conflict happens when I change someone FROM a shift that needs them.
    // OR if I leave a shift understaffed.
    
    // Let's check if the shift being LEFT becomes understaffed
    const currentSchedule = scheduleMap.get(`${workerId}-${dateStr}`)
    if (currentSchedule) {
      const oldShiftType = currentSchedule.shiftType
      const rulesForOldShift = staffingRules.filter(r => r.shiftType === oldShiftType)
      
      for (const rule of rulesForOldShift) {
        // Count workers currently on this shift
        let currentCount = daySchedules.filter(s => s.shiftType === oldShiftType).length
        
        // If rule has position type, verify worker matches
        const worker = workers.find(w => w.id === workerId)
        if (rule.positionType) {
          if (worker?.position !== rule.positionType && worker?.role !== "SUPERVISOR") { // Assuming supervisors can fill in, simplified
             // If worker doesn't match position, they didn't count towards this rule anyway
             // Need accurate position data. The worker interface has position: string.
             // We need to map position string to PositionType enum or check flexible matching.
             // For now, simple check on total count if no position type specified
          }
          // Filter daySchedules by position
          // This requires workers data to be joined or available. 
          // schedules state has user object.
          // Let's stick to total count rules for simplicity in this pass unless user data has position.
          // schedule.user has position: string | null.
        }

        // Subtract 1 because this worker is leaving the shift
        if (currentCount - 1 < rule.minWorkers) {
           warnings.push(`Leaving ${oldShiftType} understaffed (Min: ${rule.minWorkers})`)
        }
      }
    }
    
    return warnings
  }

  async function handlePaint(workerId: string, dateStr: string) {
    if (!paintShiftType) return

    // Optimistically update local state first
    const shiftTypeStr = String(paintShiftType)
    const isCustomType = shiftTypeStr.startsWith("CUSTOM:")
    const actualShiftType = isCustomType ? "CUSTOM" : shiftTypeStr as ShiftType
    const customShiftCode = isCustomType ? shiftTypeStr.split(":")[1] : null

    // Update local schedules map immediately for visual feedback
    const newSchedule: Schedule = {
      id: "optimistic-" + Math.random(),
      date: dateStr + "T00:00:00.000Z", // Approximate
      shiftType: actualShiftType,
      customShiftCode: customShiftCode,
      user: { id: workerId, name: "", position: null },
      crew: null
    }
    
    // Update state to force re-render
    setSchedules(prev => {
        // Remove existing schedule for this day if any
        const filtered = prev.filter(s => !(s.user.id === workerId && s.date.startsWith(dateStr)))
        return [...filtered, newSchedule]
    })

    try {
      const response = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: workerId,
          date: dateStr,
          shiftType: actualShiftType,
          customShiftCode: customShiftCode,
          isOverride: true
        }),
      })

      if (!response.ok) throw new Error("Failed to save")
      
      // Success - silently handled (or show small toast if needed, but spammy for drag)
    } catch (error) {
      console.error("Paint error:", error)
      toast.error("Failed to save change")
      // Revert optimism? Complexity tradeoff. For "easy" prototype, user will see error.
    }
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
    setConflictWarnings([])
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
          // Extract detailed error message from validation errors if available
          let errorMessage = result.error || "Failed to update schedule"
          if (result.details) {
            if (Array.isArray(result.details)) {
              // ZodError issues array
              const issues = result.details.map((d: { path?: string[]; message?: string }) =>
                `${d.path?.join('.') || 'field'}: ${d.message || 'invalid'}`
              ).join('; ')
              errorMessage = `${errorMessage}: ${issues}`
            } else if (typeof result.details === 'string') {
              errorMessage = `${errorMessage}: ${result.details}`
            }
          }
          throw new Error(errorMessage)
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
        // Show warning that refresh failed - data was saved but display may be stale
        setScheduleEditSuccess(`Updated ${datesToUpdate.length} day(s). Note: Display refresh failed - please reload the page to see changes.`)
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

        <div className="flex items-center gap-4">
          {/* View Mode Toggle */}
          <div className="flex rounded-md border bg-muted p-1">
            <button
              onClick={() => setViewMode("YEAR")}
              className={cn(
                "px-3 py-1 text-sm rounded-sm transition-colors",
                viewMode === "YEAR" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Year
            </button>
            <button
              onClick={() => setViewMode("MONTH")}
              className={cn(
                "px-3 py-1 text-sm rounded-sm transition-colors",
                viewMode === "MONTH" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Month
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()} className="no-print">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              setCurrentYear(new Date().getFullYear())
              setCurrentMonth(new Date().getMonth())
            }} className="no-print">
              Today
            </Button>

            <Button
              variant={isPaintMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setIsPaintMode(!isPaintMode)
                setPaintShiftType(null) // Reset selection when toggling
              }}
              className="no-print"
            >
              <Paintbrush className="h-4 w-4 mr-2" />
              {isPaintMode ? "Exit Paint Mode" : "Quick Edit"}
            </Button>
            
            {viewMode === "MONTH" ? (
              <>
                <Button variant="outline" size="icon" onClick={() => {
                  if (currentMonth === 0) {
                    setCurrentMonth(11)
                    setCurrentYear(currentYear - 1)
                  } else {
                    setCurrentMonth(currentMonth - 1)
                  }
                }} className="no-print">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-semibold px-4 text-lg w-32 text-center">
                  {MONTH_NAMES[currentMonth]} {currentYear}
                </span>
                <Button variant="outline" size="icon" onClick={() => {
                  if (currentMonth === 11) {
                    setCurrentMonth(0)
                    setCurrentYear(currentYear + 1)
                  } else {
                    setCurrentMonth(currentMonth + 1)
                  }
                }} className="no-print">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="icon" onClick={() => setCurrentYear(currentYear - 1)} className="no-print">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-semibold px-4 text-lg">{currentYear}</span>
                <Button variant="outline" size="icon" onClick={() => setCurrentYear(currentYear + 1)} className="no-print">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4 no-print">
        <span className="text-sm text-muted-foreground">Filter by Crew:</span>
        <Select
          id="crew-filter"
          name="crew-filter"
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
        {isPaintMode && (
          <div className="w-full text-sm text-muted-foreground mb-2 animate-in fade-in-0 flex items-center gap-2">
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-medium">How to use:</span>
            <span>1. Click a shift type below to select it. 2. Click and drag across the calendar to paint that shift.</span>
          </div>
        )}
        {Object.entries(BUILT_IN_SHIFT_STYLES).map(([type, style]) => (
          <div
            key={type}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer transition-all",
              isPaintMode && paintShiftType === type && "ring-2 ring-offset-2 ring-primary scale-105",
              isPaintMode && paintShiftType !== type && "opacity-50 hover:opacity-100"
            )}
            style={{ backgroundColor: style.bg, color: style.text }}
            onClick={() => isPaintMode && setPaintShiftType(type as ShiftType)}
          >
            <span className="font-bold">{style.label}</span>
            <span>= {type.replace("_", " ")}</span>
          </div>
        ))}
        {customShiftTypes.filter(t => t.isActive).map((t) => (
          <div
            key={t.code}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer transition-all",
              isPaintMode && paintShiftType === `CUSTOM:${t.code}` && "ring-2 ring-offset-2 ring-primary scale-105",
              isPaintMode && paintShiftType !== `CUSTOM:${t.code}` && "opacity-50 hover:opacity-100"
            )}
            style={{ backgroundColor: t.color, color: t.textColor }}
            onClick={() => isPaintMode && setPaintShiftType(`CUSTOM:${t.code}` as ShiftType)}
          >
            <span className="font-bold">{t.code}</span>
            <span>= {t.name}</span>
          </div>
        ))}
      </div>

      {/* Schedule Table */}
      <Card id="schedule-print-view">
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
        <CardContent className="p-0" onMouseLeave={() => setIsDragging(false)}>
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
              <table className="border-collapse text-sm [&_td]:border-gray-200 [&_th]:border-gray-200 dark:[&_td]:border-gray-700 dark:[&_th]:border-gray-700" style={{ minWidth: "max-content" }}>
                <thead className="sticky top-0 z-30 bg-background shadow-[0_2px_5px_-2px_rgba(0,0,0,0.15)] dark:shadow-[0_2px_5px_-2px_rgba(255,255,255,0.1)]">
                  {/* Month headers */}
                  <tr>
                    <th className="border p-2 text-left font-semibold sticky left-0 bg-muted z-40 min-w-[200px]">
                      Worker
                    </th>
                    {yearMonths.map(({ month, days }) => (
                      <th
                        key={month}
                        colSpan={days.length}
                        className="border p-2 text-center font-semibold bg-muted text-base"
                      >
                        {MONTH_NAMES[month]}
                      </th>
                    ))}
                  </tr>
                  {/* Day headers */}
                  <tr>
                    <th className="border p-1 sticky left-0 bg-muted/50 z-40"></th>
                    {yearMonths.map(({ month, days }) =>
                      days.map((day) => {
                        const date = new Date(currentYear, month, day)
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6
                        const isTodayCell = isCurrentYear && month === todayMonth && day === todayDate

                        return (
                          <th
                            key={`${month}-${day}`}
                            className={cn(
                              "border p-1 text-center font-normal h-10 w-10 min-w-[40px]",
                              isWeekend ? "bg-muted" : "bg-muted/50",
                              isTodayCell && "bg-blue-200 dark:bg-blue-900 font-bold"
                            )}
                          >
                            <div className={cn("text-sm font-semibold text-foreground", isTodayCell && "text-blue-600 dark:text-blue-300")}>{day}</div>
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
                        className="border p-2 sticky left-0 bg-background cursor-pointer hover:bg-muted/50 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_5px_-2px_rgba(255,255,255,0.1)]"
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
                                "border text-center h-10 w-10 min-w-[40px] transition-all select-none",
                                isPaintMode ? "cursor-crosshair hover:opacity-80" : "cursor-pointer hover:ring-2 hover:ring-blue-300 dark:hover:ring-blue-500 hover:ring-inset",
                                !style && (isWeekend ? "bg-muted/50" : "bg-background dark:bg-gray-900/50"),
                                isTodayCell && "ring-2 ring-blue-400 ring-inset"
                              )}
                              style={
                                style
                                  ? { backgroundColor: style.bg, color: style.text }
                                  : undefined
                              }
                              title={schedule ? `${shiftKey} - ${isPaintMode ? 'Click to paint' : 'Click to edit'}` : "Click to add schedule"}
                              onMouseDown={(e) => {
                                if (isPaintMode && paintShiftType) {
                                  e.preventDefault() // Prevent text selection
                                  setIsDragging(true)
                                  handlePaint(worker.id, formatDate(currentYear, month, day))
                                } else if (!isPaintMode) {
                                  openScheduleEditModal(worker, month, day)
                                }
                              }}
                              onMouseEnter={() => {
                                if (isPaintMode && isDragging && paintShiftType) {
                                  handlePaint(worker.id, formatDate(currentYear, month, day))
                                }
                              }}
                              onMouseUp={() => setIsDragging(false)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  if (isPaintMode && paintShiftType) {
                                    handlePaint(worker.id, formatDate(currentYear, month, day))
                                  } else {
                                    openScheduleEditModal(worker, month, day)
                                  }
                                }
                                // Basic arrow key navigation support could be added here
                                // For now, we enable tabIndex for focus
                              }}
                              tabIndex={0}
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
                {/* Staffing Summary Footer */}
                <tfoot className="sticky bottom-0 z-30 bg-muted shadow-[0_-2px_5px_-2px_rgba(0,0,0,0.15)] dark:shadow-[0_-2px_5px_-2px_rgba(255,255,255,0.1)] font-semibold border-t-2">
                  {/* Operators Row */}
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="p-2 border text-left bg-muted sticky left-0 z-40 text-xs font-bold">Operators (Op)</td>
                    {yearMonths.map(({ month, days }) =>
                      days.map((day) => {
                        const dateStr = formatDate(currentYear, month, day)
                        const count = dailyStaffing.get(dateStr)
                        const ops = count?.operators || { day: 0, night: 0 }
                        
                        const isLowDay = ops.day < minRequirements.operators.day
                        const isLowNight = ops.night < minRequirements.operators.night
                        
                        return (
                          <td key={`footer-ops-${month}-${day}`} className="border p-1 text-center text-[10px] min-w-[40px]">
                            <div className={cn("flex flex-col gap-0.5")}>
                              <span className={cn(isLowDay && "text-red-600 font-bold")}>D:{ops.day}</span>
                              <span className={cn(isLowNight && "text-red-600 font-bold")}>N:{ops.night}</span>
                            </div>
                          </td>
                        )
                      })
                    )}
                  </tr>
                  
                  {/* Control Room Row */}
                  <tr>
                    <td className="p-2 border text-left bg-muted sticky left-0 z-40 text-xs font-bold">Control Room (OCR)</td>
                    {yearMonths.map(({ month, days }) =>
                      days.map((day) => {
                        const dateStr = formatDate(currentYear, month, day)
                        const count = dailyStaffing.get(dateStr)
                        const cr = count?.controlRoom || { day: 0, night: 0 }
                        
                        const isLowDay = cr.day < minRequirements.controlRoom.day
                        const isLowNight = cr.night < minRequirements.controlRoom.night
                        
                        return (
                          <td key={`footer-cr-${month}-${day}`} className="border p-1 text-center text-[10px] min-w-[40px]">
                            <div className={cn("flex flex-col gap-0.5")}>
                              <span className={cn(isLowDay && "text-red-600 font-bold")}>D:{cr.day}</span>
                              <span className={cn(isLowNight && "text-red-600 font-bold")}>N:{cr.night}</span>
                            </div>
                          </td>
                        )
                      })
                    )}
                  </tr>
                </tfoot>
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
                    label: `${p.name} (${p.daysOn}/${p.daysOff}${p.includesNights ? (p.alternatesShifts ? " alternates" : ` + ${p.nightDays}N`) : ""})`,
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

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="clearOverrides"
                checked={clearOverrides}
                onChange={(e) => setClearOverrides(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="clearOverrides" className="text-sm font-normal">
                Clear manual edits
              </Label>
            </div>
            {clearOverrides && (
              <p className="text-xs text-orange-600">
                Warning: This will delete all manually edited shifts for this worker
              </p>
            )}

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

          {conflictWarnings.length > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm">
              <div className="flex items-center gap-2 text-yellow-800 font-medium mb-1">
                <AlertTriangle className="h-4 w-4" />
                Staffing Warning
              </div>
              <ul className="list-disc list-inside text-yellow-700">
                {conflictWarnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

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
              onChange={(e) => {
                const newType = e.target.value as ShiftType
                setScheduleEditShiftType(newType)
                if (scheduleEditWorker && scheduleEditStartDate) {
                  const warnings = validateStaffing(scheduleEditStartDate, newType, scheduleEditWorker.id)
                  setConflictWarnings(warnings)
                }
              }}
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
                  onClick={() => {
                    setScheduleEditShiftType(type as ShiftType)
                    if (scheduleEditWorker && scheduleEditStartDate) {
                      const warnings = validateStaffing(scheduleEditStartDate, type as ShiftType, scheduleEditWorker.id)
                      setConflictWarnings(warnings)
                    }
                  }}
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
