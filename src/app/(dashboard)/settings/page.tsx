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
  Palette,
  Eye,
  EyeOff,
  Star,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"

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
    roleColors?: {
      ADMIN: string
      SUPERVISOR: string
      WORKER: string
    }
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

interface ShiftTypeConfig {
  id: string
  code: string
  name: string
  abbreviation: string
  category: string
  bgColor: string
  textColor: string
  sortOrder: number
  isActive: boolean
  isSystem: boolean
}

interface ShiftTypeForm {
  code: string
  name: string
  abbreviation: string
  category: string
  bgColor: string
  textColor: string
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

const SHIFT_TYPE_CATEGORY_OPTIONS = [
  { value: "Working", label: "Working" },
  { value: "Absence", label: "Absence" },
  { value: "Other", label: "Other" },
]

const COLOR_OPTIONS = [
  { value: "bg-green-500", label: "Green", preview: "bg-green-500" },
  { value: "bg-blue-600", label: "Blue", preview: "bg-blue-600" },
  { value: "bg-teal-500", label: "Teal", preview: "bg-teal-500" },
  { value: "bg-cyan-500", label: "Cyan", preview: "bg-cyan-500" },
  { value: "bg-indigo-600", label: "Indigo", preview: "bg-indigo-600" },
  { value: "bg-purple-600", label: "Purple", preview: "bg-purple-600" },
  { value: "bg-amber-500", label: "Amber", preview: "bg-amber-500" },
  { value: "bg-orange-500", label: "Orange", preview: "bg-orange-500" },
  { value: "bg-red-500", label: "Red", preview: "bg-red-500" },
  { value: "bg-pink-500", label: "Pink", preview: "bg-pink-500" },
  { value: "bg-yellow-400", label: "Yellow", preview: "bg-yellow-400" },
  { value: "bg-emerald-400", label: "Emerald", preview: "bg-emerald-400" },
  { value: "bg-gray-500", label: "Gray", preview: "bg-gray-500" },
  { value: "bg-slate-500", label: "Slate", preview: "bg-slate-500" },
]

const initialShiftTypeForm: ShiftTypeForm = {
  code: "",
  name: "",
  abbreviation: "",
  category: "Working",
  bgColor: "bg-gray-500",
  textColor: "text-white",
  sortOrder: 50,
}

const DEFAULT_ROLE_COLORS = {
  ADMIN: "bg-red-500",
  SUPERVISOR: "bg-blue-500",
  WORKER: "bg-gray-500",
}

const ROLE_LABELS = {
  ADMIN: "Admin",
  SUPERVISOR: "Supervisor",
  WORKER: "Worker",
}

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

  // Shift type modal state
  const [shiftTypes, setShiftTypes] = useState<ShiftTypeConfig[]>([])
  const [shiftTypeModalOpen, setShiftTypeModalOpen] = useState(false)
  const [editingShiftType, setEditingShiftType] = useState<ShiftTypeConfig | null>(null)
  const [shiftTypeForm, setShiftTypeForm] = useState<ShiftTypeForm>(initialShiftTypeForm)
  const [savingShiftType, setSavingShiftType] = useState(false)

  // Role colors state
  const [roleColors, setRoleColors] = useState<Record<string, string>>(DEFAULT_ROLE_COLORS)
  const [editingRole, setEditingRole] = useState<string | null>(null)

  const isAdmin = session?.user?.role === "ADMIN"

