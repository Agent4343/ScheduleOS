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
  Download,
  Maximize2,
  Minimize2,
  AlertTriangle,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ShiftType, UserRole, PositionType } from "@/types"

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
  positionType?: PositionType
  phone?: string | null
  role?: UserRole
  customRoleId?: string | null
  customRole?: {
    id: string
    name: string
    color: string
  } | null
  hireDate?: string | null
  sortOrder?: number
  isControlRoomTrained?: boolean
  isOilOperatorTrained?: boolean
  isUtilityOperatorTrained?: boolean
  isGasOperatorTrained?: boolean
  includeInStaffingCount?: boolean
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
  customRoleId: string
  hireDate: string
  isControlRoomTrained: boolean
  isOilOperatorTrained: boolean
  isUtilityOperatorTrained: boolean
  isGasOperatorTrained: boolean
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

interface CustomRole {
  id: string
  name: string
  description: string | null
  color: string
  baseRole: "ADMIN" | "SUPERVISOR" | "WORKER"
}

interface StaffingRule {
  id: string
  name: string
  description: string | null
  shiftType: "DAY" | "NIGHT"
  minWorkers: number
  maxVacation: number | null
  role: string | null
  positionType: string | null
  crewId: string | null
  priority: number
  isActive: boolean
  crew: { id: string; name: string; color: string } | null
}

