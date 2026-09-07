"use client"

import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import type { Crew, RotationPattern } from "@/features/types"

export const CREW_COLORS = [
  { value: "#3B82F6", label: "Blue" },
  { value: "#10B981", label: "Green" },
  { value: "#F59E0B", label: "Orange" },
  { value: "#8B5CF6", label: "Purple" },
  { value: "#EF4444", label: "Red" },
  { value: "#EC4899", label: "Pink" },
  { value: "#14B8A6", label: "Teal" },
  { value: "#6366F1", label: "Indigo" },
]

export interface CrewFormValues {
  name: string
  description: string
  color: string
  rotationPatternId: string
  currentPhase: number
}

interface CrewFormProps {
  /** Existing crew to edit; omit to create. */
  crew?: Crew
  patterns: RotationPattern[]
  submitting: boolean
  onSubmit: (values: CrewFormValues) => void
  onCancel: () => void
}

/**
 * One form for both "Add Crew" and "Edit Crew". Field ids are prefixed by
 * mode so two instances can coexist on a page without clashing labels.
 */
export function CrewForm({ crew, patterns, submitting, onSubmit, onCancel }: CrewFormProps) {
  const mode = crew ? "edit" : "create"
  const [values, setValues] = useState<CrewFormValues>({
    name: crew?.name ?? "",
    description: crew?.description ?? "",
    color: crew?.color ?? CREW_COLORS[0].value,
    rotationPatternId: crew?.rotationPattern?.id ?? "",
    currentPhase: crew?.currentPhase ?? 0,
  })
  const set = <K extends keyof CrewFormValues>(key: K, value: CrewFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit(values)
  }

  const id = (field: string) => `${mode}-crew-${field}`
  const isAnchored = !!crew?.rotationAnchorDate

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={id("name")}>Crew Name *</Label>
        <Input
          id={id("name")}
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g., Crew A, Night Shift"
          required
          maxLength={50}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={id("description")}>Description</Label>
        <Input
          id={id("description")}
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Optional description"
          maxLength={500}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Crew Color</legend>
        <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="Crew color">
          {CREW_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              role="radio"
              aria-checked={values.color === color.value}
              aria-label={color.label}
              onClick={() => set("color", color.value)}
              className={`w-8 h-8 rounded-full border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                values.color === color.value ? "border-foreground scale-110" : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: color.value }}
              title={color.label}
            />
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor={id("pattern")}>Rotation Pattern</Label>
        <Select
          id={id("pattern")}
          value={values.rotationPatternId}
          onChange={(e) => set("rotationPatternId", e.target.value)}
          options={[
            { value: "", label: mode === "create" ? "Select a pattern" : "No pattern" },
            ...patterns.map((p) => ({
              value: p.id,
              label: `${p.name} (${p.daysOn} on / ${p.daysOff} off)`,
            })),
          ]}
        />
        {mode === "edit" && isAnchored && values.rotationPatternId !== crew?.rotationPattern?.id && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Changing the pattern resets this crew&apos;s rotation. The next schedule generation starts a new cycle.
          </p>
        )}
      </div>

      {mode === "edit" && (
        <div className="space-y-2">
          <Label htmlFor={id("phase")}>Current Phase (day in rotation, as of today)</Label>
          <Input
            id={id("phase")}
            type="number"
            min={0}
            value={values.currentPhase}
            onChange={(e) => set("currentPhase", Math.max(0, parseInt(e.target.value) || 0))}
          />
          <p className="text-xs text-muted-foreground">
            Day 0 is the first working day of the cycle.
            {isAnchored ? " Changing this moves the crew's rotation from today onward." : ""}
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? (mode === "create" ? "Creating…" : "Saving…") : mode === "create" ? "Create Crew" : "Save Changes"}
        </Button>
      </div>
    </form>
  )
}
