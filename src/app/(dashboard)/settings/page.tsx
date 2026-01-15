"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Modal } from "@/components/ui/modal"
import { Select } from "@/components/ui/select"
import {
  Building2,
  Calendar,
  Bell,
  Shield,
  Clock,
  Save,
  LayoutGrid,
  Plus,
  Pencil,
  Trash2,
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
  daysOn: number
  daysOff: number
  includesNights: boolean
  isDefault: boolean
  _count: {
    crews: number
  }
}

interface Position {
  id: string
  name: string
  code: string | null
  category: string | null
  shiftType: string
  minStaffing: number
  maxStaffing: number
  sortOrder: number
}

interface NewPatternForm {
  name: string
  daysOn: number
  daysOff: number
  includesNights: boolean
}

interface PositionForm {
  name: string
  code: string
  category: string
  shiftType: string
  minStaffing: number
  maxStaffing: number
  sortOrder: number
}

const CATEGORY_OPTIONS = [
  { value: "Leadership", label: "Leadership" },
  { value: "Control Room", label: "Control Room" },
  { value: "Field Ops", label: "Field Ops" },
]

const SHIFT_TYPE_OPTIONS = [
  { value: "day", label: "Day Shift" },
  { value: "night", label: "Night Shift" },
  { value: "24hr", label: "24-Hour (On-Call)" },
]

