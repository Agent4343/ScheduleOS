"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Building2,
  Calendar,
  Bell,
  Shield,
  Clock,
  Save,
  Plus,
  Pencil,
  Trash2,
  X,
  Palette,
} from "lucide-react"

interface Organization {
  id: string
  name: string
  slug: string
  settings: {
    timezone?: string
    weekStartsOn?: number
    minStaffingAlertEnabled?: boolean
    emailNotificationsEnabled?: boolean
    smsNotificationsEnabled?: boolean
  }
  _count: {
    users: number
    crews: number
    rotationPatterns: number
  }
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
  isDefault: boolean
  _count: {
    crews: number
  }
}

interface NewPattern {
  name: string
  description: string
  daysOn: number
  daysOff: number
  includesNights: boolean
  nightDays: number
  nightsAtStart: boolean
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

interface NewShiftType {
  code: string
  name: string
  color: string
  textColor: string
  description: string
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [patterns, setPatterns] = useState<RotationPattern[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  // Pattern form state
  const [showPatternForm, setShowPatternForm] = useState(false)
  const [editingPattern, setEditingPattern] = useState<RotationPattern | null>(null)
  const [savingPattern, setSavingPattern] = useState(false)
  const [newPattern, setNewPattern] = useState<NewPattern>({
    name: "",
    description: "",
    daysOn: 14,
    daysOff: 14,
    includesNights: false,
    nightDays: 0,
    nightsAtStart: true,
  })

  // Custom shift type state
  const [customShiftTypes, setCustomShiftTypes] = useState<CustomShiftType[]>([])
  const [showShiftTypeForm, setShowShiftTypeForm] = useState(false)
  const [editingShiftType, setEditingShiftType] = useState<CustomShiftType | null>(null)
  const [savingShiftType, setSavingShiftType] = useState(false)
  const [newShiftType, setNewShiftType] = useState<NewShiftType>({
    code: "",
    name: "",
    color: "#6b7280",
    textColor: "#ffffff",
    description: "",
  })

  const isAdmin = session?.user?.role === "ADMIN"

  const resetPatternForm = () => {
    setNewPattern({
      name: "",
      description: "",
      daysOn: 14,
      daysOff: 14,
      includesNights: false,
      nightDays: 0,
      nightsAtStart: true,
    })
    setEditingPattern(null)
    setShowPatternForm(false)
  }

  const startEditPattern = (pattern: RotationPattern) => {
    setEditingPattern(pattern)
    setNewPattern({
      name: pattern.name,
      description: pattern.description || "",
      daysOn: pattern.daysOn,
      daysOff: pattern.daysOff,
      includesNights: pattern.includesNights,
      nightDays: pattern.nightDays,
      nightsAtStart: pattern.nightsAtStart,
    })
    setShowPatternForm(true)
  }

  const handleSavePattern = async () => {
    if (!newPattern.name.trim()) {
      setMessage("Pattern name is required")
      return
    }

    setSavingPattern(true)
    setMessage("")

    try {
      const url = editingPattern
        ? `/api/rotation-patterns?id=${editingPattern.id}`
        : "/api/rotation-patterns"

      const response = await fetch(url, {
        method: editingPattern ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPattern),
      })

      const data = await response.json()

      if (data.success) {
        // Refresh patterns list
        const patternsRes = await fetch("/api/rotation-patterns")
        const patternsData = await patternsRes.json()
        if (patternsData.success) setPatterns(patternsData.data)

        setMessage(editingPattern ? "Pattern updated successfully" : "Pattern created successfully")
        resetPatternForm()
        setTimeout(() => setMessage(""), 3000)
      } else {
        setMessage(data.error || "Failed to save pattern")
      }
    } catch (error) {
      console.error("Failed to save pattern:", error)
      setMessage("Failed to save pattern")
    } finally {
      setSavingPattern(false)
    }
  }

