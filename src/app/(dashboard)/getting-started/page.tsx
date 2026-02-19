"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Users2,
  Users,
  RefreshCw,
  Calendar,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Plus,
  X,
  ArrowRight,
  ArrowLeft,
  Wand2,
  Rocket,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SetupStatus {
  hasCrews: boolean
  hasWorkers: boolean
  hasPatterns: boolean
  hasSchedules: boolean
  crewCount: number
  workerCount: number
  patternCount: number
  completedSteps: number
  totalSteps: number
  isComplete: boolean
}

interface Crew {
  id: string
  name: string
  color: string
  rotationPatternId: string | null
  _count?: { workers: number }
}

interface Worker {
  id: string
  name: string | null
  email: string
  position: string | null
  crewId: string | null
  crew: { id: string; name: string; color: string } | null
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
  isDefault: boolean
  _count?: { crews: number }
}

const CREW_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b",
  "#8b5cf6", "#ec4899", "#06b6d4", "#f97316",
]

const STEP_CONFIGS = [
  { key: "crews", title: "Create Crews", desc: "Organize your workers into rotation groups", icon: Users2 },
  { key: "workers", title: "Add Workers", desc: "Add your team and assign them to crews", icon: Users },
  { key: "patterns", title: "Rotation Patterns", desc: "Define shift rotation schedules", icon: RefreshCw },
  { key: "schedules", title: "Generate Schedules", desc: "Build schedules from your setup", icon: Calendar },
] as const