const initialPositionForm: PositionForm = {
  name: "",
  code: "",
  category: "Field Ops",
  shiftType: "day",
  minStaffing: 1,
  maxStaffing: 1,
  sortOrder: 0,
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [patterns, setPatterns] = useState<RotationPattern[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [showNewPattern, setShowNewPattern] = useState(false)
  const [newPattern, setNewPattern] = useState<NewPatternForm>({
    name: "",
    daysOn: 21,
    daysOff: 21,
    includesNights: true,
  })
  const [creatingPattern, setCreatingPattern] = useState(false)

  // Position modal state
  const [positionModalOpen, setPositionModalOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState<Position | null>(null)
  const [positionForm, setPositionForm] = useState<PositionForm>(initialPositionForm)
  const [savingPosition, setSavingPosition] = useState(false)

  const isAdmin = session?.user?.role === "ADMIN"

  useEffect(() => {
    async function fetchData() {
      try {
        const [orgRes, patternsRes, positionsRes] = await Promise.all([
          fetch("/api/organization"),
          fetch("/api/rotation-patterns"),
          fetch("/api/positions"),
        ])

        const orgData = await orgRes.json()
        const patternsData = await patternsRes.json()
        const positionsData = await positionsRes.json()

        if (orgData.success) setOrganization(orgData.data)
        if (patternsData.success) setPatterns(patternsData.data)
        if (positionsData.success) setPositions(positionsData.data)
      } catch (error) {
        console.error("Failed to fetch data:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  async function createPattern() {
    if (!newPattern.name || newPattern.daysOn <= 0 || newPattern.daysOff <= 0) {
      setMessage("Please fill in all pattern fields")
      return
    }

    setCreatingPattern(true)
    setMessage("")

    try {
      const response = await fetch("/api/rotation-patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPattern.name,
          daysOn: newPattern.daysOn,
          daysOff: newPattern.daysOff,
          includesNights: newPattern.includesNights,
          nightsAtStart: true,
          nightDays: newPattern.daysOn,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage("Pattern created successfully!")
        setPatterns([...patterns, data.data])
        setShowNewPattern(false)
        setNewPattern({ name: "", daysOn: 21, daysOff: 21, includesNights: true })
        setTimeout(() => setMessage(""), 3000)
      } else {
        setMessage(data.error || "Failed to create pattern")
      }
    } catch (error) {
      console.error("Failed to create pattern:", error)
      setMessage("Failed to create pattern")
    } finally {
      setCreatingPattern(false)
    }
  }

  function openAddPosition() {
    setEditingPosition(null)
    setPositionForm(initialPositionForm)
    setPositionModalOpen(true)
  }

  function openEditPosition(position: Position) {
    setEditingPosition(position)
    setPositionForm({
      name: position.name,
      code: position.code || "",
      category: position.category || "Field Ops",
      shiftType: position.shiftType,
      minStaffing: position.minStaffing,
      maxStaffing: position.maxStaffing,
      sortOrder: position.sortOrder,
    })
    setPositionModalOpen(true)
  }

  async function savePosition() {
    if (!positionForm.name) {
      setMessage("Position name is required")
      return
    }

    setSavingPosition(true)
    setMessage("")

    try {
      const url = editingPosition
        ? `/api/positions/${editingPosition.id}`
        : "/api/positions"
      const method = editingPosition ? "PATCH" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: positionForm.name,
          code: positionForm.code || null,
          category: positionForm.category,
          shiftType: positionForm.shiftType,
          minStaffing: positionForm.minStaffing,
          maxStaffing: positionForm.maxStaffing,
          sortOrder: positionForm.sortOrder,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        // Refresh positions
        const positionsRes = await fetch("/api/positions")
        const positionsData = await positionsRes.json()
        if (positionsData.success) setPositions(positionsData.data)

        setMessage(editingPosition ? "Position updated!" : "Position created!")
        setPositionModalOpen(false)
        setTimeout(() => setMessage(""), 3000)
      } else {
        setMessage(data.error || "Failed to save position")
      }
    } catch (error) {
      console.error("Failed to save position:", error)
      setMessage("Failed to save position")
    } finally {
      setSavingPosition(false)
    }
  }

  async function deletePosition(position: Position) {
    if (!confirm(`Delete position "${position.name}"?`)) return

    try {
      const response = await fetch(`/api/positions/${position.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setPositions(positions.filter((p) => p.id !== position.id))
        setMessage("Position deleted!")
        setTimeout(() => setMessage(""), 3000)
      } else {
        const data = await response.json()
        setMessage(data.error || "Failed to delete position")
      }
    } catch (error) {
      console.error("Failed to delete position:", error)
      setMessage("Failed to delete position")
    }
  }

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

  // Group positions by category
  const positionsByCategory = positions.reduce((acc, pos) => {
    const cat = pos.category || "Other"
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(pos)
    return acc
  }, {} as Record<string, Position[]>)

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
        <Alert variant={message.includes("success") || message.includes("created") || message.includes("updated") || message.includes("deleted") ? "success" : "destructive"}>
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
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Rotation Patterns
                </CardTitle>
                <CardDescription>Configure shift rotation patterns</CardDescription>
              </div>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewPattern(!showNewPattern)}
                >
                  {showNewPattern ? "Cancel" : "+ Add Pattern"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* New Pattern Form */}
            {showNewPattern && (
              <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                <h4 className="font-semibold">Create New Rotation Pattern</h4>

                <div className="space-y-2">
                  <Label htmlFor="patternName">Pattern Name</Label>
                  <Input
                    id="patternName"
                    placeholder="e.g., 3 weeks on / 3 weeks off"
                    value={newPattern.name}
                    onChange={(e) => setNewPattern({ ...newPattern, name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="daysOn">Days On</Label>
                    <Input
                      id="daysOn"
                      type="number"
                      min={1}
                      value={newPattern.daysOn}
                      onChange={(e) => setNewPattern({ ...newPattern, daysOn: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="daysOff">Days Off</Label>
                    <Input
                      id="daysOff"
                      type="number"
                      min={1}
                      value={newPattern.daysOff}
                      onChange={(e) => setNewPattern({ ...newPattern, daysOff: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
                  <input
                    type="checkbox"
                    id="includesNights"
                    checked={newPattern.includesNights}
                    onChange={(e) => setNewPattern({ ...newPattern, includesNights: e.target.checked })}
                    className="h-5 w-5 rounded"
                  />
                  <Label htmlFor="includesNights" className="cursor-pointer">
                    Alternates Days/Nights
                  </Label>
                </div>

                <Button onClick={createPattern} disabled={creatingPattern} className="w-full">
                  {creatingPattern ? "Creating..." : "Create Pattern"}
                </Button>
              </div>
            )}

            {/* Existing Patterns */}
            <div className="space-y-2">
              {patterns.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No patterns yet
                </p>
              ) : (
                patterns.map((pattern) => (
                  <div
                    key={pattern.id}
                    className="flex items-center justify-between p-3 rounded border"
                  >
                    <div>
                      <p className="font-medium">{pattern.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {pattern.daysOn} on / {pattern.daysOff} off
                        {pattern.includesNights && " • Day/Night"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {pattern.isDefault && <Badge variant="secondary">Default</Badge>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Positions Management */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5" />
                  Positions
                </CardTitle>
                <CardDescription>Configure staffing positions and requirements</CardDescription>
              </div>
              {isAdmin && (
                <Button size="sm" onClick={openAddPosition}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Position
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {positions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No positions configured yet. Add positions to track staffing requirements.
              </p>
            ) : (
              <div className="space-y-6">
                {Object.entries(positionsByCategory).map(([category, categoryPositions]) => (
                  <div key={category}>
                    <h4 className="font-semibold text-sm text-muted-foreground mb-2">{category}</h4>
                    <div className="space-y-2">
                      {categoryPositions
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((position) => (
                          <div
                            key={position.id}
                            className="flex items-center justify-between p-3 rounded border hover:bg-muted/50"
                          >
                            <div>
                              <p className="font-medium">
                                {position.name}
                                {position.code && (
                                  <span className="text-muted-foreground ml-2">({position.code})</span>
                                )}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {position.shiftType === "24hr" ? "24-Hour" : position.shiftType === "day" ? "Day Shift" : "Night Shift"}
                                {" • "}
                                Min: {position.minStaffing} / Max: {position.maxStaffing}
                              </p>
                            </div>
                            {isAdmin && (
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditPosition(position)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => deletePosition(position)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
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

      {/* Position Modal */}
      <Modal
        isOpen={positionModalOpen}
        onClose={() => setPositionModalOpen(false)}
        title={editingPosition ? "Edit Position" : "Add Position"}
        description="Configure position details and staffing requirements"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="posName">Position Name *</Label>
            <Input
              id="posName"
              value={positionForm.name}
              onChange={(e) => setPositionForm({ ...positionForm, name: e.target.value })}
              placeholder="e.g., Production Lead - Days"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="posCode">Code (Optional)</Label>
              <Input
                id="posCode"
                value={positionForm.code}
                onChange={(e) => setPositionForm({ ...positionForm, code: e.target.value })}
                placeholder="e.g., PL-D"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="posCategory">Category</Label>
              <Select
                value={positionForm.category}
                onChange={(e) => setPositionForm({ ...positionForm, category: e.target.value })}
                options={CATEGORY_OPTIONS}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="posShiftType">Shift Type</Label>
            <Select
              value={positionForm.shiftType}
              onChange={(e) => setPositionForm({ ...positionForm, shiftType: e.target.value })}
              options={SHIFT_TYPE_OPTIONS}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="posMin">Min Staffing</Label>
              <Input
                id="posMin"
                type="number"
                min={0}
                value={positionForm.minStaffing}
                onChange={(e) => setPositionForm({ ...positionForm, minStaffing: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="posMax">Max Staffing</Label>
              <Input
                id="posMax"
                type="number"
                min={1}
                value={positionForm.maxStaffing}
                onChange={(e) => setPositionForm({ ...positionForm, maxStaffing: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="posSortOrder">Sort Order</Label>
              <Input
                id="posSortOrder"
                type="number"
                value={positionForm.sortOrder}
                onChange={(e) => setPositionForm({ ...positionForm, sortOrder: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setPositionModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={savePosition} disabled={savingPosition}>
              {savingPosition ? "Saving..." : editingPosition ? "Update Position" : "Create Position"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
