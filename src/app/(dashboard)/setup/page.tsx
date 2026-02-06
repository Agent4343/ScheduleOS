"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Modal } from "@/components/ui/modal"
import { Select } from "@/components/ui/select"
import { useToast } from "@/components/ui/toast"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Calendar,
  Users,
  Users2,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Wand2,
  Plus,
  X,
  Pencil,
  Trash2,
  MoreVertical,
  Settings,
  RefreshCw,
  Search,
  Filter,
  Mail,
} from "lucide-react"
import { UserRole, UserStatus } from "@/types"

// Types
interface Worker {
  id: string
  name: string | null
  email: string
  position: string | null
  status: UserStatus
  role: UserRole
  crewId: string | null
  crew: { id: string; name: string; color: string } | null
}

interface Crew {
  id: string
  name: string
  description: string | null
  color: string
  currentPhase: number
  rotationPatternId: string | null
  rotationPattern: RotationPattern | null
  _count?: { workers: number }
}

interface RotationPattern {
  id: string
  name: string
  description: string | null
  daysOn: number
  daysOff: number
  includesNights: boolean
  nightDays: number
  nightsAtStart: boolean
  alternatesShifts: boolean
  _count?: { crews: number }
}

const COLORS = [
  { value: "#3B82F6", label: "Blue" },
  { value: "#10B981", label: "Green" },
  { value: "#F59E0B", label: "Orange" },
  { value: "#8B5CF6", label: "Purple" },
  { value: "#EF4444", label: "Red" },
  { value: "#EC4899", label: "Pink" },
  { value: "#14B8A6", label: "Teal" },
  { value: "#6366F1", label: "Indigo" },
]

const STATUS_BADGES: Record<UserStatus, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  ACTIVE: { variant: "default", label: "Active" },
  INACTIVE: { variant: "secondary", label: "Inactive" },
  ON_LEAVE: { variant: "outline", label: "On Leave" },
  TERMINATED: { variant: "destructive", label: "Terminated" },
}

type TabType = "workers" | "crews" | "patterns" | "generate"

