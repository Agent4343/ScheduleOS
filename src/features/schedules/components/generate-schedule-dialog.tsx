"use client"

import { useState } from "react"
import { Loader2, RotateCcw } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { useToast } from "@/components/ui/toast"
import { errorMessage } from "@/lib/api-client"
import { addMonthsKey, formatDateOnly, todayKey } from "@/lib/dates"
import type { Crew, RotationPattern } from "@/features/types"
import { useRotationPatterns } from "@/features/rotation-patterns/hooks"
import { useGenerateSchedule } from "../hooks"
import type { GenerateScheduleResult } from "../api"

/** What we are generating for. */
export type GenerateTarget =
  | { kind: "crew"; crew: Crew }
  | { kind: "worker"; worker: { id: string; name: string | null; crew: Pick<Crew, "id" | "name" | "rotationPattern" | "rotationAnchorDate"> | null } }

interface GenerateScheduleDialogProps {
  open: boolean
  onClose: () => void
  target: GenerateTarget | null
  /** Called after a successful generation */
  onGenerated?: (result: GenerateScheduleResult) => void
  /** Default range length in months */
  defaultMonths?: number
}

const DURATIONS = [
  { value: "1", label: "1 month" },
  { value: "3", label: "3 months" },
  { value: "6", label: "6 months" },
  { value: "12", label: "12 months" },
  { value: "custom", label: "Until a date…" },
]

function patternLabel(p: RotationPattern) {
  const nights = p.includesNights ? (p.alternatesShifts ? ", alternating day/night" : `, ${p.nightDays ?? 0} nights`) : ""
  return `${p.name} (${p.daysOn} on / ${p.daysOff} off${nights})`
}

/**
 * THE way to generate a rotation, for a crew or a single worker. Replaces
 * the four separate generators that lived in Crews, Schedule, Getting
 * Started and Setup.
 *
 * A crew that already has a rotation anchor keeps it: the dialog says so and
 * offers "extend" semantics. Phase and starting shift are only asked for
 * when they will actually be used.
 */