  const handleDeletePattern = async (patternId: string) => {
    if (!confirm("Are you sure you want to delete this pattern? Crews using it will need to be reassigned.")) {
      return
    }

    try {
      const response = await fetch(`/api/rotation-patterns?id=${patternId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (data.success) {
        setPatterns(patterns.filter(p => p.id !== patternId))
        setMessage("Pattern deleted successfully")
        setTimeout(() => setMessage(""), 3000)
      } else {
        setMessage(data.error || "Failed to delete pattern")
      }
    } catch (error) {
      console.error("Failed to delete pattern:", error)
      setMessage("Failed to delete pattern")
    }
  }

  // Custom shift type handlers
  const resetShiftTypeForm = () => {
    setNewShiftType({
      code: "",
      name: "",
      color: "#6b7280",
      textColor: "#ffffff",
      description: "",
    })
    setEditingShiftType(null)
    setShowShiftTypeForm(false)
  }

  const startEditShiftType = (shiftType: CustomShiftType) => {
    setEditingShiftType(shiftType)
    setNewShiftType({
      code: shiftType.code,
      name: shiftType.name,
      color: shiftType.color,
      textColor: shiftType.textColor,
      description: shiftType.description || "",
    })
    setShowShiftTypeForm(true)
  }

  const handleSaveShiftType = async () => {
    if (!newShiftType.code.trim() || !newShiftType.name.trim()) {
      setMessage("Code and name are required")
      return
    }

    setSavingShiftType(true)
    setMessage("")

    try {
      const url = editingShiftType
        ? `/api/custom-shift-types/${editingShiftType.id}`
        : "/api/custom-shift-types"

      const response = await fetch(url, {
        method: editingShiftType ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newShiftType),
      })

      const data = await response.json()

      if (data.success) {
        // Refresh shift types list
        const shiftTypesRes = await fetch("/api/custom-shift-types")
        const shiftTypesData = await shiftTypesRes.json()
        if (shiftTypesData.success) setCustomShiftTypes(shiftTypesData.data)

        setMessage(editingShiftType ? "Shift type updated successfully" : "Shift type created successfully")
        resetShiftTypeForm()
        setTimeout(() => setMessage(""), 3000)
      } else {
        setMessage(data.error || "Failed to save shift type")
      }
    } catch (error) {
      console.error("Failed to save shift type:", error)
      setMessage("Failed to save shift type")
    } finally {
      setSavingShiftType(false)
    }
  }

  const handleDeleteShiftType = async (shiftTypeId: string) => {
    if (!confirm("Are you sure you want to delete this shift type?")) {
      return
    }

    try {
      const response = await fetch(`/api/custom-shift-types/${shiftTypeId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (data.success) {
        setCustomShiftTypes(customShiftTypes.filter(st => st.id !== shiftTypeId))
        setMessage("Shift type deleted successfully")
        setTimeout(() => setMessage(""), 3000)
      } else {
        setMessage(data.error || "Failed to delete shift type")
      }
    } catch (error) {
      console.error("Failed to delete shift type:", error)
      setMessage("Failed to delete shift type")
    }
  }

  useEffect(() => {
    async function fetchData() {
      try {
        const [orgRes, patternsRes, shiftTypesRes] = await Promise.all([
          fetch("/api/organization"),
          fetch("/api/rotation-patterns"),
          fetch("/api/custom-shift-types"),
        ])

        const orgData = await orgRes.json()
        const patternsData = await patternsRes.json()
        const shiftTypesData = await shiftTypesRes.json()

        if (orgData.success) setOrganization(orgData.data)
        if (patternsData.success) setPatterns(patternsData.data)
        if (shiftTypesData.success) setCustomShiftTypes(shiftTypesData.data)
      } catch (error) {
        console.error("Failed to fetch data:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  async function handleSave() {
    if (!organization) return

    setSaving(true)
    setMessage("")

    try {
      const response = await fetch("/api/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: organization.name,
          settings: organization.settings,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setMessage("Settings saved successfully")
        setTimeout(() => setMessage(""), 3000)
      } else {
        setMessage(data.error || "Failed to save settings")
      }
    } catch (error) {
      console.error("Failed to save:", error)
      setMessage("Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid gap-6 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 w-32 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization settings and preferences
        </p>
      </div>

      {message && (
        <Alert variant={message.includes("success") ? "success" : "destructive"}>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Organization Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organization
            </CardTitle>
            <CardDescription>Basic organization information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                value={organization?.name || ""}
                onChange={(e) =>
                  setOrganization((prev) =>
                    prev ? { ...prev, name: e.target.value } : null
                  )
                }
                disabled={!isAdmin}
              />
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <p className="text-2xl font-bold">{organization?._count.users || 0}</p>
                <p className="text-xs text-muted-foreground">Workers</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{organization?._count.crews || 0}</p>
                <p className="text-xs text-muted-foreground">Crews</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{organization?._count.rotationPatterns || 0}</p>
                <p className="text-xs text-muted-foreground">Patterns</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Schedule Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Schedule Settings
            </CardTitle>
            <CardDescription>Configure scheduling preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                value={organization?.settings?.timezone || "America/St_Johns"}
                onChange={(e) =>
                  setOrganization((prev) =>
                    prev
                      ? { ...prev, settings: { ...prev.settings, timezone: e.target.value } }
                      : null
                  )
                }
                disabled={!isAdmin}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Minimum Staffing Alerts</p>
                <p className="text-xs text-muted-foreground">
                  Get notified when staffing drops below minimum
                </p>
              </div>
              <Badge
                variant={organization?.settings?.minStaffingAlertEnabled ? "success" : "secondary"}
              >
                {organization?.settings?.minStaffingAlertEnabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>Manage notification preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Email Notifications</p>
                <p className="text-xs text-muted-foreground">
                  Receive updates via email
                </p>
              </div>
              <Badge
                variant={organization?.settings?.emailNotificationsEnabled ? "success" : "secondary"}
              >
                {organization?.settings?.emailNotificationsEnabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">SMS Notifications</p>
                <p className="text-xs text-muted-foreground">
                  Receive urgent updates via SMS
                </p>
              </div>
              <Badge
                variant={organization?.settings?.smsNotificationsEnabled ? "success" : "secondary"}
              >
                {organization?.settings?.smsNotificationsEnabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Rotation Patterns */}
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
              {isAdmin && !showPatternForm && (
                <Button size="sm" onClick={() => setShowPatternForm(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Pattern
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Pattern Form */}
            {showPatternForm && (
              <div className="mb-4 p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium">
                    {editingPattern ? "Edit Pattern" : "New Pattern"}
                  </h4>
                  <Button variant="ghost" size="sm" onClick={resetPatternForm}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="patternName">Pattern Name</Label>
                    <Input
                      id="patternName"
                      placeholder="e.g., 14/14 with Nights"
                      value={newPattern.name}
                      onChange={(e) => setNewPattern({ ...newPattern, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="patternDesc">Description (optional)</Label>
                    <Input
                      id="patternDesc"
                      placeholder="e.g., Standard offshore rotation"
                      value={newPattern.description}
                      onChange={(e) => setNewPattern({ ...newPattern, description: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="daysOn">Days On</Label>
                    <Input
                      id="daysOn"
                      type="number"
                      min={1}
                      max={60}
                      value={newPattern.daysOn}
                      onChange={(e) => setNewPattern({ ...newPattern, daysOn: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="daysOff">Days Off</Label>
                    <Input
                      id="daysOff"
                      type="number"
                      min={1}
                      max={60}
                      value={newPattern.daysOff}
                      onChange={(e) => setNewPattern({ ...newPattern, daysOff: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                  <div className="md:col-span-2 space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="includesNights"
                        checked={newPattern.includesNights}
                        onChange={(e) => setNewPattern({
                          ...newPattern,
                          includesNights: e.target.checked,
                          nightDays: e.target.checked ? Math.floor(newPattern.daysOn / 2) : 0,
                        })}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="includesNights">Includes Night Shifts</Label>
                    </div>
                    {newPattern.includesNights && (
                      <div className="ml-6 grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="nightDays">Number of Night Days</Label>
                          <Input
                            id="nightDays"
                            type="number"
                            min={1}
                            max={newPattern.daysOn}
                            value={newPattern.nightDays}
                            onChange={(e) => setNewPattern({ ...newPattern, nightDays: parseInt(e.target.value) || 1 })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Night Shift Position</Label>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={newPattern.nightsAtStart ? "default" : "outline"}
                              onClick={() => setNewPattern({ ...newPattern, nightsAtStart: true })}
                            >
                              Start
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={!newPattern.nightsAtStart ? "default" : "outline"}
                              onClick={() => setNewPattern({ ...newPattern, nightsAtStart: false })}
                            >
                              End
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {newPattern.nightsAtStart
                              ? "Night shifts at the start of the rotation"
                              : "Night shifts at the end of the rotation"}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={resetPatternForm}>
                    Cancel
                  </Button>
                  <Button onClick={handleSavePattern} disabled={savingPattern}>
                    {savingPattern ? "Saving..." : editingPattern ? "Update Pattern" : "Create Pattern"}
                  </Button>
                </div>
              </div>
            )}

            {/* Patterns List */}
            <div className="space-y-2">
              {patterns.map((pattern) => (
                <div
                  key={pattern.id}
                  className="flex items-center justify-between p-3 rounded border"
                >
                  <div>
                    <p className="font-medium">{pattern.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {pattern.daysOn} on / {pattern.daysOff} off
                      {pattern.includesNights && ` • ${pattern.nightDays} nights`}
                      {pattern.includesNights && (pattern.nightsAtStart ? " (at start)" : " (at end)")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {pattern.isDefault && <Badge variant="secondary">Default</Badge>}
                    <Badge variant="outline">{pattern._count.crews} crews</Badge>
                    {isAdmin && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditPattern(pattern)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePattern(pattern.id)}
                          disabled={pattern._count.crews > 0}
                          title={pattern._count.crews > 0 ? "Cannot delete - pattern is in use" : "Delete pattern"}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {patterns.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No rotation patterns configured
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Custom Shift Types */}
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
              {isAdmin && !showShiftTypeForm && (
                <Button size="sm" onClick={() => setShowShiftTypeForm(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Shift Type
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Built-in types info */}
            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">
                <strong>Built-in shift types:</strong> Day, Night, Off, Leave, Vacation, Sick, Training, Shutdown, PL Day, PL Night
              </p>
              <p className="text-xs text-muted-foreground">
                Create custom shift types below for additional needs like Bereavement, Jury Duty, Medical Leave, etc.
              </p>
            </div>

            {/* Shift Type Form */}
            {showShiftTypeForm && (
              <div className="mb-4 p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium">
                    {editingShiftType ? "Edit Shift Type" : "New Shift Type"}
                  </h4>
                  <Button variant="ghost" size="sm" onClick={resetShiftTypeForm}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="shiftCode">Code (1-10 chars)</Label>
                    <Input
                      id="shiftCode"
                      placeholder="e.g., BRV, JD, MED"
                      value={newShiftType.code}
                      onChange={(e) => setNewShiftType({ ...newShiftType, code: e.target.value.toUpperCase() })}
                      maxLength={10}
                    />
                    <p className="text-xs text-muted-foreground">Short code shown in calendar cells</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shiftName">Name</Label>
                    <Input
                      id="shiftName"
                      placeholder="e.g., Bereavement"
                      value={newShiftType.name}
                      onChange={(e) => setNewShiftType({ ...newShiftType, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shiftColor">Background Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="shiftColor"
                        type="color"
                        value={newShiftType.color}
                        onChange={(e) => setNewShiftType({ ...newShiftType, color: e.target.value })}
                        className="w-16 h-10 p-1"
                      />
                      <Input
                        value={newShiftType.color}
                        onChange={(e) => setNewShiftType({ ...newShiftType, color: e.target.value })}
                        placeholder="#6b7280"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shiftTextColor">Text Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="shiftTextColor"
                        type="color"
                        value={newShiftType.textColor}
                        onChange={(e) => setNewShiftType({ ...newShiftType, textColor: e.target.value })}
                        className="w-16 h-10 p-1"
                      />
                      <Input
                        value={newShiftType.textColor}
                        onChange={(e) => setNewShiftType({ ...newShiftType, textColor: e.target.value })}
                        placeholder="#ffffff"
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="shiftDesc">Description (optional)</Label>
                    <Input
                      id="shiftDesc"
                      placeholder="e.g., For family bereavement leave"
                      value={newShiftType.description}
                      onChange={(e) => setNewShiftType({ ...newShiftType, description: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Preview</Label>
                    <div className="mt-2 flex items-center gap-4">
                      <div
                        className="px-3 py-2 rounded text-sm font-bold"
                        style={{ backgroundColor: newShiftType.color, color: newShiftType.textColor }}
                      >
                        {newShiftType.code || "CODE"}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {newShiftType.name || "Shift Name"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={resetShiftTypeForm}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveShiftType} disabled={savingShiftType}>
                    {savingShiftType ? "Saving..." : editingShiftType ? "Update Shift Type" : "Create Shift Type"}
                  </Button>
                </div>
              </div>
            )}

            {/* Shift Types List */}
            <div className="space-y-2">
              {customShiftTypes.map((shiftType) => (
                <div
                  key={shiftType.id}
                  className="flex items-center justify-between p-3 rounded border"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="px-2 py-1 rounded text-xs font-bold min-w-[40px] text-center"
                      style={{ backgroundColor: shiftType.color, color: shiftType.textColor }}
                    >
                      {shiftType.code}
                    </div>
                    <div>
                      <p className="font-medium">{shiftType.name}</p>
                      {shiftType.description && (
                        <p className="text-sm text-muted-foreground">{shiftType.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!shiftType.isActive && <Badge variant="secondary">Inactive</Badge>}
                    {isAdmin && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditShiftType(shiftType)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteShiftType(shiftType.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {customShiftTypes.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No custom shift types created yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save button */}
      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      )}

      {/* Account section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Your Account
          </CardTitle>
          <CardDescription>Manage your personal account settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground text-xs">Name</Label>
              <p className="font-medium">{session?.user?.name || "Not set"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Email</Label>
              <p className="font-medium">{session?.user?.email}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Role</Label>
              <Badge>{session?.user?.role}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
