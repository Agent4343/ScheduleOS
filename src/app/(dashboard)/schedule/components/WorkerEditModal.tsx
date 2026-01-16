"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/ui/modal"
import { Select } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { Loader2, CalendarPlus, RotateCcw } from "lucide-react"
import { UserRole } from "@/types"
import type { Worker, Crew, WorkerEditForm, RotationPattern, Schedule } from "../schedule-types"

interface WorkerEditModalProps {
  isOpen: boolean
  worker: Worker | null
  crews: Crew[]
  rotationPatterns: RotationPattern[]
  currentYear: number
  onClose: () => void
  onWorkerUpdated: (worker: Worker) => void
  onScheduleGenerated: (year: number, schedules: Schedule[]) => void
}

export function WorkerEditModal({
  isOpen,
  worker,
  crews,
  rotationPatterns,
  currentYear,
  onClose,
  onWorkerUpdated,
  onScheduleGenerated,
}: WorkerEditModalProps) {
  // Form state
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

  // Reset form when worker changes
  const initializeForm = (workerData: Worker | null) => {
    if (!workerData) return

    const hireDateStr = workerData.hireDate
      ? new Date(workerData.hireDate).toISOString().split("T")[0]
      : ""

    setEditForm({
      name: workerData.name || "",
      position: workerData.position || "",
      phone: workerData.phone || "",
      crewId: workerData.crew?.id || "",
      role: workerData.role || "WORKER",
      hireDate: hireDateStr,
    })

    // Reset schedule generation fields
    setSelectedPatternId("")
    setScheduleStartDate(hireDateStr || new Date().toISOString().split("T")[0])
    setStartOnNights(false)
    setGenerateSuccess(null)
    setSaveError(null)
  }

  // Initialize form when modal opens with new worker
  if (isOpen && worker && editForm.name === "" && worker.name) {
    initializeForm(worker)
  }

  const handleClose = () => {
    setEditForm({
      name: "",
      position: "",
      phone: "",
      crewId: "",
      role: "WORKER",
      hireDate: "",
    })
    setSaveError(null)
    setGenerateSuccess(null)
    onClose()
  }

  async function saveWorker() {
    if (!worker) return

    setSaving(true)
    setSaveError(null)

    try {
      const response = await fetch(`/api/users/${worker.id}`, {
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

      // Notify parent of update
      const updatedWorker: Worker = {
        ...worker,
        name: editForm.name,
        position: editForm.position || null,
        phone: editForm.phone || null,
        role: editForm.role,
        hireDate: editForm.hireDate || null,
        crew: editForm.crewId
          ? crews.find((c) => c.id === editForm.crewId) || null
          : null,
      }
      onWorkerUpdated(updatedWorker)
      handleClose()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function generateSchedule() {
    if (!worker || !selectedPatternId || !scheduleStartDate) return

    setGenerating(true)
    setSaveError(null)
    setGenerateSuccess(null)

    try {
      const startDate = new Date(scheduleStartDate)
      const generatedYear = startDate.getFullYear()
      const endDate = new Date(generatedYear, 11, 31)

      const response = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: worker.id,
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

      // Refresh schedules for the generated year
      const fetchStartDate = `${generatedYear}-01-01`
      const fetchEndDate = `${generatedYear}-12-31`

      const schedulesResponse = await fetch(
        `/api/schedules?startDate=${fetchStartDate}&endDate=${fetchEndDate}`
      )
      const schedulesResult = await schedulesResponse.json()
      if (schedulesResult.success) {
        onScheduleGenerated(generatedYear, schedulesResult.data)
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to generate")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Edit Worker"
      description={worker?.email || "Update worker information"}
    >
      <div className="space-y-4">
        {saveError && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
            {saveError}
          </div>
        )}

        <WorkerDetailsForm
          form={editForm}
          crews={crews}
          saving={saving}
          onChange={setEditForm}
          onSave={saveWorker}
          onCancel={handleClose}
        />

        <ScheduleGenerationForm
          rotationPatterns={rotationPatterns}
          selectedPatternId={selectedPatternId}
          scheduleStartDate={scheduleStartDate}
          startOnNights={startOnNights}
          generating={generating}
          generateSuccess={generateSuccess}
          onPatternChange={setSelectedPatternId}
          onStartDateChange={setScheduleStartDate}
          onStartOnNightsChange={setStartOnNights}
          onGenerate={generateSchedule}
        />
      </div>
    </Modal>
  )
}

// Sub-component for worker details form
interface WorkerDetailsFormProps {
  form: WorkerEditForm
  crews: Crew[]
  saving: boolean
  onChange: (form: WorkerEditForm) => void
  onSave: () => void
  onCancel: () => void
}

function WorkerDetailsForm({
  form,
  crews,
  saving,
  onChange,
  onSave,
  onCancel,
}: WorkerDetailsFormProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder="Worker name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="position">Position</Label>
        <Input
          id="position"
          value={form.position}
          onChange={(e) => onChange({ ...form, position: e.target.value })}
          placeholder="e.g., Operator, Technician, Supervisor"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          value={form.phone}
          onChange={(e) => onChange({ ...form, phone: e.target.value })}
          placeholder="Phone number"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="crew">Crew</Label>
        <Select
          id="crew"
          value={form.crewId}
          onChange={(e) => onChange({ ...form, crewId: e.target.value })}
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
          value={form.role}
          onChange={(e) => onChange({ ...form, role: e.target.value as UserRole })}
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
          value={form.hireDate}
          onChange={(e) => onChange({ ...form, hireDate: e.target.value })}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4 border-b pb-4">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={onSave} disabled={saving || !form.name}>
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
    </>
  )
}

// Sub-component for schedule generation form
interface ScheduleGenerationFormProps {
  rotationPatterns: RotationPattern[]
  selectedPatternId: string
  scheduleStartDate: string
  startOnNights: boolean
  generating: boolean
  generateSuccess: string | null
  onPatternChange: (id: string) => void
  onStartDateChange: (date: string) => void
  onStartOnNightsChange: (value: boolean) => void
  onGenerate: () => void
}

function ScheduleGenerationForm({
  rotationPatterns,
  selectedPatternId,
  scheduleStartDate,
  startOnNights,
  generating,
  generateSuccess,
  onPatternChange,
  onStartDateChange,
  onStartOnNightsChange,
  onGenerate,
}: ScheduleGenerationFormProps) {
  return (
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
          onChange={(e) => onPatternChange(e.target.value)}
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
          onChange={(e) => onStartDateChange(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Schedule will be generated from this date to end of year
        </p>
      </div>

      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
        <div className="flex gap-2 w-full">
          <button
            type="button"
            onClick={() => onStartOnNightsChange(false)}
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
            onClick={() => onStartOnNightsChange(true)}
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
        onClick={onGenerate}
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
  )
}