export default function SetupPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const { confirm, ConfirmDialog } = useConfirmDialog()

  // Main state
  const [activeTab, setActiveTab] = useState<TabType>("workers")
  const [workers, setWorkers] = useState<Worker[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [patterns, setPatterns] = useState<RotationPattern[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Worker tab state
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [crewFilter, setCrewFilter] = useState<string>("")
  const [showWorkerModal, setShowWorkerModal] = useState(false)
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null)
  const [workerForm, setWorkerForm] = useState({
    name: "",
    email: "",
    position: "",
    crewId: "",
    role: "WORKER" as UserRole,
    status: "ACTIVE" as UserStatus,
  })
  const [submittingWorker, setSubmittingWorker] = useState(false)
  const [openWorkerMenuId, setOpenWorkerMenuId] = useState<string | null>(null)
  const workerMenuRef = useRef<HTMLDivElement>(null)

  // Crew tab state
  const [showCrewModal, setShowCrewModal] = useState(false)
  const [editingCrew, setEditingCrew] = useState<Crew | null>(null)
  const [crewForm, setCrewForm] = useState({
    name: "",
    description: "",
    color: "#3B82F6",
    rotationPatternId: "",
    currentPhase: 0,
  })
  const [submittingCrew, setSubmittingCrew] = useState(false)
  const [openCrewMenuId, setOpenCrewMenuId] = useState<string | null>(null)
  const crewMenuRef = useRef<HTMLDivElement>(null)

  // Pattern tab state
  const [showPatternModal, setShowPatternModal] = useState(false)
  const [editingPattern, setEditingPattern] = useState<RotationPattern | null>(null)
  const [patternForm, setPatternForm] = useState({
    name: "",
    description: "",
    daysOn: 14,
    daysOff: 14,
    includesNights: false,
    nightDays: 7,
    nightsAtStart: true,
    alternatesShifts: false,
  })
  const [submittingPattern, setSubmittingPattern] = useState(false)

  // Generate tab state
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(new Set())
  const [selectedCrew, setSelectedCrew] = useState<string>("")
  const [selectedPattern, setSelectedPattern] = useState<string>("")
  const [startDate, setStartDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split("T")[0]
  })
  const [duration, setDuration] = useState("12")
  const [scheduleType, setScheduleType] = useState<"duration" | "endDate" | "ongoing">("duration")
  const [customEndDate, setCustomEndDate] = useState("")
  const [startShift, setStartShift] = useState<"day" | "night">("day")
  const [clearOverrides, setClearOverrides] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      const [workersRes, crewsRes, patternsRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/crews"),
        fetch("/api/rotation-patterns"),
      ])

      const workersData = await workersRes.json()
      const crewsData = await crewsRes.json()
      const patternsData = await patternsRes.json()

      if (workersData.success) setWorkers(workersData.data)
      if (crewsData.success) setCrews(crewsData.data)
      if (patternsData.success) setPatterns(patternsData.data)
    } catch {
      setError("Failed to load data")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (workerMenuRef.current && !workerMenuRef.current.contains(event.target as Node)) {
        setOpenWorkerMenuId(null)
      }
      if (crewMenuRef.current && !crewMenuRef.current.contains(event.target as Node)) {
        setOpenCrewMenuId(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // When crew is selected for generation, auto-select workers in that crew
  useEffect(() => {
    if (selectedCrew) {
      const crewWorkers = workers.filter((w) => w.crewId === selectedCrew && w.status === "ACTIVE")
      setSelectedWorkers(new Set(crewWorkers.map((w) => w.id)))
      const crew = crews.find((c) => c.id === selectedCrew)
      if (crew?.rotationPatternId) {
        setSelectedPattern(crew.rotationPatternId)
      }
    }
  }, [selectedCrew, workers, crews])

  // Filter workers
  const filteredWorkers = workers.filter((worker) => {
    const matchesSearch =
      !searchQuery ||
      worker.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      worker.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = !statusFilter || worker.status === statusFilter
    const matchesCrew = !crewFilter || worker.crew?.id === crewFilter
    return matchesSearch && matchesStatus && matchesCrew
  })

  const activeWorkers = workers.filter((w) => w.status === "ACTIVE")

  // ============ WORKER HANDLERS ============
  const openWorkerModal = (worker?: Worker) => {
    if (worker) {
      setEditingWorker(worker)
      setWorkerForm({
        name: worker.name || "",
        email: worker.email,
        position: worker.position || "",
        crewId: worker.crew?.id || "",
        role: worker.role,
        status: worker.status,
      })
    } else {
      setEditingWorker(null)
      setWorkerForm({
        name: "",
        email: "",
        position: "",
        crewId: "",
        role: "WORKER",
        status: "ACTIVE",
      })
    }
    setShowWorkerModal(true)
    setOpenWorkerMenuId(null)
  }

  const handleWorkerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingWorker(true)
    setError("")

    try {
      if (editingWorker) {
        const response = await fetch(`/api/users/${editingWorker.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: workerForm.name,
            email: workerForm.email,
            position: workerForm.position || null,
            crewId: workerForm.crewId || null,
            role: workerForm.role,
            status: workerForm.status,
          }),
        })
        const data = await response.json()
        if (data.success) {
          setWorkers((prev) => prev.map((w) => (w.id === editingWorker.id ? data.data : w)))
          setShowWorkerModal(false)
          addToast({ type: "success", message: "Worker updated successfully" })
        } else {
          setError(data.error || "Failed to update worker")
        }
      } else {
        const response = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: workerForm.name,
            email: workerForm.email,
            position: workerForm.position || null,
            crewId: workerForm.crewId || null,
            role: workerForm.role,
            status: workerForm.status,
          }),
        })
        const data = await response.json()
        if (data.success) {
          await fetchData()
          setShowWorkerModal(false)
          addToast({ type: "success", message: "Worker added successfully" })
        } else {
          setError(data.error || "Failed to add worker")
        }
      }
    } catch {
      setError("An error occurred")
    } finally {
      setSubmittingWorker(false)
    }
  }

  const handleDeleteWorker = (workerId: string) => {
    setOpenWorkerMenuId(null)
    confirm({
      title: "Delete Worker",
      description: "Are you sure you want to delete this worker? This action cannot be undone.",
      confirmText: "Delete",
      variant: "danger",
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/users/${workerId}`, { method: "DELETE" })
          const data = await response.json()
          if (data.success) {
            setWorkers((prev) => prev.filter((w) => w.id !== workerId))
            addToast({ type: "success", message: "Worker deleted" })
          } else {
            addToast({ type: "error", message: data.error || "Failed to delete" })
          }
        } catch {
          addToast({ type: "error", message: "Failed to delete worker" })
        }
      },
    })
  }

  // ============ CREW HANDLERS ============
  const openCrewModal = (crew?: Crew) => {
    if (crew) {
      setEditingCrew(crew)
      setCrewForm({
        name: crew.name,
        description: crew.description || "",
        color: crew.color,
        rotationPatternId: crew.rotationPattern?.id || "",
        currentPhase: crew.currentPhase,
      })
    } else {
      setEditingCrew(null)
      setCrewForm({
        name: "",
        description: "",
        color: "#3B82F6",
        rotationPatternId: "",
        currentPhase: 0,
      })
    }
    setShowCrewModal(true)
    setOpenCrewMenuId(null)
  }

  const handleCrewSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingCrew(true)

    try {
      if (editingCrew) {
        const response = await fetch(`/api/crews/${editingCrew.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: crewForm.name,
            description: crewForm.description || null,
            color: crewForm.color,
            rotationPatternId: crewForm.rotationPatternId || null,
            currentPhase: crewForm.currentPhase,
          }),
        })
        const data = await response.json()
        if (data.success) {
          setCrews((prev) => prev.map((c) => (c.id === editingCrew.id ? data.data : c)))
          setShowCrewModal(false)
          addToast({ type: "success", message: "Crew updated successfully" })
        } else {
          addToast({ type: "error", message: data.error || "Failed to update crew" })
        }
      } else {
        const response = await fetch("/api/crews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: crewForm.name,
            description: crewForm.description || null,
            color: crewForm.color,
            rotationPatternId: crewForm.rotationPatternId || null,
          }),
        })
        const data = await response.json()
        if (data.success) {
          setCrews((prev) => [...prev, data.data])
          setShowCrewModal(false)
          addToast({ type: "success", message: "Crew created successfully" })
        } else {
          addToast({ type: "error", message: data.error || "Failed to create crew" })
        }
      }
    } catch {
      addToast({ type: "error", message: "An error occurred" })
    } finally {
      setSubmittingCrew(false)
    }
  }

  const handleDeleteCrew = (crewId: string) => {
    setOpenCrewMenuId(null)
    confirm({
      title: "Delete Crew",
      description: "Are you sure you want to delete this crew? Workers in this crew will be unassigned.",
      confirmText: "Delete",
      variant: "danger",
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/crews/${crewId}`, { method: "DELETE" })
          const data = await response.json()
          if (data.success) {
            setCrews((prev) => prev.filter((c) => c.id !== crewId))
            addToast({ type: "success", message: "Crew deleted" })
          } else {
            addToast({ type: "error", message: data.error || "Failed to delete" })
          }
        } catch {
          addToast({ type: "error", message: "Failed to delete crew" })
        }
      },
    })
  }

  // ============ PATTERN HANDLERS ============
  const openPatternModal = (pattern?: RotationPattern) => {
    if (pattern) {
      setEditingPattern(pattern)
      setPatternForm({
        name: pattern.name,
        description: pattern.description || "",
        daysOn: pattern.daysOn,
        daysOff: pattern.daysOff,
        includesNights: pattern.includesNights,
        nightDays: pattern.nightDays,
        nightsAtStart: pattern.nightsAtStart,
        alternatesShifts: pattern.alternatesShifts,
      })
    } else {
      setEditingPattern(null)
      setPatternForm({
        name: "",
        description: "",
        daysOn: 14,
        daysOff: 14,
        includesNights: false,
        nightDays: 7,
        nightsAtStart: true,
        alternatesShifts: false,
      })
    }
    setShowPatternModal(true)
  }

  const handlePatternSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingPattern(true)

    try {
      if (editingPattern) {
        const response = await fetch(`/api/rotation-patterns?id=${editingPattern.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patternForm),
        })
        const data = await response.json()
        if (data.success) {
          setPatterns((prev) => prev.map((p) => (p.id === editingPattern.id ? data.data : p)))
          setShowPatternModal(false)
          addToast({ type: "success", message: "Pattern updated successfully" })
        } else {
          addToast({ type: "error", message: data.error || "Failed to update pattern" })
        }
      } else {
        const response = await fetch("/api/rotation-patterns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patternForm),
        })
        const data = await response.json()
        if (data.success) {
          setPatterns((prev) => [...prev, data.data])
          setShowPatternModal(false)
          addToast({ type: "success", message: "Pattern created successfully" })
        } else {
          addToast({ type: "error", message: data.error || "Failed to create pattern" })
        }
      }
    } catch {
      addToast({ type: "error", message: "An error occurred" })
    } finally {
      setSubmittingPattern(false)
    }
  }

  const handleDeletePattern = (patternId: string) => {
    confirm({
      title: "Delete Pattern",
      description: "Are you sure you want to delete this rotation pattern?",
      confirmText: "Delete",
      variant: "danger",
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/rotation-patterns?id=${patternId}`, { method: "DELETE" })
          const data = await response.json()
          if (data.success) {
            setPatterns((prev) => prev.filter((p) => p.id !== patternId))
            addToast({ type: "success", message: "Pattern deleted" })
          } else {
            addToast({ type: "error", message: data.error || "Failed to delete" })
          }
        } catch {
          addToast({ type: "error", message: "Failed to delete pattern" })
        }
      },
    })
  }

  // ============ GENERATE HANDLERS ============
  const toggleWorker = (workerId: string) => {
    const newSelected = new Set(selectedWorkers)
    if (newSelected.has(workerId)) {
      newSelected.delete(workerId)
    } else {
      newSelected.add(workerId)
    }
    setSelectedWorkers(newSelected)
  }

  const selectAllWorkers = () => {
    if (selectedWorkers.size === activeWorkers.length) {
      setSelectedWorkers(new Set())
    } else {
      setSelectedWorkers(new Set(activeWorkers.map((w) => w.id)))
    }
  }

  const getEndDate = () => {
    if (scheduleType === "ongoing") {
      const start = new Date(startDate)
      start.setFullYear(start.getFullYear() + 5)
      return start.toISOString().split("T")[0]
    }
    if (scheduleType === "endDate" && customEndDate) {
      return customEndDate
    }
    const start = new Date(startDate)
    start.setMonth(start.getMonth() + parseInt(duration))
    return start.toISOString().split("T")[0]
  }

  const handleGenerate = async () => {
    if (selectedWorkers.size === 0) {
      setError("Please select at least one worker")
      return
    }
    if (!selectedPattern) {
      setError("Please select a rotation pattern")
      return
    }
    if (!startDate) {
      setError("Please select a start date")
      return
    }

    const endDate = getEndDate()
    setIsGenerating(true)
    setError("")
    setSuccess("")

    try {
      const workerIds = Array.from(selectedWorkers)
      let successCount = 0
      const errors: string[] = []
      const pattern = patterns.find((p) => p.id === selectedPattern)

      for (const userId of workerIds) {
        const requestBody = {
          userId,
          patternId: selectedPattern,
          startDate,
          endDate,
          startPhase: 0,
          clearOverrides,
          ...(pattern?.includesNights && {
            startingShift: startShift === "day" ? "DAY" : "NIGHT",
          }),
        }

        const response = await fetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        })

        const data = await response.json()

        if (response.ok && data.success) {
          successCount++
        } else {
          errors.push(data.error || data.details || "Unknown error")
        }
      }

      if (successCount === 0) {
        const uniqueErrors = Array.from(new Set(errors))
        setError(`Failed to generate schedules: ${uniqueErrors.join(", ")}`)
        return
      }

      const scheduleYear = new Date(startDate).getFullYear()
      setSuccess(`Successfully generated schedules for ${successCount} of ${workerIds.length} worker(s)!`)

      setTimeout(() => {
        router.push(`/schedule?year=${scheduleYear}`)
      }, 2000)
    } catch {
      setError("Failed to generate schedules. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  const selectedPattern_obj = patterns.find((p) => p.id === selectedPattern)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Setup Center</h1>
        <p className="text-muted-foreground mt-1">
          Manage your workers, crews, rotation patterns, and generate schedules - all in one place
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-500 bg-green-50 text-green-700">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Tab Navigation */}
      <div className="border-b">
        <nav className="flex gap-4">
          {[
            { id: "workers" as TabType, label: "Workers", icon: Users, count: workers.length },
            { id: "crews" as TabType, label: "Crews", icon: Users2, count: crews.length },
            { id: "patterns" as TabType, label: "Rotation Patterns", icon: RefreshCw, count: patterns.length },
            { id: "generate" as TabType, label: "Generate Schedule", icon: Wand2 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.count !== undefined && (
                <Badge variant="secondary" className="ml-1">
                  {tab.count}
                </Badge>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px]">
        {/* ============ WORKERS TAB ============ */}
        {activeTab === "workers" && (
          <div className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search workers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    options={[
                      { value: "", label: "All Status" },
                      { value: "ACTIVE", label: "Active" },
                      { value: "INACTIVE", label: "Inactive" },
                      { value: "ON_LEAVE", label: "On Leave" },
                    ]}
                    className="w-32"
                  />
                  <Select
                    value={crewFilter}
                    onChange={(e) => setCrewFilter(e.target.value)}
                    options={[
                      { value: "", label: "All Crews" },
                      ...crews.map((crew) => ({ value: crew.id, label: crew.name })),
                    ]}
                    className="w-32"
                  />
                </div>
              </div>
              <Button onClick={() => openWorkerModal()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Worker
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                {filteredWorkers.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No workers found</p>
                    <Button className="mt-4" onClick={() => openWorkerModal()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Worker
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Worker</TableHead>
                        <TableHead>Crew</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredWorkers.map((worker) => (
                        <TableRow key={worker.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{worker.name || "Unnamed"}</p>
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {worker.email}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {worker.crew ? (
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: worker.crew.color }}
                                />
                                {worker.crew.name}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell>{worker.position || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={STATUS_BADGES[worker.status].variant}>
                              {STATUS_BADGES[worker.status].label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="relative" ref={openWorkerMenuId === worker.id ? workerMenuRef : null}>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setOpenWorkerMenuId(openWorkerMenuId === worker.id ? null : worker.id)}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                              {openWorkerMenuId === worker.id && (
                                <div className="absolute right-0 top-full mt-1 w-36 bg-background border rounded-md shadow-lg z-10">
                                  <button
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                                    onClick={() => openWorkerModal(worker)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                    Edit
                                  </button>
                                  <button
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 text-destructive"
                                    onClick={() => handleDeleteWorker(worker.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ============ CREWS TAB ============ */}
        {activeTab === "crews" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => openCrewModal()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Crew
              </Button>
            </div>

            {crews.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Users2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No crews yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first crew to organize workers into teams
                  </p>
                  <Button onClick={() => openCrewModal()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Crew
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {crews.map((crew) => (
                  <Card key={crew.id} className="relative overflow-hidden">
                    <div
                      className="absolute top-0 left-0 w-full h-1"
                      style={{ backgroundColor: crew.color }}
                    />
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                            style={{ backgroundColor: crew.color }}
                          >
                            {crew.name.charAt(0)}
                          </div>
                          <div>
                            <CardTitle className="text-lg">{crew.name}</CardTitle>
                            <CardDescription>{crew.description || "No description"}</CardDescription>
                          </div>
                        </div>
                        <div className="relative" ref={openCrewMenuId === crew.id ? crewMenuRef : null}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setOpenCrewMenuId(openCrewMenuId === crew.id ? null : crew.id)}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                          {openCrewMenuId === crew.id && (
                            <div className="absolute right-0 top-full mt-1 w-36 bg-background border rounded-md shadow-lg z-10">
                              <button
                                className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                                onClick={() => openCrewModal(crew)}
                              >
                                <Pencil className="h-4 w-4" />
                                Edit
                              </button>
                              <button
                                className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 text-destructive"
                                onClick={() => handleDeleteCrew(crew.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>Workers</span>
                        </div>
                        <Badge variant="secondary">{crew._count?.workers || 0}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>Pattern</span>
                        </div>
                        {crew.rotationPattern ? (
                          <Badge>{crew.rotationPattern.daysOn}/{crew.rotationPattern.daysOff}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">Not set</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Settings className="h-4 w-4" />
                          <span>Phase</span>
                        </div>
                        <span className="font-mono">Day {crew.currentPhase + 1}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============ PATTERNS TAB ============ */}
        {activeTab === "patterns" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => openPatternModal()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Pattern
              </Button>
            </div>

            {patterns.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <RefreshCw className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No rotation patterns</h3>
                  <p className="text-muted-foreground mb-4">
                    Create rotation patterns to define work schedules (e.g., 14 on / 14 off)
                  </p>
                  <Button onClick={() => openPatternModal()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Pattern
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {patterns.map((pattern) => (
                  <Card key={pattern.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{pattern.name}</CardTitle>
                          <CardDescription>{pattern.description || "No description"}</CardDescription>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openPatternModal(pattern)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeletePattern(pattern.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          {pattern.daysOn} days on
                        </Badge>
                        <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                          {pattern.daysOff} days off
                        </Badge>
                        {pattern.includesNights && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                            {pattern.alternatesShifts ? "Alternates shifts" : `${pattern.nightDays} nights`}
                          </Badge>
                        )}
                      </div>
                      {pattern._count && (
                        <p className="text-xs text-muted-foreground mt-3">
                          Used by {pattern._count.crews} crew(s)
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============ GENERATE TAB ============ */}
        {activeTab === "generate" && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Step 1: Select Workers */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <CardTitle className="text-lg">Select Workers</CardTitle>
                    <CardDescription>Choose a crew or individual workers</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Quick Select by Crew</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {crews.map((crew) => (
                      <Button
                        key={crew.id}
                        variant={selectedCrew === crew.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedCrew(selectedCrew === crew.id ? "" : crew.id)}
                        style={{
                          borderColor: crew.color,
                          ...(selectedCrew === crew.id && { backgroundColor: crew.color }),
                        }}
                      >
                        {crew.name}
                        {crew._count && (
                          <span className="ml-1 opacity-70">({crew._count.workers})</span>
                        )}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">Or Select Individual Workers</Label>
                    <Button variant="ghost" size="sm" onClick={selectAllWorkers}>
                      {selectedWorkers.size === activeWorkers.length ? "Deselect All" : "Select All"}
                    </Button>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-1 border rounded-lg p-2">
                    {activeWorkers.map((worker) => (
                      <div
                        key={worker.id}
                        className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                          selectedWorkers.has(worker.id)
                            ? "bg-primary/10 border border-primary"
                            : "hover:bg-muted border border-transparent"
                        }`}
                        onClick={() => toggleWorker(worker.id)}
                      >
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            selectedWorkers.has(worker.id)
                              ? "bg-primary border-primary"
                              : "border-muted-foreground"
                          }`}
                        >
                          {selectedWorkers.has(worker.id) && (
                            <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{worker.name || worker.email}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {worker.position || "No position"}
                            {worker.crew && (
                              <span
                                className="ml-2 px-1.5 py-0.5 rounded text-white"
                                style={{ backgroundColor: worker.crew.color }}
                              >
                                {worker.crew.name}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                    {activeWorkers.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">
                        No active workers found. Add workers first.
                      </p>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {selectedWorkers.size} worker(s) selected
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Step 2: Select Pattern */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <CardTitle className="text-lg">Choose Rotation</CardTitle>
                    <CardDescription>Select the work rotation pattern</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {patterns.map((pattern) => (
                    <div
                      key={pattern.id}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        selectedPattern === pattern.id
                          ? "border-primary bg-primary/5"
                          : "border-transparent bg-muted/50 hover:bg-muted"
                      }`}
                      onClick={() => setSelectedPattern(pattern.id)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{pattern.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {pattern.daysOn}/{pattern.daysOff}
                        </span>
                      </div>
                      {pattern.description && (
                        <p className="text-sm text-muted-foreground mt-1">{pattern.description}</p>
                      )}
                      <div className="flex gap-2 mt-2">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          {pattern.daysOn} days on
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                          {pattern.daysOff} days off
                        </span>
                        {pattern.includesNights && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            {pattern.alternatesShifts ? "alternates" : `${pattern.nightDays} nights`}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {patterns.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">
                      No rotation patterns found. Create one in the Patterns tab.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Step 3: Set Dates & Generate */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    3
                  </div>
                  <div>
                    <CardTitle className="text-lg">Set Dates</CardTitle>
                    <CardDescription>Choose the schedule period</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>

                  {selectedPattern_obj?.includesNights && (
                    <div>
                      <Label>Starting Shift</Label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <Button
                          type="button"
                          variant={startShift === "day" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setStartShift("day")}
                        >
                          Day Shift
                        </Button>
                        <Button
                          type="button"
                          variant={startShift === "night" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setStartShift("night")}
                        >
                          Night Shift
                        </Button>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label>Schedule Duration</Label>
                    <div className="grid grid-cols-3 gap-2 mt-1 mb-3">
                      <Button
                        type="button"
                        variant={scheduleType === "duration" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setScheduleType("duration")}
                      >
                        Duration
                      </Button>
                      <Button
                        type="button"
                        variant={scheduleType === "endDate" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setScheduleType("endDate")}
                      >
                        End Date
                      </Button>
                      <Button
                        type="button"
                        variant={scheduleType === "ongoing" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setScheduleType("ongoing")}
                      >
                        Ongoing
                      </Button>
                    </div>

                    {scheduleType === "duration" && (
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: "3", label: "3 mo" },
                          { value: "6", label: "6 mo" },
                          { value: "12", label: "1 year" },
                          { value: "18", label: "18 mo" },
                          { value: "24", label: "2 years" },
                          { value: "36", label: "3 years" },
                        ].map((option) => (
                          <Button
                            key={option.value}
                            type="button"
                            variant={duration === option.value ? "default" : "outline"}
                            size="sm"
                            onClick={() => setDuration(option.value)}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    )}

                    {scheduleType === "endDate" && (
                      <Input
                        type="date"
                        value={customEndDate}
                        min={startDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                      />
                    )}

                    {scheduleType === "ongoing" && (
                      <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                        Schedule will run continuously (generates 5 years)
                      </p>
                    )}
                  </div>
                </div>

                {/* Summary */}
                <div className="border-t pt-4 space-y-2">
                  <h4 className="font-medium">Summary</h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Workers:</span>
                      <span className="font-medium">{selectedWorkers.size}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pattern:</span>
                      <span className="font-medium">
                        {selectedPattern_obj ? selectedPattern_obj.name : "Not selected"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="clearOverrides"
                    checked={clearOverrides}
                    onChange={(e) => setClearOverrides(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <label htmlFor="clearOverrides" className="text-sm">
                    Clear manual edits
                  </label>
                </div>

                <Button
                  className="w-full gap-2"
                  size="lg"
                  onClick={handleGenerate}
                  disabled={isGenerating || selectedWorkers.size === 0 || !selectedPattern}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      Generate Schedules
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ============ MODALS ============ */}

      {/* Worker Modal */}
      <Modal
        isOpen={showWorkerModal}
        onClose={() => {
          setShowWorkerModal(false)
          setEditingWorker(null)
          setError("")
        }}
        title={editingWorker ? "Edit Worker" : "Add Worker"}
        description={editingWorker ? "Update worker information" : "Add a new worker to your organization"}
      >
        <form onSubmit={handleWorkerSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="worker-name">Name *</Label>
              <Input
                id="worker-name"
                value={workerForm.name}
                onChange={(e) => setWorkerForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="worker-email">Email *</Label>
              <Input
                id="worker-email"
                type="email"
                value={workerForm.email}
                onChange={(e) => setWorkerForm((prev) => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="worker-position">Position</Label>
              <Input
                id="worker-position"
                value={workerForm.position}
                onChange={(e) => setWorkerForm((prev) => ({ ...prev, position: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="worker-crew">Crew</Label>
              <Select
                value={workerForm.crewId}
                onChange={(e) => setWorkerForm((prev) => ({ ...prev, crewId: e.target.value }))}
                options={[
                  { value: "", label: "No Crew" },
                  ...crews.map((crew) => ({ value: crew.id, label: crew.name })),
                ]}
              />
            </div>
          </div>

          {editingWorker && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="worker-role">Role</Label>
                <Select
                  value={workerForm.role}
                  onChange={(e) => setWorkerForm((prev) => ({ ...prev, role: e.target.value as UserRole }))}
                  options={[
                    { value: "WORKER", label: "Worker" },
                    { value: "SUPERVISOR", label: "Supervisor" },
                    { value: "ADMIN", label: "Admin" },
                  ]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="worker-status">Status</Label>
                <Select
                  value={workerForm.status}
                  onChange={(e) => setWorkerForm((prev) => ({ ...prev, status: e.target.value as UserStatus }))}
                  options={[
                    { value: "ACTIVE", label: "Active" },
                    { value: "INACTIVE", label: "Inactive" },
                    { value: "ON_LEAVE", label: "On Leave" },
                    { value: "TERMINATED", label: "Terminated" },
                  ]}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => {
              setShowWorkerModal(false)
              setEditingWorker(null)
              setError("")
            }}>
              Cancel
            </Button>
            <Button type="submit" disabled={submittingWorker}>
              {submittingWorker ? "Saving..." : editingWorker ? "Save Changes" : "Add Worker"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Crew Modal */}
      <Modal
        isOpen={showCrewModal}
        onClose={() => {
          setShowCrewModal(false)
          setEditingCrew(null)
        }}
        title={editingCrew ? "Edit Crew" : "Add Crew"}
        description={editingCrew ? "Update crew settings" : "Create a new crew"}
      >
        <form onSubmit={handleCrewSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="crew-name">Crew Name *</Label>
            <Input
              id="crew-name"
              value={crewForm.name}
              onChange={(e) => setCrewForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Crew A"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="crew-description">Description</Label>
            <Input
              id="crew-description"
              value={crewForm.description}
              onChange={(e) => setCrewForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Optional description"
            />
          </div>

          <div className="space-y-2">
            <Label>Crew Color</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setCrewForm((prev) => ({ ...prev, color: color.value }))}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    crewForm.color === color.value
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="crew-pattern">Rotation Pattern</Label>
            <Select
              value={crewForm.rotationPatternId}
              onChange={(e) => setCrewForm((prev) => ({ ...prev, rotationPatternId: e.target.value }))}
              options={[
                { value: "", label: "No pattern" },
                ...patterns.map((p) => ({
                  value: p.id,
                  label: `${p.name} (${p.daysOn} on / ${p.daysOff} off)`,
                })),
              ]}
            />
          </div>

          {editingCrew && (
            <div className="space-y-2">
              <Label htmlFor="crew-phase">Current Phase (Day in rotation)</Label>
              <Input
                id="crew-phase"
                type="number"
                min="0"
                value={crewForm.currentPhase}
                onChange={(e) => setCrewForm((prev) => ({ ...prev, currentPhase: parseInt(e.target.value) || 0 }))}
              />
              <p className="text-xs text-muted-foreground">Day 0 = first day of rotation</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => {
              setShowCrewModal(false)
              setEditingCrew(null)
            }}>
              Cancel
            </Button>
            <Button type="submit" disabled={submittingCrew}>
              {submittingCrew ? "Saving..." : editingCrew ? "Save Changes" : "Create Crew"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Pattern Modal */}
      <Modal
        isOpen={showPatternModal}
        onClose={() => {
          setShowPatternModal(false)
          setEditingPattern(null)
        }}
        title={editingPattern ? "Edit Rotation Pattern" : "Add Rotation Pattern"}
        description={editingPattern ? "Update pattern settings" : "Create a new rotation pattern"}
      >
        <form onSubmit={handlePatternSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pattern-name">Pattern Name *</Label>
            <Input
              id="pattern-name"
              value={patternForm.name}
              onChange={(e) => setPatternForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., 14/14 Rotation"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pattern-description">Description</Label>
            <Input
              id="pattern-description"
              value={patternForm.description}
              onChange={(e) => setPatternForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Optional description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pattern-daysOn">Days On *</Label>
              <Input
                id="pattern-daysOn"
                type="number"
                min="1"
                value={patternForm.daysOn}
                onChange={(e) => setPatternForm((prev) => ({ ...prev, daysOn: parseInt(e.target.value) || 1 }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pattern-daysOff">Days Off *</Label>
              <Input
                id="pattern-daysOff"
                type="number"
                min="1"
                value={patternForm.daysOff}
                onChange={(e) => setPatternForm((prev) => ({ ...prev, daysOff: parseInt(e.target.value) || 1 }))}
                required
              />
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={patternForm.includesNights}
                onChange={(e) => setPatternForm((prev) => ({ ...prev, includesNights: e.target.checked }))}
                className="h-4 w-4"
              />
              <span className="font-medium">Includes Night Shifts</span>
            </label>

            {patternForm.includesNights && (
              <div className="ml-6 space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={patternForm.alternatesShifts}
                    onChange={(e) => setPatternForm((prev) => ({ ...prev, alternatesShifts: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  <span>Alternates day/night shifts</span>
                </label>

                {!patternForm.alternatesShifts && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="pattern-nightDays">Number of Night Days</Label>
                      <Input
                        id="pattern-nightDays"
                        type="number"
                        min="1"
                        max={patternForm.daysOn}
                        value={patternForm.nightDays}
                        onChange={(e) => setPatternForm((prev) => ({ ...prev, nightDays: parseInt(e.target.value) || 1 }))}
                      />
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={patternForm.nightsAtStart}
                        onChange={(e) => setPatternForm((prev) => ({ ...prev, nightsAtStart: e.target.checked }))}
                        className="h-4 w-4"
                      />
                      <span>Night shifts at start of rotation</span>
                    </label>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => {
              setShowPatternModal(false)
              setEditingPattern(null)
            }}>
              Cancel
            </Button>
            <Button type="submit" disabled={submittingPattern}>
              {submittingPattern ? "Saving..." : editingPattern ? "Save Changes" : "Create Pattern"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog />
    </div>
  )
}
