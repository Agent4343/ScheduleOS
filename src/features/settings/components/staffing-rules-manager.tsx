"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/select"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { Plus, Trash2, Pencil, X, Loader2, Save, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

/**
 * Minimum-staffing rules editor, shown inside the Notifications card when
 * staffing alerts are enabled. (Moved verbatim from settings/page.tsx; still
 * uses fetch() directly — a candidate for the hooks pattern.)
 */

interface StaffingRule {
  id: string
  name: string
  description?: string | null
  shiftType: "DAY" | "NIGHT"
  minWorkers: number
  maxVacation: number
  role?: string | null
  positionType?: string | null
  crewId?: string | null
  priority: number
  isActive: boolean
  crew?: { id: string; name: string; color: string } | null
}

const POSITION_LABELS: Record<string, string> = {
  OPERATOR: "Operator",
  ONSHORE_CONTROL_ROOM: "Control Room",
  OTHER: "Other",
}

export function StaffingRulesManager({ isAdmin }: { isAdmin: boolean }) {
  const confirmDialog = useConfirm()
  const [rules, setRules] = useState<StaffingRule[]>([])
  const [crews, setCrews] = useState<{ id: string; name: string; color: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<StaffingRule | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // Form state
  const [formName, setFormName] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formShiftType, setFormShiftType] = useState<"DAY" | "NIGHT">("DAY")
  const [formMinWorkers, setFormMinWorkers] = useState(1)
  const [formMaxVacation, setFormMaxVacation] = useState(1)
  const [formPositionType, setFormPositionType] = useState("")
  const [formCrewId, setFormCrewId] = useState("")
  const [formPriority, setFormPriority] = useState(0)

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch("/api/staffing-rules")
      const data = await res.json()
      if (data.success) setRules(data.data)
    } catch {
      console.error("Failed to fetch staffing rules")
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCrews = useCallback(async () => {
    try {
      const res = await fetch("/api/crews")
      const data = await res.json()
      if (data.success) setCrews(data.data || [])
    } catch {
      console.error("Failed to fetch crews")
    }
  }, [])

  useEffect(() => {
    fetchRules()
    fetchCrews()
  }, [fetchRules, fetchCrews])

  const resetForm = () => {
    setFormName("")
    setFormDescription("")
    setFormShiftType("DAY")
    setFormMinWorkers(1)
    setFormMaxVacation(1)
    setFormPositionType("")
    setFormCrewId("")
    setFormPriority(0)
    setEditingRule(null)
    setShowForm(false)
    setError("")
  }

  const startEdit = (rule: StaffingRule) => {
    setEditingRule(rule)
    setFormName(rule.name)
    setFormDescription(rule.description || "")
    setFormShiftType(rule.shiftType)
    setFormMinWorkers(rule.minWorkers)
    setFormMaxVacation(rule.maxVacation)
    setFormPositionType(rule.positionType || "")
    setFormCrewId(rule.crewId || "")
    setFormPriority(rule.priority)
    setShowForm(true)
    setError("")
  }

  const handleSave = async () => {
    if (!formName.trim()) {
      setError("Rule name is required")
      return
    }
    if (formMinWorkers < 0) {
      setError("Minimum workers must be 0 or more")
      return
    }

    setSaving(true)
    setError("")

    const payload = {
      name: formName.trim(),
      description: formDescription.trim() || null,
      shiftType: formShiftType,
      minWorkers: formMinWorkers,
      maxVacation: formMaxVacation,
      positionType: formPositionType || null,
      crewId: formCrewId || null,
      priority: formPriority,
      isActive: true,
    }

    try {
      const url = editingRule
        ? `/api/staffing-rules/${editingRule.id}`
        : "/api/staffing-rules"
      const method = editingRule ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to save rule")
        return
      }

      await fetchRules()
      resetForm()
    } catch {
      setError("Failed to save staffing rule")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const ok = await confirmDialog({ title: "Delete this staffing rule?", confirmLabel: "Delete", destructive: true })
    if (!ok) return

    try {
      const res = await fetch(`/api/staffing-rules/${id}`, { method: "DELETE" })
      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== id))
      }
    } catch {
      console.error("Failed to delete rule")
    }
  }

  const handleToggleActive = async (rule: StaffingRule) => {
    try {
      const res = await fetch(`/api/staffing-rules/${rule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !rule.isActive }),
      })
      if (res.ok) {
        setRules((prev) =>
          prev.map((r) => (r.id === rule.id ? { ...r, isActive: !r.isActive } : r))
        )
      }
    } catch {
      console.error("Failed to toggle rule")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 border-t pt-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4 pt-2 border-t">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">Staffing Rules</p>
          <p className="text-xs text-muted-foreground">
            {rules.length} rule{rules.length !== 1 ? "s" : ""} configured
          </p>
        </div>
        {isAdmin && !showForm && (
          <Button size="sm" onClick={() => { resetForm(); setShowForm(true) }}>
            <Plus className="h-4 w-4 mr-1" />
            Add Rule
          </Button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">{editingRule ? "Edit" : "New"} Staffing Rule</h4>
            <Button variant="ghost" size="sm" onClick={resetForm}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rule-name">Rule Name *</Label>
              <Input
                id="rule-name"
                name="rule-name"
                placeholder="e.g., Min Day Operators"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-shift">Shift Type *</Label>
              <Select
                id="rule-shift"
                name="rule-shift"
                value={formShiftType}
                onChange={(e) => setFormShiftType(e.target.value as "DAY" | "NIGHT")}
                options={[
                  { value: "DAY", label: "Day Shift" },
                  { value: "NIGHT", label: "Night Shift" },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rule-min-workers">Minimum Workers *</Label>
              <Input
                id="rule-min-workers"
                name="rule-min-workers"
                type="number"
                min={0}
                value={formMinWorkers}
                onChange={(e) => setFormMinWorkers(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">Alert when below this number</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-max-vacation">Max on Vacation</Label>
              <Input
                id="rule-max-vacation"
                name="rule-max-vacation"
                type="number"
                min={0}
                value={formMaxVacation}
                onChange={(e) => setFormMaxVacation(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">Max simultaneous vacations allowed</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rule-position">Position Type</Label>
              <Select
                id="rule-position"
                name="rule-position"
                value={formPositionType}
                onChange={(e) => setFormPositionType(e.target.value)}
                options={[
                  { value: "", label: "All Positions" },
                  { value: "OPERATOR", label: "Operator" },
                  { value: "ONSHORE_CONTROL_ROOM", label: "Onshore Control Room" },
                  { value: "OTHER", label: "Other" },
                ]}
              />
              <p className="text-xs text-muted-foreground">Optional: limit to a position</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-crew">Crew</Label>
              <Select
                id="rule-crew"
                name="rule-crew"
                value={formCrewId}
                onChange={(e) => setFormCrewId(e.target.value)}
                options={[
                  { value: "", label: "All Crews" },
                  ...crews.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
              <p className="text-xs text-muted-foreground">Optional: limit to a specific crew</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rule-priority">Priority</Label>
              <Input
                id="rule-priority"
                name="rule-priority"
                type="number"
                min={0}
                max={100}
                value={formPriority}
                onChange={(e) => setFormPriority(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">Higher = checked first (0-100)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-description">Description</Label>
              <Input
                id="rule-description"
                name="rule-description"
                placeholder="Optional note about this rule"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button variant="outline" onClick={resetForm} className="min-h-[44px]">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="min-h-[44px]">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {editingRule ? "Update Rule" : "Create Rule"}
            </Button>
          </div>
        </div>
      )}

      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No staffing rules configured</p>
          <p className="text-xs mt-1">Add rules to get alerts when shifts are understaffed</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border gap-2 min-h-[44px] ${
                !rule.isActive ? "opacity-60 bg-muted/30" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">{rule.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {rule.shiftType === "DAY" ? "Day" : "Night"}
                  </Badge>
                  <Badge className="text-xs bg-primary/10 text-primary">
                    Min: {rule.minWorkers}
                  </Badge>
                  {rule.positionType && (
                    <Badge variant="secondary" className="text-xs">
                      {POSITION_LABELS[rule.positionType] || rule.positionType}
                    </Badge>
                  )}
                  {rule.crew && (
                    <Badge variant="outline" className="text-xs">
                      <span className="w-2 h-2 rounded-full mr-1 inline-block" style={{ backgroundColor: rule.crew.color }} />
                      {rule.crew.name}
                    </Badge>
                  )}
                  {!rule.isActive && (
                    <Badge variant="secondary" className="text-xs">Disabled</Badge>
                  )}
                </div>
                {rule.description && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">{rule.description}</p>
                )}
              </div>

              {isAdmin && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(rule)}
                    title={rule.isActive ? "Disable rule" : "Enable rule"}
                    className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors ${
                      rule.isActive ? "bg-primary" : "bg-muted"
                    } cursor-pointer`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        rule.isActive ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <Button variant="ghost" size="sm" onClick={() => startEdit(rule)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(rule.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