export function GenerateScheduleDialog({ open, onClose, target, onGenerated, defaultMonths = 3 }: GenerateScheduleDialogProps) {
  const toast = useToast()
  const patternsQuery = useRotationPatterns()
  const generate = useGenerateSchedule()
  const patterns = patternsQuery.data ?? []

  const crew = target?.kind === "crew" ? target.crew : target?.kind === "worker" ? target.worker.crew : null
  const anchored = !!crew?.rotationAnchorDate && !!crew?.rotationPattern

  const [patternId, setPatternId] = useState(crew?.rotationPattern?.id ?? "")
  const [startDate, setStartDate] = useState(todayKey())
  const [duration, setDuration] = useState(String(defaultMonths))
  const [customEnd, setCustomEnd] = useState(addMonthsKey(todayKey(), 12))
  const [startPhase, setStartPhase] = useState(target?.kind === "crew" ? target.crew.currentPhase : 0)
  const [startingShift, setStartingShift] = useState<"DAY" | "NIGHT">("DAY")
  const [clearOverrides, setClearOverrides] = useState(false)
  const [resetAnchor, setResetAnchor] = useState(false)

  const pattern = patterns.find((p) => p.id === patternId)
  const endDate = duration === "custom" ? customEnd : addMonthsKey(startDate, parseInt(duration))
  const usesCrewAnchor = anchored && crew?.rotationPattern?.id === patternId && !resetAnchor
  const askForPhase = !usesCrewAnchor
  const askForShift = askForPhase && !!pattern?.alternatesShifts
  const canSubmit = !!patternId && !!startDate && !!endDate && endDate >= startDate && !generate.isPending

  const title = target?.kind === "crew" ? `Generate schedule for ${target.crew.name}` : `Generate schedule for ${target?.kind === "worker" ? target.worker.name ?? "worker" : ""}`

  const submit = async () => {
    if (!target || !canSubmit) return
    try {
      const { data } = await generate.mutateAsync({
        patternId,
        startDate,
        endDate,
        ...(target.kind === "crew" ? { crewId: target.crew.id } : { userId: target.worker.id }),
        ...(askForPhase && { startPhase, startingShift }),
        clearOverrides,
        resetAnchor,
      })
      toast.success(
        `Generated ${data.daysGenerated} days for ${data.usersProcessed} worker(s)` +
          (data.timeOffReapplied ? `, kept ${data.timeOffReapplied} approved time-off request(s)` : "")
      )
      onGenerated?.(data)
      onClose()
    } catch (error) {
      toast.error(errorMessage(error, "Failed to generate schedule"))
    }
  }

  return (
    <Modal isOpen={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        {usesCrewAnchor && crew && (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
            {target?.kind === "crew" ? "This crew's" : `${crew.name}'s`} rotation is fixed from{" "}
            <strong>{formatDateOnly(crew.rotationAnchorDate!)}</strong>. Generating any range continues that rotation, so
            existing days keep their shifts and manual edits are preserved.
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="gen-pattern">Rotation Pattern</Label>
          <Select
            id="gen-pattern"
            value={patternId}
            onChange={(e) => setPatternId(e.target.value)}
            options={[{ value: "", label: "Select a pattern…" }, ...patterns.map((p) => ({ value: p.id, label: patternLabel(p) }))]}
          />
          {target?.kind === "crew" && crew?.rotationPattern && patternId && patternId !== crew.rotationPattern.id && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              This is a different pattern from the crew&apos;s current one. Generating will switch the crew to it and start a new rotation.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="gen-start">Start Date</Label>
            <Input id="gen-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gen-duration">Generate for</Label>
            <Select id="gen-duration" value={duration} onChange={(e) => setDuration(e.target.value)} options={DURATIONS} />
          </div>
        </div>
        {duration === "custom" && (
          <div className="space-y-2">
            <Label htmlFor="gen-end">End Date</Label>
            <Input id="gen-end" type="date" value={customEnd} min={startDate} onChange={(e) => setCustomEnd(e.target.value)} />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {formatDateOnly(startDate)} to {formatDateOnly(endDate)}
        </p>

        {askForPhase && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gen-phase">Day in cycle on start date</Label>
              <Input
                id="gen-phase"
                type="number"
                min={0}
                max={pattern ? pattern.daysOn + pattern.daysOff - 1 : undefined}
                value={startPhase}
                onChange={(e) => setStartPhase(Math.max(0, parseInt(e.target.value) || 0))}
              />
              <p className="text-xs text-muted-foreground">0 = first working day{pattern ? `; ${pattern.daysOn} = first day off` : ""}</p>
            </div>
            {askForShift && (
              <div className="space-y-2">
                <Label htmlFor="gen-shift">First working block</Label>
                <Select
                  id="gen-shift"
                  value={startingShift}
                  onChange={(e) => setStartingShift(e.target.value as "DAY" | "NIGHT")}
                  options={[
                    { value: "DAY", label: "Days" },
                    { value: "NIGHT", label: "Nights" },
                  ]}
                />
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          {anchored && crew?.rotationPattern?.id === patternId && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={resetAnchor} onChange={(e) => setResetAnchor(e.target.checked)} />
              <span>
                Start a new rotation from the start date
                <span className="block text-xs text-muted-foreground">Ignores the fixed rotation and re-anchors the crew. Only do this if the rotation is wrong.</span>
              </span>
            </label>
          )}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={clearOverrides} onChange={(e) => setClearOverrides(e.target.checked)} />
            <span>
              Clear manual edits in this range
              <span className="block text-xs text-muted-foreground">Approved time off is always kept.</span>
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={generate.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {generate.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4 mr-2" /> {usesCrewAnchor ? "Extend Schedule" : "Generate Schedule"}
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
