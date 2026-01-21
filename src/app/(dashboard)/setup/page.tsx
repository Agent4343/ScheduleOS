"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Calendar,
  Users,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Wand2,
  ArrowRight,
  RefreshCw,
  Plus,
  X,
} from "lucide-react"

interface Worker {
  id: string
  name: string
  email: string
  position: string | null
  status: string
  crewId: string | null
  crew: { id: string; name: string; color: string } | null
}

interface Crew {
  id: string
  name: string
  color: string
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
}

export default function SetupPage() {
  const router = useRouter()
  const [workers, setWorkers] = useState<Worker[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [patterns, setPatterns] = useState<RotationPattern[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Form state
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(new Set())
  const [selectedCrew, setSelectedCrew] = useState<string>("")
  const [selectedPattern, setSelectedPattern] = useState<string>("")
  const [startDate, setStartDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split("T")[0]
  })
  const [duration, setDuration] = useState("12") // months
  const [scheduleType, setScheduleType] = useState<"duration" | "endDate" | "ongoing">("duration")
  const [customEndDate, setCustomEndDate] = useState("")
  const [startShift, setStartShift] = useState<"day" | "night">("day")
  const [clearOverrides, setClearOverrides] = useState(false)

  // Calculate end date from duration or custom selection
  const getEndDate = () => {
    if (scheduleType === "ongoing") {
      // For ongoing, generate 5 years ahead
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

  // Add worker form state
  const [showAddWorker, setShowAddWorker] = useState(false)
  const [isAddingWorker, setIsAddingWorker] = useState(false)
  const [newWorker, setNewWorker] = useState({
    name: "",
    email: "",
    position: "",
    crewId: "",
  })

  // Fetch data function
  const fetchData = useCallback(async () => {
    try {
      const [workersRes, crewsRes, patternsRes] = await Promise.all([
        fetch("/api/users?status=ACTIVE"),
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

  // Fetch data on mount
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // When crew is selected, auto-select workers in that crew
  useEffect(() => {
    if (selectedCrew) {
      const crewWorkers = workers.filter((w) => w.crewId === selectedCrew)
      setSelectedWorkers(new Set(crewWorkers.map((w) => w.id)))

      // Also select the crew's pattern if it has one
      const crew = crews.find((c) => c.id === selectedCrew)
      if (crew?.rotationPatternId) {
        setSelectedPattern(crew.rotationPatternId)
      }
    }
  }, [selectedCrew, workers, crews])

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
    if (selectedWorkers.size === workers.length) {
      setSelectedWorkers(new Set())
    } else {
      setSelectedWorkers(new Set(workers.map((w) => w.id)))
    }
  }

  const handleAddWorker = async () => {
    if (!newWorker.name || !newWorker.email) {
      setError("Name and email are required")
      return
    }

    setIsAddingWorker(true)
    setError("")

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWorker.name,
          email: newWorker.email,
          position: newWorker.position || null,
          crewId: newWorker.crewId || null,
          role: "WORKER",
          status: "ACTIVE",
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Refresh workers list
        await fetchData()
        // Auto-select the new worker
        setSelectedWorkers((prev) => new Set([...Array.from(prev), data.data.id]))
        // Reset form
        setNewWorker({ name: "", email: "", position: "", crewId: "" })
        setShowAddWorker(false)
        setSuccess(`Worker "${newWorker.name}" added successfully!`)
        setTimeout(() => setSuccess(""), 3000)
      } else {
        setError(data.error || "Failed to add worker")
      }
    } catch {
      setError("Failed to add worker. Please try again.")
    } finally {
      setIsAddingWorker(false)
    }
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
      // Generate schedules for each selected worker
      const workerIds = Array.from(selectedWorkers)
      let successCount = 0
      const errors: string[] = []

      // Get the pattern to check if it includes nights
      const pattern = patterns.find((p) => p.id === selectedPattern)

      console.log("Generating schedules:", { workerIds, patternId: selectedPattern, startDate, endDate })

      for (const userId of workerIds) {
        const requestBody = {
          userId,
          patternId: selectedPattern,
          startDate,
          endDate,
          startPhase: 0,
          clearOverrides,
          // Send startingShift if pattern includes nights
          ...(pattern?.includesNights && {
            startingShift: startShift === "day" ? "DAY" : "NIGHT",
          }),
        }

        console.log("Sending request for user:", userId, requestBody)

        const response = await fetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        })

        const data = await response.json()
        console.log("Response for user:", userId, data)

        if (response.ok && data.success) {
          successCount++
        } else {
          const errorMsg = data.error || data.details || "Unknown error"
          console.error("Failed to generate schedule for user:", userId, errorMsg)
          errors.push(errorMsg)
        }
      }

      if (successCount === 0) {
        const uniqueErrors = Array.from(new Set(errors))
        setError(`Failed to generate schedules: ${uniqueErrors.join(", ")}`)
        return
      }

      const scheduleYear = new Date(startDate).getFullYear()
      setSuccess(`Successfully generated schedules for ${successCount} of ${workerIds.length} worker(s)! Schedules start from ${new Date(startDate).toLocaleDateString()}.`)

      // Redirect to schedule view after short delay
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
      <div>
        <h1 className="text-3xl font-bold">Schedule Setup</h1>
        <p className="text-muted-foreground mt-1">
          Quickly set up schedules for your workers in just a few steps
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

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Step 1: Select Crew or Workers */}
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
            {/* Quick crew select */}
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
                  {selectedWorkers.size === workers.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1 border rounded-lg p-2">
                {workers.map((worker) => (
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
                      <p className="font-medium truncate">{worker.name}</p>
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
                {workers.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    No workers found. <a href="/workers" className="text-primary hover:underline">Add workers first</a>
                  </p>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {selectedWorkers.size} worker(s) selected
              </p>
            </div>

            {/* Quick Add Worker */}
            <div className="border-t pt-4">
              {!showAddWorker ? (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setShowAddWorker(true)}
                >
                  <Plus className="h-4 w-4" />
                  Quick Add Worker
                </Button>
              ) : (
                <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">Add New Worker</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAddWorker(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Input
                      placeholder="Name *"
                      value={newWorker.name}
                      onChange={(e) =>
                        setNewWorker({ ...newWorker, name: e.target.value })
                      }
                    />
                    <Input
                      type="email"
                      placeholder="Email *"
                      value={newWorker.email}
                      onChange={(e) =>
                        setNewWorker({ ...newWorker, email: e.target.value })
                      }
                    />
                    <Input
                      placeholder="Position (optional)"
                      value={newWorker.position}
                      onChange={(e) =>
                        setNewWorker({ ...newWorker, position: e.target.value })
                      }
                    />
                    <select
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      value={newWorker.crewId}
                      onChange={(e) =>
                        setNewWorker({ ...newWorker, crewId: e.target.value })
                      }
                    >
                      <option value="">No Crew (optional)</option>
                      {crews.map((crew) => (
                        <option key={crew.id} value={crew.id}>
                          {crew.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    className="w-full gap-2"
                    onClick={handleAddWorker}
                    disabled={isAddingWorker || !newWorker.name || !newWorker.email}
                  >
                    {isAddingWorker ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Add Worker
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Select Rotation Pattern */}
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
                  No rotation patterns found. <a href="/settings" className="text-primary hover:underline">Create one first</a>
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
                      ☀️ Day Shift
                    </Button>
                    <Button
                      type="button"
                      variant={startShift === "night" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStartShift("night")}
                    >
                      🌙 Night Shift
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Workers will start their rotation on {startShift} shift
                  </p>
                </div>
              )}
              <div>
                <Label>Schedule End</Label>
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
                    Schedule will run continuously with no set end date.
                    (Generates 5 years of schedules, can regenerate later)
                  </p>
                )}

                <p className="text-xs text-muted-foreground mt-2">
                  {scheduleType === "ongoing"
                    ? "Schedules will be generated on an ongoing basis"
                    : `Schedules will generate until ${new Date(getEndDate()).toLocaleDateString()}`
                  }
                </p>
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
                {selectedPattern_obj?.includesNights && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Starting:</span>
                    <span className="font-medium">
                      {startShift === "day" ? "☀️ Day Shift" : "🌙 Night Shift"}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="font-medium">
                    {scheduleType === "ongoing"
                      ? "Ongoing (no end date)"
                      : scheduleType === "endDate"
                      ? `Until ${customEndDate ? new Date(customEndDate).toLocaleDateString() : "Not set"}`
                      : parseInt(duration) >= 12
                      ? `${parseInt(duration) / 12} year${parseInt(duration) > 12 ? "s" : ""}`
                      : `${duration} months`}
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
            {clearOverrides && (
              <p className="text-xs text-orange-600">
                Warning: This will delete all manually edited shifts for selected workers
              </p>
            )}

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

            {selectedWorkers.size > 0 && selectedPattern && (
              <p className="text-xs text-center text-muted-foreground">
                This will create schedules for {selectedWorkers.size} worker(s) using the{" "}
                {selectedPattern_obj?.name} pattern
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <a href="/workers">
                <Users className="h-5 w-5" />
                <span>Manage Workers</span>
              </a>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <a href="/crews">
                <Users className="h-5 w-5" />
                <span>Manage Crews</span>
              </a>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <a href="/schedule">
                <Calendar className="h-5 w-5" />
                <span>View Schedule</span>
              </a>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <a href="/settings">
                <ArrowRight className="h-5 w-5" />
                <span>Edit Patterns</span>
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
