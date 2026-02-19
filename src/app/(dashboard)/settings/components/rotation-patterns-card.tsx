"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Clock, Plus, Pencil, Trash2, X } from "lucide-react"

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
  _count: { crews: number }
}

interface NewPattern {
  name: string
  description: string
  daysOn: number
  daysOff: number
  includesNights: boolean
  nightDays: number
  nightsAtStart: boolean
  alternatesShifts: boolean
}

const DEFAULT_PATTERN: NewPattern = {
  name: "",
  description: "",
  daysOn: 14,
  daysOff: 14,
  includesNights: false,
  nightDays: 0,
  nightsAtStart: true,
  alternatesShifts: false,
}

interface Props {
  patterns: RotationPattern[]
  isAdmin: boolean
  onRefresh: () => void
  onMessage: (msg: string) => void
}

export function RotationPatternsCard({ patterns, isAdmin, onRefresh, onMessage }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [editingPattern, setEditingPattern] = useState<RotationPattern | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<NewPattern>(DEFAULT_PATTERN)

  const resetForm = () => {
    setForm(DEFAULT_PATTERN)
    setEditingPattern(null)
    setShowForm(false)
  }

  const startEdit = (pattern: RotationPattern) => {
    setEditingPattern(pattern)
    setForm({
      name: pattern.name,
      description: pattern.description || "",
      daysOn: pattern.daysOn,
      daysOff: pattern.daysOff,
      includesNights: pattern.includesNights,
      nightDays: pattern.nightDays,
      nightsAtStart: pattern.nightsAtStart,
      alternatesShifts: pattern.alternatesShifts,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      onMessage("Pattern name is required")
      return
    }

    setSaving(true)
    try {
      const url = editingPattern
        ? `/api/rotation-patterns?id=${editingPattern.id}`
        : "/api/rotation-patterns"

      const response = await fetch(url, {
        method: editingPattern ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      const data = await response.json()
      if (data.success) {
        onMessage(editingPattern ? "Pattern updated successfully" : "Pattern created successfully")
        resetForm()
        onRefresh()
      } else {
        onMessage(data.error || "Failed to save pattern")
      }
    } catch {
      onMessage("Failed to save pattern")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (patternId: string) => {
    if (!confirm("Are you sure you want to delete this pattern?")) return

    try {
      const response = await fetch(`/api/rotation-patterns?id=${patternId}`, { method: "DELETE" })
      const data = await response.json()
      if (data.success) {
        onMessage("Pattern deleted successfully")
        onRefresh()
      } else {
        onMessage(data.error || "Failed to delete pattern")
      }
    } catch {
      onMessage("Failed to delete pattern")
    }
  }

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Rotation Patterns
            </CardTitle>
            <CardDescription>Configure shift rotation patterns</CardDescription>
          </div>
          {isAdmin && !showForm && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Pattern
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {showForm && (
          <div className="mb-4 p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">{editingPattern ? "Edit Pattern" : "New Pattern"}</h4>
              <Button variant="ghost" size="sm" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="patternName">Pattern Name</Label>
                <Input
                  id="patternName"
                  placeholder="e.g., 14/14 with Nights"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="patternDesc">Description</Label>
                <Input
                  id="patternDesc"
                  placeholder="e.g., Standard offshore rotation"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="daysOn">Days On</Label>
                <Input
                  id="daysOn"
                  type="number"
                  min={1}
                  max={60}
                  value={form.daysOn}
                  onChange={(e) => setForm({ ...form, daysOn: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="daysOff">Days Off</Label>
                <Input
                  id="daysOff"
                  type="number"
                  min={1}
                  max={60}
                  value={form.daysOff}
                  onChange={(e) => setForm({ ...form, daysOff: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="md:col-span-2 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="includesNights"
                    checked={form.includesNights}
                    onChange={(e) => setForm({
                      ...form,
                      includesNights: e.target.checked,
                      nightDays: e.target.checked ? Math.floor(form.daysOn / 2) : 0,
                    })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="includesNights">Includes Night Shifts</Label>
                </div>
                {form.includesNights && (
                  <div className="ml-6 space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="alternatesShifts"
                        checked={form.alternatesShifts}
                        onChange={(e) => setForm({ ...form, alternatesShifts: e.target.checked })}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="alternatesShifts">Alternates Between Day/Night Rotations</Label>
                    </div>
                    {!form.alternatesShifts && (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="nightDays">Number of Night Days</Label>
                          <Input
                            id="nightDays"
                            type="number"
                            min={1}
                            max={form.daysOn}
                            value={form.nightDays}
                            onChange={(e) => setForm({ ...form, nightDays: parseInt(e.target.value) || 1 })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Night Shift Position</Label>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={form.nightsAtStart ? "default" : "outline"}
                              onClick={() => setForm({ ...form, nightsAtStart: true })}
                            >
                              Start
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={!form.nightsAtStart ? "default" : "outline"}
                              onClick={() => setForm({ ...form, nightsAtStart: false })}
                            >
                              End
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editingPattern ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {patterns.map((pattern) => (
            <div key={pattern.id} className="flex items-center justify-between p-3 rounded border">
              <div>
                <p className="font-medium">{pattern.name}</p>
                <p className="text-sm text-muted-foreground">
                  {pattern.daysOn} on / {pattern.daysOff} off
                  {pattern.includesNights && pattern.alternatesShifts && " • alternates"}
                  {pattern.includesNights && !pattern.alternatesShifts && ` • ${pattern.nightDays} nights`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {pattern.isDefault && <Badge variant="secondary">Default</Badge>}
                <Badge variant="outline">{pattern._count.crews} crews</Badge>
                {isAdmin && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => startEdit(pattern)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(pattern.id)}
                      disabled={pattern._count.crews > 0}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {patterns.length === 0 && (
            <p className="text-center text-muted-foreground py-4">No rotation patterns configured</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