  useEffect(() => {
    async function fetchData() {
      try {
        const [orgRes, patternsRes, positionsRes, shiftTypesRes] = await Promise.all([
          fetch("/api/organization"),
          fetch("/api/rotation-patterns"),
          fetch("/api/positions"),
          fetch("/api/shift-types"),
        ])

        const orgData = await orgRes.json()
        const patternsData = await patternsRes.json()
        const positionsData = await positionsRes.json()
        const shiftTypesData = await shiftTypesRes.json()

        if (orgData.success) {
          setOrganization(orgData.data)
          // Initialize role colors from organization settings
          if (orgData.data?.settings?.roleColors) {
            setRoleColors({ ...DEFAULT_ROLE_COLORS, ...orgData.data.settings.roleColors })
          }
        }
        if (patternsData.success) setPatterns(patternsData.data)
        if (positionsData.success) setPositions(positionsData.data)
        if (shiftTypesData.success) setShiftTypes(shiftTypesData.data)
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

  async function setDefaultPattern(patternId: string) {
    try {
      const response = await fetch(`/api/rotation-patterns/${patternId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      })

      if (response.ok) {
        setPatterns(patterns.map((p) => ({
          ...p,
          isDefault: p.id === patternId,
        })))
        setMessage("Default pattern updated!")
        setTimeout(() => setMessage(""), 3000)
      } else {
        const data = await response.json()
        setMessage(data.error || "Failed to set default")
      }
    } catch (error) {
      console.error("Failed to set default pattern:", error)
      setMessage("Failed to set default pattern")
    }
  }

  async function deletePattern(pattern: RotationPattern) {
    if (!confirm(`Delete pattern "${pattern.name}"?`)) return

    try {
      const response = await fetch(`/api/rotation-patterns/${pattern.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setPatterns(patterns.filter((p) => p.id !== pattern.id))
        setMessage("Pattern deleted!")
        setTimeout(() => setMessage(""), 3000)
      } else {
        const data = await response.json()
        setMessage(data.error || "Failed to delete pattern")
      }
    } catch (error) {
      console.error("Failed to delete pattern:", error)
      setMessage("Failed to delete pattern")
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

  // Shift type functions
  function openAddShiftType() {
    setEditingShiftType(null)
    setShiftTypeForm(initialShiftTypeForm)
    setShiftTypeModalOpen(true)
  }

  function openEditShiftType(shiftType: ShiftTypeConfig) {
    setEditingShiftType(shiftType)
    setShiftTypeForm({
      code: shiftType.code,
      name: shiftType.name,
      abbreviation: shiftType.abbreviation,
      category: shiftType.category,
      bgColor: shiftType.bgColor,
      textColor: shiftType.textColor,
      sortOrder: shiftType.sortOrder,
    })
    setShiftTypeModalOpen(true)
  }

  async function saveShiftType() {
    if (!shiftTypeForm.code || !shiftTypeForm.name || !shiftTypeForm.abbreviation) {
      setMessage("Code, name, and abbreviation are required")
      return
    }

    setSavingShiftType(true)
    setMessage("")

    try {
      const url = editingShiftType
        ? `/api/shift-types/${editingShiftType.id}`
        : "/api/shift-types"
      const method = editingShiftType ? "PATCH" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(shiftTypeForm),
      })

      const data = await response.json()

      if (response.ok) {
        // Refresh shift types
        const shiftTypesRes = await fetch("/api/shift-types")
        const shiftTypesData = await shiftTypesRes.json()
        if (shiftTypesData.success) setShiftTypes(shiftTypesData.data)

        setMessage(editingShiftType ? "Shift type updated!" : "Shift type created!")
        setShiftTypeModalOpen(false)
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

  async function deleteShiftType(shiftType: ShiftTypeConfig) {
    const action = shiftType.isSystem ? "disable" : "delete"
    if (!confirm(`${shiftType.isSystem ? "Disable" : "Delete"} shift type "${shiftType.name}"?`)) return

    try {
      const response = await fetch(`/api/shift-types/${shiftType.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        // Refresh shift types
        const shiftTypesRes = await fetch("/api/shift-types")
        const shiftTypesData = await shiftTypesRes.json()
        if (shiftTypesData.success) setShiftTypes(shiftTypesData.data)

        setMessage(`Shift type ${action}d!`)
        setTimeout(() => setMessage(""), 3000)
      } else {
        const data = await response.json()
        setMessage(data.error || `Failed to ${action} shift type`)
      }
    } catch (error) {
      console.error(`Failed to ${action} shift type:`, error)
      setMessage(`Failed to ${action} shift type`)
    }
  }

  async function toggleShiftTypeActive(shiftType: ShiftTypeConfig) {
    try {
      const response = await fetch(`/api/shift-types/${shiftType.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !shiftType.isActive }),
      })

      if (response.ok) {
        setShiftTypes(shiftTypes.map((st) =>
          st.id === shiftType.id ? { ...st, isActive: !st.isActive } : st
        ))
        setMessage(`Shift type ${shiftType.isActive ? "disabled" : "enabled"}!`)
        setTimeout(() => setMessage(""), 3000)
      }
    } catch (error) {
      console.error("Failed to toggle shift type:", error)
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
          settings: {
            ...organization.settings,
            roleColors,
          },
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
                    className={cn(
                      "flex items-center justify-between p-3 rounded border",
                      pattern.isDefault && "border-primary bg-primary/5"
                    )}
                  >
                    <div>
                      <p className="font-medium">{pattern.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {pattern.daysOn} on / {pattern.daysOff} off
                        {pattern.includesNights && " • Day/Night"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {pattern.isDefault ? (
                        <Badge variant="secondary" className="mr-1">
                          <Star className="h-3 w-3 mr-1 fill-current" />
                          Default
                        </Badge>
                      ) : isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDefaultPattern(pattern.id)}
                          title="Set as default"
                        >
                          <Star className="h-4 w-4 mr-1" />
                          Set Default
                        </Button>
                      )}
                      {isAdmin && !pattern.isDefault && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deletePattern(pattern)}
                          title="Delete pattern"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
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

        {/* Shift Types Management */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Shift Types
                </CardTitle>
                <CardDescription>Configure shift types and their appearance</CardDescription>
              </div>
              {isAdmin && (
                <Button size="sm" onClick={openAddShiftType}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Shift Type
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {shiftTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Loading shift types...
              </p>
            ) : (
              <div className="space-y-6">
                {["Working", "Absence", "Other"].map((category) => {
                  const categoryTypes = shiftTypes.filter((st) => st.category === category)
                  if (categoryTypes.length === 0) return null
                  return (
                    <div key={category}>
                      <h4 className="font-semibold text-sm text-muted-foreground mb-2">{category}</h4>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {categoryTypes
                          .sort((a, b) => a.sortOrder - b.sortOrder)
                          .map((shiftType) => (
                            <div
                              key={shiftType.id}
                              className={cn(
                                "flex items-center justify-between p-3 rounded border",
                                !shiftType.isActive && "opacity-50"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className={cn(
                                    "w-8 h-8 rounded flex items-center justify-center text-xs font-bold",
                                    shiftType.bgColor,
                                    shiftType.textColor
                                  )}
                                >
                                  {shiftType.abbreviation}
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{shiftType.name}</p>
                                  <p className="text-xs text-muted-foreground">{shiftType.code}</p>
                                </div>
                              </div>
                              {isAdmin && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => toggleShiftTypeActive(shiftType)}
                                    title={shiftType.isActive ? "Disable" : "Enable"}
                                  >
                                    {shiftType.isActive ? (
                                      <Eye className="h-4 w-4" />
                                    ) : (
                                      <EyeOff className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditShiftType(shiftType)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  {!shiftType.isSystem && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => deleteShiftType(shiftType)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Role Colors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Role Colors
            </CardTitle>
            <CardDescription>Customize colors for worker roles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(["ADMIN", "SUPERVISOR", "WORKER"] as const).map((role) => (
                <div key={role} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold",
                        roleColors[role]
                      )}
                    >
                      {role.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium">{ROLE_LABELS[role]}</p>
                      <p className="text-xs text-muted-foreground">
                        {role === "ADMIN" && "Full system access"}
                        {role === "SUPERVISOR" && "Team management access"}
                        {role === "WORKER" && "Basic access"}
                      </p>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      {editingRole === role ? (
                        <div className="flex items-center gap-2">
                          <div className="grid grid-cols-7 gap-1">
                            {COLOR_OPTIONS.map((color) => (
                              <button
                                key={color.value}
                                type="button"
                                onClick={() => {
                                  setRoleColors({ ...roleColors, [role]: color.value })
                                  setEditingRole(null)
                                }}
                                className={cn(
                                  "w-6 h-6 rounded border transition-all",
                                  color.preview,
                                  roleColors[role] === color.value
                                    ? "border-foreground scale-110"
                                    : "border-transparent hover:scale-105"
                                )}
                                title={color.label}
                              />
                            ))}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingRole(null)}
                          >
                            Done
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingRole(role)}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Change Color
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Click &quot;Save Settings&quot; to apply color changes.
            </p>
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

      {/* Shift Type Modal */}
      <Modal
        isOpen={shiftTypeModalOpen}
        onClose={() => setShiftTypeModalOpen(false)}
        title={editingShiftType ? "Edit Shift Type" : "Add Shift Type"}
        description="Configure shift type details and appearance"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stCode">Code *</Label>
              <Input
                id="stCode"
                value={shiftTypeForm.code}
                onChange={(e) => setShiftTypeForm({ ...shiftTypeForm, code: e.target.value.toUpperCase() })}
                placeholder="e.g., CUSTOM_1"
                disabled={!!editingShiftType}
              />
              <p className="text-xs text-muted-foreground">Unique identifier (cannot be changed)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stAbbrev">Abbreviation *</Label>
              <Input
                id="stAbbrev"
                value={shiftTypeForm.abbreviation}
                onChange={(e) => setShiftTypeForm({ ...shiftTypeForm, abbreviation: e.target.value })}
                placeholder="e.g., C1"
                maxLength={3}
              />
              <p className="text-xs text-muted-foreground">Shown in calendar cells</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stName">Display Name *</Label>
            <Input
              id="stName"
              value={shiftTypeForm.name}
              onChange={(e) => setShiftTypeForm({ ...shiftTypeForm, name: e.target.value })}
              placeholder="e.g., Custom Shift 1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stCategory">Category</Label>
            <Select
              value={shiftTypeForm.category}
              onChange={(e) => setShiftTypeForm({ ...shiftTypeForm, category: e.target.value })}
              options={SHIFT_TYPE_CATEGORY_OPTIONS}
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="grid grid-cols-7 gap-2">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setShiftTypeForm({ ...shiftTypeForm, bgColor: color.value })}
                  className={cn(
                    "w-8 h-8 rounded border-2 transition-all",
                    color.preview,
                    shiftTypeForm.bgColor === color.value
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105"
                  )}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-8 h-8 rounded flex items-center justify-center text-xs font-bold",
                  shiftTypeForm.bgColor,
                  shiftTypeForm.textColor
                )}
              >
                {shiftTypeForm.abbreviation || "?"}
              </div>
              <span className="text-sm">{shiftTypeForm.name || "Shift Name"}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stSort">Sort Order</Label>
            <Input
              id="stSort"
              type="number"
              value={shiftTypeForm.sortOrder}
              onChange={(e) => setShiftTypeForm({ ...shiftTypeForm, sortOrder: parseInt(e.target.value) || 0 })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShiftTypeModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveShiftType} disabled={savingShiftType}>
              {savingShiftType ? "Saving..." : editingShiftType ? "Update Shift Type" : "Create Shift Type"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