export default function GettingStartedPage() {
  const router = useRouter()
  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [activeStep, setActiveStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Data
  const [crews, setCrews] = useState<Crew[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [patterns, setPatterns] = useState<RotationPattern[]>([])

  // Crew form
  const [showCrewForm, setShowCrewForm] = useState(false)
  const [crewForm, setCrewForm] = useState({ name: "", color: CREW_COLORS[0] })
  const [savingCrew, setSavingCrew] = useState(false)

  // Worker form
  const [showWorkerForm, setShowWorkerForm] = useState(false)
  const [workerForm, setWorkerForm] = useState({ name: "", email: "", position: "", crewId: "" })
  const [savingWorker, setSavingWorker] = useState(false)

  // Pattern form
  const [showPatternForm, setShowPatternForm] = useState(false)
  const [patternForm, setPatternForm] = useState({
    name: "", description: "", daysOn: "14", daysOff: "14",
    includesNights: false, nightDays: "7", nightsAtStart: true,
    alternatesShifts: false,
  })
  const [savingPattern, setSavingPattern] = useState(false)

  // Schedule generation
  const [selectedCrewForSchedule, setSelectedCrewForSchedule] = useState("")
  const [selectedPatternForSchedule, setSelectedPatternForSchedule] = useState("")
  const [scheduleStartDate, setScheduleStartDate] = useState(() => new Date().toISOString().split("T")[0])
  const [scheduleDuration, setScheduleDuration] = useState("12")
  const [startShift, setStartShift] = useState<"day" | "night">("day")
  const [generating, setGenerating] = useState(false)

  const fetchAll = useCallback(async () => {
    try {
      const [statusRes, crewsRes, workersRes, patternsRes] = await Promise.all([
        fetch("/api/setup-status"),
        fetch("/api/crews"),
        fetch("/api/users?status=ACTIVE"),
        fetch("/api/rotation-patterns"),
      ])

      const statusData = await statusRes.json()
      if (statusData.success) {
        setStatus(statusData.data)
        // Auto-advance to first incomplete step
        const steps = [statusData.data.hasCrews, statusData.data.hasWorkers, statusData.data.hasPatterns, statusData.data.hasSchedules]
        const firstIncomplete = steps.findIndex(s => !s)
        if (firstIncomplete >= 0) setActiveStep(firstIncomplete)
      }

      const crewsData = await crewsRes.json()
      if (crewsData.success) setCrews(crewsData.data)

      const workersData = await workersRes.json()
      if (workersData.success) setWorkers(workersData.data)

      const patternsData = await patternsRes.json()
      if (patternsData.success) setPatterns(patternsData.data)
    } catch {
      setError("Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const clearMessages = () => { setError(""); setSuccess("") }

  // ==================== CREW HANDLERS ====================
  const handleCreateCrew = async () => {
    if (!crewForm.name.trim()) { setError("Crew name is required"); return }
    clearMessages()
    setSavingCrew(true)
    try {
      const res = await fetch("/api/crews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: crewForm.name.trim(), color: crewForm.color }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSuccess(`Crew "${crewForm.name}" created!`)
        setCrewForm({ name: "", color: CREW_COLORS[(crews.length + 1) % CREW_COLORS.length] })
        setShowCrewForm(false)
        await fetchAll()
      } else {
        setError(data.error || "Failed to create crew")
      }
    } catch { setError("Failed to create crew") }
    finally { setSavingCrew(false) }
  }

  // ==================== WORKER HANDLERS ====================
  const handleCreateWorker = async () => {
    if (!workerForm.name.trim() || !workerForm.email.trim()) { setError("Name and email are required"); return }
    clearMessages()
    setSavingWorker(true)
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workerForm.name.trim(),
          email: workerForm.email.trim(),
          position: workerForm.position || null,
          crewId: workerForm.crewId || null,
          role: "WORKER",
          status: "ACTIVE",
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSuccess(`Worker "${workerForm.name}" added!`)
        setWorkerForm({ name: "", email: "", position: "", crewId: "" })
        setShowWorkerForm(false)
        await fetchAll()
      } else {
        setError(data.error || "Failed to add worker")
      }
    } catch { setError("Failed to add worker") }
    finally { setSavingWorker(false) }
  }

  // ==================== PATTERN HANDLERS ====================
  const handleCreatePattern = async () => {
    if (!patternForm.name.trim()) { setError("Pattern name is required"); return }
    clearMessages()
    setSavingPattern(true)
    try {
      const res = await fetch("/api/rotation-patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: patternForm.name.trim(),
          description: patternForm.description || null,
          daysOn: parseInt(patternForm.daysOn),
          daysOff: parseInt(patternForm.daysOff),
          includesNights: patternForm.includesNights,
          nightDays: patternForm.includesNights ? parseInt(patternForm.nightDays) : 0,
          nightsAtStart: patternForm.nightsAtStart,
          alternatesShifts: patternForm.alternatesShifts,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSuccess(`Pattern "${patternForm.name}" created!`)
        setPatternForm({
          name: "", description: "", daysOn: "14", daysOff: "14",
          includesNights: false, nightDays: "7", nightsAtStart: true,
          alternatesShifts: false,
        })
        setShowPatternForm(false)
        await fetchAll()
      } else {
        setError(data.error || "Failed to create pattern")
      }
    } catch { setError("Failed to create pattern") }
    finally { setSavingPattern(false) }
  }

  // ==================== SCHEDULE GENERATION ====================
  const handleGenerateSchedules = async () => {
    if (!selectedCrewForSchedule || !selectedPatternForSchedule) {
      setError("Please select a crew and pattern")
      return
    }
    clearMessages()
    setGenerating(true)

    try {
      const crewWorkers = workers.filter(w => w.crewId === selectedCrewForSchedule)
      if (crewWorkers.length === 0) {
        setError("No workers in this crew. Assign workers first.")
        setGenerating(false)
        return
      }

      const endDate = new Date(scheduleStartDate)
      endDate.setMonth(endDate.getMonth() + parseInt(scheduleDuration))
      const pattern = patterns.find(p => p.id === selectedPatternForSchedule)

      let successCount = 0
      for (const worker of crewWorkers) {
        const res = await fetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: worker.id,
            patternId: selectedPatternForSchedule,
            startDate: scheduleStartDate,
            endDate: endDate.toISOString().split("T")[0],
            startPhase: 0,
            ...(pattern?.includesNights && { startingShift: startShift === "day" ? "DAY" : "NIGHT" }),
          }),
        })
        const data = await res.json()
        if (res.ok && data.success) successCount++
      }

      if (successCount > 0) {
        setSuccess(`Generated schedules for ${successCount} worker(s)!`)
        await fetchAll()
      } else {
        setError("Failed to generate schedules")
      }
    } catch { setError("Failed to generate schedules") }
    finally { setGenerating(false) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const stepComplete = [
    status?.hasCrews ?? false,
    status?.hasWorkers ?? false,
    status?.hasPatterns ?? false,
    status?.hasSchedules ?? false,
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Rocket className="h-8 w-8 text-primary" />
          Getting Started
        </h1>
        <p className="text-muted-foreground mt-1">
          Set up ShiftSync in a few easy steps to start managing your workforce schedules.
        </p>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">
              Setup Progress: {status?.completedSteps ?? 0} of {status?.totalSteps ?? 4} steps
            </span>
            {status?.isComplete && (
              <Badge className="bg-green-100 text-green-700">All Done!</Badge>
            )}
          </div>
          <div className="w-full bg-muted rounded-full h-3">
            <div
              className="bg-primary h-3 rounded-full transition-all duration-500"
              style={{ width: `${((status?.completedSteps ?? 0) / (status?.totalSteps ?? 4)) * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Step Navigation */}
      <div className="grid grid-cols-4 gap-2">
        {STEP_CONFIGS.map((step, i) => (
          <button
            key={step.key}
            onClick={() => { setActiveStep(i); clearMessages() }}
            className={cn(
              "flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-center",
              activeStep === i
                ? "border-primary bg-primary/5"
                : "border-transparent hover:bg-muted",
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center",
              stepComplete[i]
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400"
                : activeStep === i
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
            )}>
              {stepComplete[i] ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-sm font-bold">{i + 1}</span>}
            </div>
            <span className="text-xs font-medium leading-tight">{step.title}</span>
          </button>
        ))}
      </div>

      {/* Active Step Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            {(() => { const Icon = STEP_CONFIGS[activeStep].icon; return <Icon className="h-6 w-6 text-primary" /> })()}
            <div>
              <CardTitle>{STEP_CONFIGS[activeStep].title}</CardTitle>
              <CardDescription>{STEP_CONFIGS[activeStep].desc}</CardDescription>
            </div>
            {stepComplete[activeStep] && (
              <Badge className="ml-auto bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400">Complete</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* ==================== STEP 1: CREWS ==================== */}
          {activeStep === 0 && (
            <div className="space-y-4">
              {crews.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Your Crews ({crews.length})</Label>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {crews.map(crew => (
                      <div
                        key={crew.id}
                        className="flex items-center gap-3 p-3 rounded-lg border"
                      >
                        <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: crew.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{crew.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {crew._count?.workers ?? 0} worker(s)
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Users2 className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>No crews yet. Create your first crew to organize your workers.</p>
                </div>
              )}

              {!showCrewForm ? (
                <Button onClick={() => { setShowCrewForm(true); clearMessages() }} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Crew
                </Button>
              ) : (
                <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">New Crew</Label>
                    <Button variant="ghost" size="icon" onClick={() => setShowCrewForm(false)}><X className="h-4 w-4" /></Button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="crew-name">Crew Name</Label>
                      <Input id="crew-name" placeholder="e.g. Alpha Crew" value={crewForm.name} onChange={e => setCrewForm({ ...crewForm, name: e.target.value })} />
                    </div>
                    <div>
                      <Label>Color</Label>
                      <div className="flex gap-2 mt-1">
                        {CREW_COLORS.map(color => (
                          <button
                            key={color}
                            className={cn("w-8 h-8 rounded-full border-2 transition-all", crewForm.color === color ? "border-foreground scale-110" : "border-transparent")}
                            style={{ backgroundColor: color }}
                            onClick={() => setCrewForm({ ...crewForm, color })}
                          />
                        ))}
                      </div>
                    </div>
                    <Button onClick={handleCreateCrew} disabled={savingCrew || !crewForm.name.trim()} className="gap-2">
                      {savingCrew ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Create Crew
                    </Button>
                  </div>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                Crews are groups of workers that share the same rotation schedule. Common examples: Alpha, Bravo, Charlie, Delta.
              </p>
            </div>
          )}

          {/* ==================== STEP 2: WORKERS ==================== */}
          {activeStep === 1 && (
            <div className="space-y-4">
              {workers.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Your Workers ({workers.length})</Label>
                  <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                    {workers.map(worker => (
                      <div key={worker.id} className="flex items-center gap-3 p-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {(worker.name || worker.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{worker.name || worker.email}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {worker.position || "No position"}
                          </p>
                        </div>
                        {worker.crew ? (
                          <Badge variant="outline" style={{ borderColor: worker.crew.color, color: worker.crew.color }}>
                            {worker.crew.name}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Unassigned</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>No workers yet. Add your team members to get started.</p>
                </div>
              )}

              {!showWorkerForm ? (
                <div className="flex gap-2">
                  <Button onClick={() => { setShowWorkerForm(true); clearMessages() }} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Worker
                  </Button>
                  <Button variant="outline" onClick={() => router.push("/workers")} className="gap-2">
                    <Users className="h-4 w-4" />
                    Manage Workers
                  </Button>
                </div>
              ) : (
                <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">New Worker</Label>
                    <Button variant="ghost" size="icon" onClick={() => setShowWorkerForm(false)}><X className="h-4 w-4" /></Button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="w-name">Name *</Label>
                      <Input id="w-name" placeholder="John Smith" value={workerForm.name} onChange={e => setWorkerForm({ ...workerForm, name: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor="w-email">Email *</Label>
                      <Input id="w-email" type="email" placeholder="john@example.com" value={workerForm.email} onChange={e => setWorkerForm({ ...workerForm, email: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor="w-position">Position</Label>
                      <Input id="w-position" placeholder="Operator" value={workerForm.position} onChange={e => setWorkerForm({ ...workerForm, position: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor="w-crew">Crew</Label>
                      <select
                        id="w-crew"
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                        value={workerForm.crewId}
                        onChange={e => setWorkerForm({ ...workerForm, crewId: e.target.value })}
                      >
                        <option value="">No crew</option>
                        {crews.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <Button onClick={handleCreateWorker} disabled={savingWorker || !workerForm.name.trim() || !workerForm.email.trim()} className="gap-2">
                    {savingWorker ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add Worker
                  </Button>
                </div>
              )}

              {crews.length === 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Create crews first (Step 1) so you can assign workers to them.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* ==================== STEP 3: ROTATION PATTERNS ==================== */}
          {activeStep === 2 && (
            <div className="space-y-4">
              {patterns.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Your Patterns ({patterns.length})</Label>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {patterns.map(pattern => (
                      <div key={pattern.id} className="p-3 rounded-lg border space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{pattern.name}</p>
                          <span className="text-sm text-muted-foreground">{pattern.daysOn}/{pattern.daysOff}</span>
                        </div>
                        {pattern.description && <p className="text-xs text-muted-foreground">{pattern.description}</p>}
                        <div className="flex gap-1.5 flex-wrap">
                          <Badge variant="outline" className="text-xs">{pattern.daysOn} days on</Badge>
                          <Badge variant="outline" className="text-xs">{pattern.daysOff} days off</Badge>
                          {pattern.includesNights && <Badge variant="outline" className="text-xs">Nights</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <RefreshCw className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>No rotation patterns yet. Define how your crews rotate shifts.</p>
                </div>
              )}

              {!showPatternForm ? (
                <Button onClick={() => { setShowPatternForm(true); clearMessages() }} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Pattern
                </Button>
              ) : (
                <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">New Rotation Pattern</Label>
                    <Button variant="ghost" size="icon" onClick={() => setShowPatternForm(false)}><X className="h-4 w-4" /></Button>
                  </div>

                  {/* Quick presets */}
                  <div>
                    <Label className="text-sm text-muted-foreground">Quick Presets</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {[
                        { label: "14/14", name: "14 on / 14 off", daysOn: "14", daysOff: "14", nights: false },
                        { label: "7/7", name: "7 on / 7 off", daysOn: "7", daysOff: "7", nights: false },
                        { label: "14/14 D+N", name: "14 on / 14 off (Day+Night)", daysOn: "14", daysOff: "14", nights: true },
                        { label: "28/28", name: "28 on / 28 off", daysOn: "28", daysOff: "28", nights: false },
                        { label: "5/2", name: "5 on / 2 off (M-F)", daysOn: "5", daysOff: "2", nights: false },
                      ].map(preset => (
                        <Button
                          key={preset.label}
                          variant="outline"
                          size="sm"
                          onClick={() => setPatternForm({
                            ...patternForm,
                            name: preset.name,
                            daysOn: preset.daysOn,
                            daysOff: preset.daysOff,
                            includesNights: preset.nights,
                            nightDays: preset.nights ? String(Math.floor(parseInt(preset.daysOn) / 2)) : "0",
                          })}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <Label htmlFor="p-name">Pattern Name *</Label>
                      <Input id="p-name" placeholder="e.g. 14 on / 14 off" value={patternForm.name} onChange={e => setPatternForm({ ...patternForm, name: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor="p-dayson">Days On</Label>
                      <Input id="p-dayson" type="number" min="1" value={patternForm.daysOn} onChange={e => setPatternForm({ ...patternForm, daysOn: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor="p-daysoff">Days Off</Label>
                      <Input id="p-daysoff" type="number" min="1" value={patternForm.daysOff} onChange={e => setPatternForm({ ...patternForm, daysOff: e.target.value })} />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="includes-nights"
                      checked={patternForm.includesNights}
                      onChange={e => setPatternForm({ ...patternForm, includesNights: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="includes-nights" className="text-sm">Includes night shifts</Label>
                  </div>

                  {patternForm.includesNights && (
                    <div className="grid sm:grid-cols-2 gap-3 pl-6">
                      <div>
                        <Label htmlFor="p-nightdays">Night Shift Days</Label>
                        <Input id="p-nightdays" type="number" min="1" value={patternForm.nightDays} onChange={e => setPatternForm({ ...patternForm, nightDays: e.target.value })} />
                      </div>
                      <div>
                        <Label>Night Position</Label>
                        <div className="flex gap-2 mt-1">
                          <Button type="button" variant={patternForm.nightsAtStart ? "default" : "outline"} size="sm" onClick={() => setPatternForm({ ...patternForm, nightsAtStart: true })}>Start</Button>
                          <Button type="button" variant={!patternForm.nightsAtStart ? "default" : "outline"} size="sm" onClick={() => setPatternForm({ ...patternForm, nightsAtStart: false })}>End</Button>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button onClick={handleCreatePattern} disabled={savingPattern || !patternForm.name.trim()} className="gap-2">
                    {savingPattern ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Create Pattern
                  </Button>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                A rotation pattern defines how crews cycle between on-duty and off-duty periods.
                Common offshore patterns: 14/14, 28/28, 7/7.
              </p>
            </div>
          )}

          {/* ==================== STEP 4: GENERATE SCHEDULES ==================== */}
          {activeStep === 3 && (
            <div className="space-y-4">
              {status?.hasSchedules && (
                <Alert className="border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Schedules have been generated! You can generate more or go to the{" "}
                    <a href="/schedule" className="underline font-medium">schedule view</a>.
                  </AlertDescription>
                </Alert>
              )}

              {crews.length === 0 || patterns.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Complete steps 1-3 first. You need at least one crew with workers and one rotation pattern.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="s-crew">Select Crew</Label>
                      <select
                        id="s-crew"
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm mt-1"
                        value={selectedCrewForSchedule}
                        onChange={e => setSelectedCrewForSchedule(e.target.value)}
                      >
                        <option value="">Choose a crew...</option>
                        {crews.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c._count?.workers ?? 0} workers)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="s-pattern">Rotation Pattern</Label>
                      <select
                        id="s-pattern"
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm mt-1"
                        value={selectedPatternForSchedule}
                        onChange={e => setSelectedPatternForSchedule(e.target.value)}
                      >
                        <option value="">Choose a pattern...</option>
                        {patterns.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.daysOn} on / {p.daysOff} off)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="s-start">Start Date</Label>
                      <Input id="s-start" type="date" value={scheduleStartDate} onChange={e => setScheduleStartDate(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="s-duration">Duration</Label>
                      <select
                        id="s-duration"
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm mt-1"
                        value={scheduleDuration}
                        onChange={e => setScheduleDuration(e.target.value)}
                      >
                        <option value="3">3 months</option>
                        <option value="6">6 months</option>
                        <option value="12">1 year</option>
                        <option value="24">2 years</option>
                        <option value="36">3 years</option>
                      </select>
                    </div>
                  </div>

                  {(() => {
                    const selPattern = patterns.find(p => p.id === selectedPatternForSchedule)
                    if (!selPattern?.includesNights) return null
                    return (
                      <div>
                        <Label>Starting Shift</Label>
                        <div className="flex gap-2 mt-1">
                          <Button variant={startShift === "day" ? "default" : "outline"} size="sm" onClick={() => setStartShift("day")}>Day Shift</Button>
                          <Button variant={startShift === "night" ? "default" : "outline"} size="sm" onClick={() => setStartShift("night")}>Night Shift</Button>
                        </div>
                      </div>
                    )
                  })()}

                  {selectedCrewForSchedule && (
                    <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                      <strong>Summary:</strong> Generate schedules for{" "}
                      <strong>{workers.filter(w => w.crewId === selectedCrewForSchedule).length} worker(s)</strong> in{" "}
                      <strong>{crews.find(c => c.id === selectedCrewForSchedule)?.name}</strong> using{" "}
                      <strong>{patterns.find(p => p.id === selectedPatternForSchedule)?.name || "..."}</strong> pattern,
                      starting {new Date(scheduleStartDate).toLocaleDateString()}.
                    </div>
                  )}

                  <Button
                    onClick={handleGenerateSchedules}
                    disabled={generating || !selectedCrewForSchedule || !selectedPatternForSchedule}
                    className="gap-2"
                    size="lg"
                  >
                    {generating ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                    ) : (
                      <><Wand2 className="h-4 w-4" /> Generate Schedules</>
                    )}
                  </Button>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                For more advanced schedule generation options (individual worker selection, ongoing schedules, etc.),
                use the <a href="/setup" className="text-primary hover:underline">advanced setup page</a>.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => { setActiveStep(Math.max(0, activeStep - 1)); clearMessages() }}
          disabled={activeStep === 0}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous
        </Button>

        {activeStep < 3 ? (
          <Button
            onClick={() => { setActiveStep(activeStep + 1); clearMessages() }}
            className="gap-2"
          >
            Next Step
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : status?.isComplete ? (
          <Button onClick={() => router.push("/dashboard")} className="gap-2">
            Go to Dashboard
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {/* All Done Banner */}
      {status?.isComplete && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
              <h3 className="text-lg font-semibold text-green-700 dark:text-green-400">You&apos;re all set!</h3>
              <p className="text-sm text-green-600 dark:text-green-500">
                ShiftSync is configured and ready to use. Visit the dashboard or schedule to manage your workforce.
              </p>
              <div className="flex justify-center gap-3">
                <Button onClick={() => router.push("/dashboard")}>Go to Dashboard</Button>
                <Button variant="outline" onClick={() => router.push("/schedule")}>View Schedule</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
