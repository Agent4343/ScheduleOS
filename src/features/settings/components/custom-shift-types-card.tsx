"use client"

import { useConfirm } from "@/components/ui/confirm-dialog"
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Palette, Plus, Pencil, Trash2, X } from "lucide-react"

interface CustomShiftType {
  id: string
  code: string
  name: string
  color: string
  textColor: string
  description: string | null
  isActive: boolean
}

interface NewShiftType {
  code: string
  name: string
  color: string
  textColor: string
  description: string
}

const DEFAULT_SHIFT_TYPE: NewShiftType = {
  code: "",
  name: "",
  color: "#6b7280",
  textColor: "#ffffff",
  description: "",
}

const DEFAULT_SHIFT_COLORS: Record<string, { bg: string; text: string }> = {
  DAY: { bg: "#22c55e", text: "#ffffff" },
  NIGHT: { bg: "#3b82f6", text: "#ffffff" },
  OFF: { bg: "#6b7280", text: "#ffffff" },
  LEAVE: { bg: "#f59e0b", text: "#ffffff" },
  VACATION: { bg: "#8b5cf6", text: "#ffffff" },
  SICK: { bg: "#ef4444", text: "#ffffff" },
  TRAINING: { bg: "#06b6d4", text: "#ffffff" },
  SHUTDOWN: { bg: "#78716c", text: "#ffffff" },
}

interface Props {
  customShiftTypes: CustomShiftType[]
  shiftColors: Record<string, { bg: string; text: string }>
  isAdmin: boolean
  onRefresh: () => void
  onMessage: (msg: string, kind?: "success" | "error") => void
  onShiftColorsChange: (colors: Record<string, { bg: string; text: string }>) => void
}

export function CustomShiftTypesCard({
  customShiftTypes,
  shiftColors,
  isAdmin,
  onRefresh,
  onMessage,
  onShiftColorsChange,
}: Props) {
  const confirmDialog = useConfirm()
  const [showForm, setShowForm] = useState(false)
  const [editingShiftType, setEditingShiftType] = useState<CustomShiftType | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<NewShiftType>(DEFAULT_SHIFT_TYPE)
  const [showColorEditor, setShowColorEditor] = useState(false)

  const resetForm = () => {
    setForm(DEFAULT_SHIFT_TYPE)
    setEditingShiftType(null)
    setShowForm(false)
  }

  const startEdit = (shiftType: CustomShiftType) => {
    setEditingShiftType(shiftType)
    setForm({
      code: shiftType.code,
      name: shiftType.name,
      color: shiftType.color,
      textColor: shiftType.textColor,
      description: shiftType.description || "",
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      onMessage("Code and name are required")
      return
    }

    setSaving(true)
    try {
      const url = editingShiftType
        ? `/api/custom-shift-types/${editingShiftType.id}`
        : "/api/custom-shift-types"

      const response = await fetch(url, {
        method: editingShiftType ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      const data = await response.json()
      if (data.success) {
        onMessage(editingShiftType ? "Shift type updated" : "Shift type created")
        resetForm()
        onRefresh()
      } else {
        onMessage(data.error || "Failed to save shift type")
      }
    } catch {
      onMessage("Failed to save shift type")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (shiftTypeId: string) => {
    const ok = await confirmDialog({ title: "Delete this shift type?", description: "Schedules already using this code keep it, but it can no longer be assigned.", confirmLabel: "Delete", destructive: true })
    if (!ok) return

    try {
      const response = await fetch(`/api/custom-shift-types/${shiftTypeId}`, { method: "DELETE" })
      const data = await response.json()
      if (data.success) {
        onMessage("Shift type deleted")
        onRefresh()
      } else {
        onMessage(data.error || "Failed to delete")
      }
    } catch {
      onMessage("Failed to delete")
    }
  }

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Custom Shift Types
            </CardTitle>
            <CardDescription>Create custom shift types for your organization</CardDescription>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <>
                <Button size="sm" variant="outline" onClick={() => setShowColorEditor(!showColorEditor)}>
                  <Palette className="h-4 w-4 mr-1" />
                  Colors
                </Button>
                {!showForm && (
                  <Button size="sm" onClick={() => setShowForm(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {showColorEditor && (
          <div className="mb-4 p-4 border rounded-lg bg-muted/50">
            <h4 className="font-medium mb-3">Built-in Shift Colors</h4>
            <div className="grid gap-3 md:grid-cols-4">
              {Object.entries(shiftColors).map(([type, colors]) => (
                <div key={type} className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: colors.bg, color: colors.text }}
                  >
                    {type.charAt(0)}
                  </div>
                  <span className="text-sm">{type}</span>
                  <input
                    id={`shift-color-${type.toLowerCase()}`}
                    name={`shift-color-${type.toLowerCase()}`}
                    type="color"
                    value={colors.bg}
                    onChange={(e) => onShiftColorsChange({ ...shiftColors, [type]: { ...colors, bg: e.target.value } })}
                    className="w-6 h-6 rounded cursor-pointer"
                    disabled={!isAdmin}
                  />
                </div>
              ))}
            </div>
            <Button size="sm" className="mt-3" onClick={() => setShowColorEditor(false)}>Done</Button>
          </div>
        )}

        <div className="mb-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>Built-in:</strong> Day, Night, Off, Leave, Vacation, Sick, Training, Shutdown
          </p>
        </div>

        {showForm && (
          <div className="mb-4 p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">{editingShiftType ? "Edit" : "New"} Shift Type</h4>
              <Button variant="ghost" size="sm" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="shift-type-code">Code</Label>
                <Input
                  id="shift-type-code"
                  name="shift-type-code"
                  placeholder="e.g., BRV"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  maxLength={10}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shift-type-name">Name</Label>
                <Input
                  id="shift-type-name"
                  name="shift-type-name"
                  placeholder="e.g., Bereavement"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shift-type-bg-color">Background Color</Label>
                <div className="flex gap-2">
                  <input
                    id="shift-type-bg-color"
                    name="shift-type-bg-color"
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <Input
                    id="shift-type-bg-color-hex"
                    name="shift-type-bg-color-hex"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="shift-type-text-color">Text Color</Label>
                <div className="flex gap-2">
                  <input
                    id="shift-type-text-color"
                    name="shift-type-text-color"
                    type="color"
                    value={form.textColor}
                    onChange={(e) => setForm({ ...form, textColor: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <Input
                    id="shift-type-text-color-hex"
                    name="shift-type-text-color-hex"
                    value={form.textColor}
                    onChange={(e) => setForm({ ...form, textColor: e.target.value })}
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <Label>Preview</Label>
                <div className="mt-2">
                  <span
                    className="px-3 py-1 rounded text-sm font-bold"
                    style={{ backgroundColor: form.color, color: form.textColor }}
                  >
                    {form.code || "CODE"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editingShiftType ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {customShiftTypes.map((st) => (
            <div key={st.id} className="flex items-center justify-between p-3 rounded border">
              <div className="flex items-center gap-3">
                <span
                  className="px-2 py-1 rounded text-xs font-bold"
                  style={{ backgroundColor: st.color, color: st.textColor }}
                >
                  {st.code}
                </span>
                <div>
                  <p className="font-medium">{st.name}</p>
                  {st.description && <p className="text-sm text-muted-foreground">{st.description}</p>}
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(st)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(st.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          ))}
          {customShiftTypes.length === 0 && (
            <p className="text-center text-muted-foreground py-4">No custom shift types</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export { DEFAULT_SHIFT_COLORS }