interface StaffingAlert {
  date: string
  shiftType: "DAY" | "NIGHT"
  ruleName: string
  required: number
  actual: number
  shortage: number
  positionType?: string
  trainingType?: "controlRoom" | "oil" | "gas" | "utility"
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
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([])

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null)
  const [editForm, setEditForm] = useState<WorkerEditForm>({
    name: "",
    position: "",
    phone: "",
    crewId: "",
    role: "WORKER" as UserRole,
    customRoleId: "",
    hireDate: "",
    isControlRoomTrained: false,
    isOilOperatorTrained: false,
    isUtilityOperatorTrained: false,
    isGasOperatorTrained: false,
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

  // Focus mode - hides legend and summary for bigger schedule view
  const [focusMode, setFocusMode] = useState(false)

  // Staffing rules for alerts
  const [staffingRules, setStaffingRules] = useState<StaffingRule[]>([])

  // Worker breakdown modal state
  const [breakdownModalOpen, setBreakdownModalOpen] = useState(false)
  const [breakdownDate, setBreakdownDate] = useState<string>("")
  const [breakdownShift, setBreakdownShift] = useState<"DAY" | "NIGHT">("DAY")

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

  // Fetch custom roles
  useEffect(() => {
    async function fetchCustomRoles() {
      try {
        const response = await fetch("/api/roles")
        const result = await response.json()
        if (result.success) {
          setCustomRoles(result.data)
        }
      } catch (error) {
        console.error("Failed to fetch custom roles:", error)
      }
    }
    fetchCustomRoles()
  }, [])

  // Fetch staffing rules
  useEffect(() => {
    async function fetchStaffingRules() {
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
    fetchStaffingRules()
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

        const response = await fetch(url)
        const result = await response.json()

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

  // Calculate daily staffing counts by position type and shift
  const dailyStaffingCounts = useMemo(() => {
    // Create a map of date -> position type -> shift type -> count
    const counts: Record<string, {
      dayOps: number;
      dayOCR: number;
      dayCRTrained: number; // Control room trained
      dayOilTrained: number; // Oil operator trained
      dayUtilityTrained: number; // Utility operator trained
      dayGasTrained: number; // Gas operator trained
      dayTotal: number; // Total day shift workers
      nightOps: number;
      nightOCR: number;
      nightCRTrained: number;
      nightOilTrained: number;
      nightUtilityTrained: number;
      nightGasTrained: number;
      nightTotal: number; // Total night shift workers
      totalOnDuty: number;
    }> = {}

    // Create worker lookup for position and training status
    const workerInfo: Record<string, {
      posType: PositionType;
      isCRTrained: boolean;
      isOilTrained: boolean;
      isUtilityTrained: boolean;
      isGasTrained: boolean;
      includeInCount: boolean;
    }> = {}
    for (const worker of workers) {
      workerInfo[worker.id] = {
        posType: worker.positionType || PositionType.OTHER,
        isCRTrained: worker.isControlRoomTrained || false,
        isOilTrained: worker.isOilOperatorTrained || false,
        isUtilityTrained: worker.isUtilityOperatorTrained || false,
        isGasTrained: worker.isGasOperatorTrained || false,
        includeInCount: worker.includeInStaffingCount !== false,
      }
    }

    // Count schedules
    for (const schedule of schedules) {
      const dateStr = schedule.date.split("T")[0]
      if (!counts[dateStr]) {
        counts[dateStr] = {
          dayOps: 0, dayOCR: 0, dayCRTrained: 0, dayOilTrained: 0, dayUtilityTrained: 0, dayGasTrained: 0, dayTotal: 0,
          nightOps: 0, nightOCR: 0, nightCRTrained: 0, nightOilTrained: 0, nightUtilityTrained: 0, nightGasTrained: 0, nightTotal: 0,
          totalOnDuty: 0
        }
      }

      const info = workerInfo[schedule.user.id] || { posType: "OTHER", isCRTrained: false, isOilTrained: false, isUtilityTrained: false, isGasTrained: false, includeInCount: true }
      const isDay = schedule.shiftType === "DAY" || schedule.shiftType === "PL_DAY"
      const isNight = schedule.shiftType === "NIGHT" || schedule.shiftType === "PL_NIGHT"
      const isOnDuty = isDay || isNight || schedule.shiftType === "TRAINING" || schedule.shiftType === "SHUTDOWN"

      // Only count workers who have includeInStaffingCount enabled
      if (!info.includeInCount) {
        // Still count for total on duty display (they're working, just not in staffing minimums)
        if (isOnDuty) {
          counts[dateStr].totalOnDuty++
        }
        continue
      }

      if (isOnDuty) {
        counts[dateStr].totalOnDuty++
      }

      if (isDay) {
        counts[dateStr].dayTotal++
        if (info.posType === "OPERATOR") counts[dateStr].dayOps++
        if (info.posType === "ONSHORE_CONTROL_ROOM") counts[dateStr].dayOCR++
        if (info.isCRTrained) counts[dateStr].dayCRTrained++
        if (info.isOilTrained) counts[dateStr].dayOilTrained++
        if (info.isUtilityTrained) counts[dateStr].dayUtilityTrained++
        if (info.isGasTrained) counts[dateStr].dayGasTrained++
      } else if (isNight) {
        counts[dateStr].nightTotal++
        if (info.posType === "OPERATOR") counts[dateStr].nightOps++
        if (info.posType === "ONSHORE_CONTROL_ROOM") counts[dateStr].nightOCR++
        if (info.isCRTrained) counts[dateStr].nightCRTrained++
        if (info.isOilTrained) counts[dateStr].nightOilTrained++
        if (info.isUtilityTrained) counts[dateStr].nightUtilityTrained++
        if (info.isGasTrained) counts[dateStr].nightGasTrained++
      }
    }

    return counts
  }, [schedules, workers])

  // Helper to get daily count for a specific date
  function getDailyCount(month: number, day: number, field: keyof typeof dailyStaffingCounts[string]): number {
    const dateStr = formatDate(currentYear, month, day)
    return dailyStaffingCounts[dateStr]?.[field] || 0
  }

  // Get workers on a specific day and shift
  const getWorkersOnShift = useMemo(() => {
    // Build a map of date -> shift -> workers (using Set to deduplicate)
    const shiftWorkerIds: Record<string, { DAY: Set<string>; NIGHT: Set<string> }> = {}
    const shiftWorkers: Record<string, { DAY: Worker[]; NIGHT: Worker[] }> = {}

    for (const schedule of schedules) {
      const dateStr = schedule.date.split("T")[0]
      if (!shiftWorkerIds[dateStr]) {
        shiftWorkerIds[dateStr] = { DAY: new Set(), NIGHT: new Set() }
        shiftWorkers[dateStr] = { DAY: [], NIGHT: [] }
      }

      const isDay = schedule.shiftType === "DAY" || schedule.shiftType === "PL_DAY"
      const isNight = schedule.shiftType === "NIGHT" || schedule.shiftType === "PL_NIGHT"

      const worker = workers.find(w => w.id === schedule.user.id)
      if (worker) {
        // Only add if not already in the set (ensures one person per role)
        if (isDay && !shiftWorkerIds[dateStr].DAY.has(worker.id)) {
          shiftWorkerIds[dateStr].DAY.add(worker.id)
          shiftWorkers[dateStr].DAY.push(worker)
        }
        if (isNight && !shiftWorkerIds[dateStr].NIGHT.has(worker.id)) {
          shiftWorkerIds[dateStr].NIGHT.add(worker.id)
          shiftWorkers[dateStr].NIGHT.push(worker)
        }
      }
    }

    return (dateStr: string, shift: "DAY" | "NIGHT"): Worker[] => {
      return shiftWorkers[dateStr]?.[shift] || []
    }
  }, [schedules, workers])

  // Calculate staffing alerts based on rules
  const staffingAlerts = useMemo(() => {
    const alerts: StaffingAlert[] = []

    // Only process rules if we have any
    if (staffingRules.length === 0) return alerts

    // Check each day in the year that has schedules
    const datesWithSchedules = Array.from(new Set(schedules.map(s => s.date.split("T")[0])))

    for (const dateStr of datesWithSchedules) {
      for (const rule of staffingRules) {
        if (!rule.isActive) continue

        // Get workers on this shift and filter to only those who should be counted
        const shiftWorkers = getWorkersOnShift(dateStr, rule.shiftType)
          .filter(w => w.includeInStaffingCount !== false)

        // Filter by position type if specified
        let relevantWorkers = shiftWorkers
        if (rule.positionType) {
          relevantWorkers = shiftWorkers.filter(w => w.positionType === rule.positionType)
        }

        // Check if we meet the minimum
        if (relevantWorkers.length < rule.minWorkers) {
          alerts.push({
            date: dateStr,
            shiftType: rule.shiftType,
            ruleName: rule.name,
            required: rule.minWorkers,
            actual: relevantWorkers.length,
            shortage: rule.minWorkers - relevantWorkers.length,
            positionType: rule.positionType || undefined,
          })
        }
      }

      // Check training coverage for each shift type
      // Requirement: At least ONE person on each shift must have each training type
      const trainingTypes = [
        { key: "controlRoom" as const, field: "isControlRoomTrained", label: "Control Room Coverage" },
        { key: "oil" as const, field: "isOilOperatorTrained", label: "Oil Operator Coverage" },
        { key: "gas" as const, field: "isGasOperatorTrained", label: "Gas Operator Coverage" },
        { key: "utility" as const, field: "isUtilityOperatorTrained", label: "Utility Operator Coverage" },
      ]

      for (const shiftType of ["DAY", "NIGHT"] as const) {
        const shiftWorkers = getWorkersOnShift(dateStr, shiftType)
          .filter(w => w.includeInStaffingCount !== false)

        // Only check if there are workers scheduled on this shift
        if (shiftWorkers.length > 0) {
          for (const training of trainingTypes) {
            const trainedCount = shiftWorkers.filter(w => w[training.field]).length
            if (trainedCount < 1) {
              alerts.push({
                date: dateStr,
                shiftType,
                ruleName: training.label,
                required: 1,
                actual: 0,
                shortage: 1,
                trainingType: training.key,
              })
            }
          }
        }
      }
    }

    // Sort by date
    alerts.sort((a, b) => a.date.localeCompare(b.date))

    return alerts
  }, [schedules, staffingRules, getWorkersOnShift])

  // Group alerts by date for display
  const alertsByDate = useMemo(() => {
    const grouped: Record<string, StaffingAlert[]> = {}
    for (const alert of staffingAlerts) {
      if (!grouped[alert.date]) {
        grouped[alert.date] = []
      }
      grouped[alert.date].push(alert)
    }
    return grouped
  }, [staffingAlerts])

  // Get alerts for visible month (for the current view)
  const visibleAlerts = useMemo(() => {
    // Get current date info
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentDay = now.getDate()

    // Filter to show alerts from today forward, limit to next 30 days
    const todayStr = formatDate(currentYear, currentMonth, currentDay)
    const futureDate = new Date(now)
    futureDate.setDate(futureDate.getDate() + 30)
    const futureDateStr = formatDate(futureDate.getFullYear(), futureDate.getMonth(), futureDate.getDate())

    return staffingAlerts.filter(alert => {
      // Only show alerts for current year
      if (!alert.date.startsWith(String(currentYear))) {
        // But if viewing past/future year, show that year's alerts
        if (currentYear !== now.getFullYear()) {
          return alert.date.startsWith(String(currentYear))
        }
        return false
      }
      // Show upcoming alerts (from today for next 30 days)
      return alert.date >= todayStr && alert.date <= futureDateStr
    })
  }, [staffingAlerts, currentYear])

  // Open breakdown modal
  function openBreakdownModal(dateStr: string, shift: "DAY" | "NIGHT") {
    setBreakdownDate(dateStr)
    setBreakdownShift(shift)
    setBreakdownModalOpen(true)
  }

  function closeBreakdownModal() {
    setBreakdownModalOpen(false)
  }

  // Get breakdown workers for the modal
  const breakdownWorkers = useMemo(() => {
    if (!breakdownDate) return []
    return getWorkersOnShift(breakdownDate, breakdownShift)
  }, [breakdownDate, breakdownShift, getWorkersOnShift])

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
      customRoleId: worker.customRoleId || "",
      hireDate: hireDateStr,
      isControlRoomTrained: worker.isControlRoomTrained || false,
      isOilOperatorTrained: worker.isOilOperatorTrained || false,
      isUtilityOperatorTrained: worker.isUtilityOperatorTrained || false,
      isGasOperatorTrained: worker.isGasOperatorTrained || false,
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
          customRoleId: editForm.customRoleId || null,
          hireDate: editForm.hireDate || null,
          isControlRoomTrained: editForm.isControlRoomTrained,
          isOilOperatorTrained: editForm.isOilOperatorTrained,
          isUtilityOperatorTrained: editForm.isUtilityOperatorTrained,
          isGasOperatorTrained: editForm.isGasOperatorTrained,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        // Show detailed validation errors if available
        let errorMessage = result.error || "Failed to update worker"
        if (result.details && Array.isArray(result.details) && result.details.length > 0) {
          const fieldErrors = result.details.map((d: { field: string; message: string }) => `${d.field}: ${d.message}`).join(", ")
          errorMessage = `${errorMessage} (${fieldErrors})`
        }
        throw new Error(errorMessage)
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
                customRoleId: editForm.customRoleId || null,
                customRole: editForm.customRoleId
                  ? customRoles.find((r) => r.id === editForm.customRoleId) || null
                  : null,
                hireDate: editForm.hireDate || null,
                isControlRoomTrained: editForm.isControlRoomTrained,
                isOilOperatorTrained: editForm.isOilOperatorTrained,
                isUtilityOperatorTrained: editForm.isUtilityOperatorTrained,
                isGasOperatorTrained: editForm.isGasOperatorTrained,
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

      const response = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || result.details || "Failed to generate schedule")
      }

      setGenerateSuccess(`Generated ${result.data?.daysGenerated || 0} schedule days`)

      // Refresh schedules - include crew filter to maintain consistent view
      const refreshUrl = `/api/schedules?startDate=${currentYear}-01-01&endDate=${currentYear}-12-31${selectedCrew ? `&crewId=${selectedCrew}` : ""}`
      const schedulesResponse = await fetch(refreshUrl)
      const schedulesResult = await schedulesResponse.json()

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

        const response = await fetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        })

        const result = await response.json()

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
      const schedulesResponse = await fetch(refreshUrl)
      const schedulesResult = await schedulesResponse.json()

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

        <div className="flex items-center gap-2">
          <Button
            variant={focusMode ? "default" : "outline"}
            size="sm"
            onClick={() => setFocusMode(!focusMode)}
            title={focusMode ? "Exit focus mode" : "Enter focus mode - hide legend and summary"}
          >
            {focusMode ? <Minimize2 className="h-4 w-4 mr-2" /> : <Maximize2 className="h-4 w-4 mr-2" />}
            {focusMode ? "Exit Focus" : "Focus Mode"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.href = `/api/export?type=schedule-grid&year=${currentYear}`
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
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

      {/* Legend - hidden in focus mode */}
      {!focusMode && (
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
      )}

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
            <div className={cn("overflow-x-auto overflow-y-auto", focusMode ? "max-h-[90vh]" : "max-h-[70vh]")}>
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
                              "border p-1 text-center font-normal w-8 min-w-[32px]",
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
                                "border text-center w-8 min-w-[32px] h-8 cursor-pointer hover:ring-2 hover:ring-blue-300 dark:hover:ring-blue-500 hover:ring-inset transition-all",
                                !style && (isWeekend ? "bg-muted/50" : "bg-background dark:bg-gray-900/50"),
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

                  {/* Compliance Issues Row */}
                  <tr className="bg-muted/30 border-t-2 border-primary/20">
                    <td className="border p-2 sticky left-0 bg-red-50 dark:bg-red-950 z-20 font-semibold text-red-700 dark:text-red-300 text-xs">
                      Compliance
                    </td>
                    {yearMonths.map(({ month, days }) =>
                      days.map((day) => {
                        const dateStr = formatDate(currentYear, month, day)
                        const dayAlerts = alertsByDate[dateStr] || []
                        const hasIssues = dayAlerts.length > 0
                        const issueCount = dayAlerts.length
                        const dayIssues = dayAlerts.filter(a => a.shiftType === "DAY").length
                        const nightIssues = dayAlerts.filter(a => a.shiftType === "NIGHT").length

                        return (
                          <td
                            key={`compliance-${month}-${day}`}
                            className={cn(
                              "border text-center w-8 min-w-[32px] h-6 text-xs font-medium transition-all",
                              hasIssues
                                ? "bg-red-100 dark:bg-red-900 cursor-pointer hover:ring-2 hover:ring-red-400 hover:ring-inset"
                                : "bg-red-50/50 dark:bg-red-950/30"
                            )}
                            title={hasIssues ? `${issueCount} compliance issue${issueCount !== 1 ? 's' : ''} - Day: ${dayIssues}, Night: ${nightIssues}` : "No compliance issues"}
                            onClick={() => hasIssues && openBreakdownModal(dateStr, dayIssues > 0 ? "DAY" : "NIGHT")}
                          >
                            {hasIssues && (
                              <span className="text-red-600 dark:text-red-400 font-bold">
                                {issueCount > 1 ? issueCount : "!"}
                              </span>
                            )}
                          </td>
                        )
                      })
                    )}
                  </tr>

                  {/* Daily Staffing Summary Rows */}
                  <tr className="bg-muted/30">
                    <td className="border p-2 sticky left-0 bg-green-50 dark:bg-green-950 z-20 font-semibold text-green-700 dark:text-green-300 text-xs">
                      Day Shift
                    </td>
                    {yearMonths.map(({ month, days }) =>
                      days.map((day) => {
                        const dateStr = formatDate(currentYear, month, day)
                        const count = getDailyCount(month, day, "dayTotal")
                        const hasAlert = alertsByDate[dateStr]?.some(a => a.shiftType === "DAY")
                        return (
                          <td
                            key={`day-total-${month}-${day}`}
                            className={cn(
                              "border text-center w-8 min-w-[32px] h-6 text-xs font-medium cursor-pointer hover:ring-2 hover:ring-green-400 hover:ring-inset transition-all",
                              hasAlert ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300" : "bg-green-50 dark:bg-green-950"
                            )}
                            title={hasAlert ? "Click to see workers - Staffing alert!" : "Click to see workers on day shift"}
                            onClick={() => count > 0 && openBreakdownModal(dateStr, "DAY")}
                          >
                            {count > 0 ? count : ""}
                            {hasAlert && count > 0 && <span className="text-red-500">!</span>}
                          </td>
                        )
                      })
                    )}
                  </tr>
                  <tr className="bg-muted/30">
                    <td className="border p-2 sticky left-0 bg-blue-50 dark:bg-blue-950 z-20 font-semibold text-blue-700 dark:text-blue-300 text-xs">
                      Night Shift
                    </td>
                    {yearMonths.map(({ month, days }) =>
                      days.map((day) => {
                        const dateStr = formatDate(currentYear, month, day)
                        const count = getDailyCount(month, day, "nightTotal")
                        const hasAlert = alertsByDate[dateStr]?.some(a => a.shiftType === "NIGHT")
                        return (
                          <td
                            key={`night-total-${month}-${day}`}
                            className={cn(
                              "border text-center w-8 min-w-[32px] h-6 text-xs font-medium cursor-pointer hover:ring-2 hover:ring-blue-400 hover:ring-inset transition-all",
                              hasAlert ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300" : "bg-blue-50 dark:bg-blue-950"
                            )}
                            title={hasAlert ? "Click to see workers - Staffing alert!" : "Click to see workers on night shift"}
                            onClick={() => count > 0 && openBreakdownModal(dateStr, "NIGHT")}
                          >
                            {count > 0 ? count : ""}
                            {hasAlert && count > 0 && <span className="text-red-500">!</span>}
                          </td>
                        )
                      })
                    )}
                  </tr>
                  <tr className="bg-muted/50 border-t-2 border-primary/30">
                    <td className="border p-2 sticky left-0 bg-muted z-20 font-bold text-xs">
                      Total On Duty
                    </td>
                    {yearMonths.map(({ month, days }) =>
                      days.map((day) => {
                        const count = getDailyCount(month, day, "totalOnDuty")
                        return (
                          <td
                            key={`total-${month}-${day}`}
                            className="border text-center w-8 min-w-[32px] h-6 bg-muted text-xs font-bold"
                          >
                            {count > 0 ? count : ""}
                          </td>
                        )
                      })
                    )}
                  </tr>
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

          {customRoles.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="customRole">Custom Role</Label>
              <Select
                id="customRole"
                value={editForm.customRoleId}
                onChange={(e) => setEditForm({ ...editForm, customRoleId: e.target.value })}
                options={[
                  { value: "", label: "None" },
                  ...customRoles.map((role) => ({ value: role.id, label: role.name })),
                ]}
              />
            </div>
          )}

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

      {/* Worker Breakdown Modal */}
      <Modal
        isOpen={breakdownModalOpen}
        onClose={closeBreakdownModal}
        title={`${breakdownShift === "DAY" ? "Day" : "Night"} Shift Workers`}
        description={breakdownDate ? new Date(breakdownDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : ""}
      >
        <div className="space-y-4">
          {/* Show any alerts for this date/shift */}
          {alertsByDate[breakdownDate]?.filter(a => a.shiftType === breakdownShift).map((alert, idx) => (
            <div key={idx} className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">Staffing Alert: {alert.ruleName}</span>
              </div>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                Need {alert.required} workers{alert.positionType ? ` (${alert.positionType})` : ""}, have {alert.actual} — short by {alert.shortage}
              </p>
            </div>
          ))}

          {/* Training coverage summary */}
          {breakdownWorkers.length > 0 && (
            <div className="p-3 bg-muted/50 rounded-md">
              <h4 className="font-medium text-sm mb-2">Training Coverage:</h4>
              <p className="text-xs text-muted-foreground mb-2">
                Requirement: At least 1 person on shift must have each training type
              </p>
              <div className="flex flex-wrap gap-2">
                <span className={`text-xs px-2 py-1 rounded ${
                  breakdownWorkers.some(w => w.isControlRoomTrained)
                    ? "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300"
                    : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                }`}>
                  CR: {breakdownWorkers.filter(w => w.isControlRoomTrained).length > 0 ? "✓" : "✗"} ({breakdownWorkers.filter(w => w.isControlRoomTrained).length})
                </span>
                <span className={`text-xs px-2 py-1 rounded ${
                  breakdownWorkers.some(w => w.isOilOperatorTrained)
                    ? "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300"
                    : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                }`}>
                  Oil: {breakdownWorkers.filter(w => w.isOilOperatorTrained).length > 0 ? "✓" : "✗"} ({breakdownWorkers.filter(w => w.isOilOperatorTrained).length})
                </span>
                <span className={`text-xs px-2 py-1 rounded ${
                  breakdownWorkers.some(w => w.isGasOperatorTrained)
                    ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                    : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                }`}>
                  Gas: {breakdownWorkers.filter(w => w.isGasOperatorTrained).length > 0 ? "✓" : "✗"} ({breakdownWorkers.filter(w => w.isGasOperatorTrained).length})
                </span>
                <span className={`text-xs px-2 py-1 rounded ${
                  breakdownWorkers.some(w => w.isUtilityOperatorTrained)
                    ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                    : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                }`}>
                  Utility: {breakdownWorkers.filter(w => w.isUtilityOperatorTrained).length > 0 ? "✓" : "✗"} ({breakdownWorkers.filter(w => w.isUtilityOperatorTrained).length})
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Control Room: backup for onshore operations if needed
              </p>
            </div>
          )}

          {/* Worker list */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">
              {breakdownWorkers.length} worker{breakdownWorkers.length !== 1 ? "s" : ""} on {breakdownShift.toLowerCase()} shift:
            </h4>
            {breakdownWorkers.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No workers scheduled</p>
            ) : (
              <div className="grid gap-2">
                {breakdownWorkers.map((worker) => (
                  <div
                    key={worker.id}
                    className="flex items-center gap-3 p-2 bg-muted/50 rounded-md"
                  >
                    <div
                      className="w-3 h-8 rounded"
                      style={{ backgroundColor: worker.crew?.color || "#ccc" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{worker.name || "Unnamed"}</div>
                      <div className="text-xs text-muted-foreground flex gap-2">
                        <span>{worker.crew?.name || "No crew"}</span>
                        {worker.positionType && (
                          <>
                            <span>•</span>
                            <span>{worker.positionType.replace("_", " ")}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {/* Training badges */}
                    <div className="flex gap-1 flex-shrink-0">
                      {worker.isControlRoomTrained && (
                        <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded" title="Control Room Trained">CR</span>
                      )}
                      {worker.isOilOperatorTrained && (
                        <span className="text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded" title="Oil Operator Trained">Oil</span>
                      )}
                      {worker.isGasOperatorTrained && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded" title="Gas Operator Trained">Gas</span>
                      )}
                      {worker.isUtilityOperatorTrained && (
                        <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded" title="Utility Operator Trained">Util</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={closeBreakdownModal}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Staffing Alerts Section - shown below the schedule */}
      {!focusMode && visibleAlerts.length > 0 && (
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertTriangle className="h-5 w-5" />
              Staffing Alerts ({visibleAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {visibleAlerts.slice(0, 20).map((alert, idx) => {
                const alertDate = new Date(alert.date + "T12:00:00")
                const isToday = alert.date === formatDate(today.getFullYear(), today.getMonth(), today.getDate())
                const isTomorrow = (() => {
                  const tomorrow = new Date(today)
                  tomorrow.setDate(tomorrow.getDate() + 1)
                  return alert.date === formatDate(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate())
                })()

                return (
                  <Alert
                    key={`${alert.date}-${alert.shiftType}-${alert.ruleName}-${idx}`}
                    variant="destructive"
                    className="py-2"
                    showIcon={false}
                  >
                    <AlertTriangle className="h-4 w-4 absolute left-4 top-4" />
                    <AlertDescription className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">
                          {isToday ? "Today" : isTomorrow ? "Tomorrow" : alertDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        </span>
                        <span className="mx-2">•</span>
                        <span className={cn(
                          "font-medium",
                          alert.shiftType === "DAY" ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400"
                        )}>
                          {alert.shiftType}
                        </span>
                        <span className="mx-2">•</span>
                        <span>{alert.ruleName}</span>
                        {alert.positionType && (
                          <span className="text-muted-foreground ml-1">({alert.positionType})</span>
                        )}
                        <span className="ml-2 text-sm">
                          — Need {alert.required}, have {alert.actual} (short {alert.shortage})
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 ml-2"
                        onClick={() => openBreakdownModal(alert.date, alert.shiftType)}
                      >
                        View
                      </Button>
                    </AlertDescription>
                  </Alert>
                )
              })}
              {visibleAlerts.length > 20 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  And {visibleAlerts.length - 20} more alerts...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
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
