"use client"

import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { formatDateOnly } from "@/lib/dates"
import { useEffect, useState, useCallback } from "react"
import { useSession, signOut } from "next-auth/react"
import { useTheme } from "next-themes"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Modal } from "@/components/ui/modal"
import { Select } from "@/components/ui/select"
import {
  Building2,
  Calendar,
  Bell,
  Shield,
  Clock,
  Save,
  Plus,
  Trash2,
  Download,
  Moon,
  Sun,
  Key,
  UserPlus,
  CalendarDays,
  Users,
  AlertTriangle,
  FileText,
  Loader2,
  Pencil,
  X,
} from "lucide-react"
import { RotationPatternsCard } from "./components/rotation-patterns-card"
import { CustomShiftTypesCard, DEFAULT_SHIFT_COLORS } from "./components/custom-shift-types-card"

interface Organization {
  id: string
  name: string
  slug: string
  settings: {
    timezone?: string
    weekStartsOn?: number
    dateFormat?: string
    minStaffingAlertEnabled?: boolean
    emailNotificationsEnabled?: boolean
    smsNotificationsEnabled?: boolean
    minStaffingPerCrew?: number
    minStaffOperators?: number
    minStaffOnshoreControlRoom?: number
    shiftColors?: Record<string, { bg: string; text: string }>
    autoCheckoutEnabled?: boolean
    autoCheckoutHours?: number
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
  alternatesShifts: boolean
  isDefault: boolean
  _count: {
    crews: number
  }
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

interface Holiday {
  id: string
  name: string
  date: string
  isRecurring: boolean
}

const DATE_FORMATS = [
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (US)" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (EU)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (ISO)" },
  { value: "DD-MMM-YYYY", label: "DD-MMM-YYYY" },
]

const TIMEZONES = [
  { value: "America/St_Johns", label: "Newfoundland (NST)" },
  { value: "America/Halifax", label: "Atlantic (AST)" },
  { value: "America/New_York", label: "Eastern (EST)" },
  { value: "America/Chicago", label: "Central (CST)" },
  { value: "America/Denver", label: "Mountain (MST)" },
  { value: "America/Los_Angeles", label: "Pacific (PST)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
]

// ─── Staffing Rules Manager ──────────────────────────────────────────

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

function StaffingRulesManager({ isAdmin }: { isAdmin: boolean }) {
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

export default function SettingsPage() {
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [patterns, setPatterns] = useState<RotationPattern[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Custom shift type state
  const [customShiftTypes, setCustomShiftTypes] = useState<CustomShiftType[]>([])

  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [changingPassword, setChangingPassword] = useState(false)

  // Holiday state
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [showHolidayForm, setShowHolidayForm] = useState(false)
  const [newHoliday, setNewHoliday] = useState({ name: "", date: "", recurring: true })
  const [savingHoliday, setSavingHoliday] = useState(false)

  // User invite state
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: "", name: "", role: "WORKER", password: "" })
  const [sendingInvite, setSendingInvite] = useState(false)

  // Export state
  const [exporting, setExporting] = useState(false)

  // Shift colors state
  const [shiftColors, setShiftColors] = useState(DEFAULT_SHIFT_COLORS)

  const isAdmin = session?.user?.role === "ADMIN"

  const fetchData = useCallback(async () => {
    try {
      const [orgRes, patternsRes, shiftTypesRes, holidaysRes] = await Promise.all([
        fetch("/api/organization"),
        fetch("/api/rotation-patterns"),
        fetch("/api/custom-shift-types"),
        fetch("/api/holidays"),
      ])

      const orgData = await orgRes.json()
      const patternsData = await patternsRes.json()
      const shiftTypesData = await shiftTypesRes.json()
      const holidaysData = await holidaysRes.json()

      if (orgData.success) {
        setOrganization(orgData.data)
        if (orgData.data.settings?.shiftColors) {
          setShiftColors({ ...DEFAULT_SHIFT_COLORS, ...orgData.data.settings.shiftColors })
        }
      }
      if (patternsData.success) setPatterns(patternsData.data)
      if (shiftTypesData.success) setCustomShiftTypes(shiftTypesData.data)
      if (holidaysData.success) setHolidays(holidaysData.data)
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const toast = useToast()
  const confirmDialog = useConfirm()

  /**
   * Feedback for the user. Kind is explicit at every call site; the old
   * implementation guessed from whether the text contained "success", which
   * painted "Holiday added" red.
   */
  const showMessage = (msg: string, kind: "success" | "error" = "error") => {
    if (kind === "success") toast.success(msg)
    else toast.error(msg)
  }

  // Toggle functions
  const toggleSetting = async (key: string, value: boolean) => {
    if (!organization || !isAdmin) return

    const newSettings = { ...organization.settings, [key]: value }
    setOrganization({ ...organization, settings: newSettings })

    try {
      const response = await fetch("/api/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: newSettings }),
      })

      const data = await response.json()
      if (!data.success) {
        // Revert on failure
        setOrganization({ ...organization, settings: { ...organization.settings, [key]: !value } })
        showMessage("Failed to update setting")
      }
    } catch {
      setOrganization({ ...organization, settings: { ...organization.settings, [key]: !value } })
      showMessage("Failed to update setting")
    }
  }

  // Password change handler
  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showMessage("Passwords do not match")
      return
    }
    if (passwordForm.newPassword.length < 8) {
      showMessage("Password must be at least 8 characters")
      return
    }

    setChangingPassword(true)

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      })

      const data = await response.json()

      if (data.success) {
        showMessage("Password changed successfully", "success")
        setShowPasswordModal(false)
        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
      } else {
        showMessage(data.error || "Failed to change password")
      }
    } catch {
      showMessage("Failed to change password")
    } finally {
      setChangingPassword(false)
    }
  }

  // Holiday handlers
  const handleSaveHoliday = async () => {
    if (!newHoliday.name.trim() || !newHoliday.date) {
      showMessage("Name and date are required")
      return
    }

    setSavingHoliday(true)

    try {
      const response = await fetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newHoliday),
      })

      const data = await response.json()

      if (data.success) {
        setHolidays([...holidays, data.data])
        setNewHoliday({ name: "", date: "", recurring: true })
        setShowHolidayForm(false)
        showMessage("Holiday added", "success")
      } else {
        showMessage(data.error || "Failed to add holiday")
      }
    } catch {
      showMessage("Failed to add holiday")
    } finally {
      setSavingHoliday(false)
    }
  }

  const handleDeleteHoliday = async (holidayId: string) => {
    try {
      const response = await fetch(`/api/holidays/${holidayId}`, { method: "DELETE" })
      const data = await response.json()

      if (data.success) {
        setHolidays(holidays.filter(h => h.id !== holidayId))
        showMessage("Holiday deleted", "success")
      }
    } catch {
      showMessage("Failed to delete holiday")
    }
  }

  // User invite handler
  const handleSendInvite = async () => {
    if (!inviteForm.email.trim() || !inviteForm.name.trim()) {
      showMessage("Email and name are required")
      return
    }

    if (!inviteForm.password || inviteForm.password.length < 8) {
      showMessage("Password must be at least 8 characters")
      return
    }

    setSendingInvite(true)

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteForm.email,
          name: inviteForm.name,
          role: inviteForm.role,
          password: inviteForm.password,
          status: "ACTIVE",
        }),
      })

      const data = await response.json()

      if (data.success) {
        showMessage(`User ${inviteForm.name} created successfully. They can now log in with their email and password.`, "success")
        setShowInviteModal(false)
        setInviteForm({ email: "", name: "", role: "WORKER", password: "" })
      } else {
        showMessage(data.error || "Failed to create user")
      }
    } catch {
      showMessage("Failed to create user")
    } finally {
      setSendingInvite(false)
    }
  }

  // Export handler
  const handleExport = async (type: "schedules" | "workers" | "all") => {
    setExporting(true)

    try {
      const response = await fetch(`/api/export?type=${type}`)
      const blob = await response.blob()

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `schedule-export-${type}-${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()

      showMessage("Export downloaded successfully", "success")
    } catch {
      showMessage("Failed to export data")
    } finally {
      setExporting(false)
    }
  }

  // Save organization settings
  const handleSave = async () => {
    if (!organization) return

    setSaving(true)

    try {
      const response = await fetch("/api/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: organization.name,
          settings: { ...organization.settings, shiftColors },
        }),
      })

      const data = await response.json()

      if (data.success) {
        showMessage("Settings saved successfully", "success")
      } else {
        showMessage(data.error || "Failed to save settings")
      }
    } catch {
      showMessage("Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  // Delete account handler
  const handleDeleteAccount = async () => {
    const ok = await confirmDialog({
      title: "Delete your account?",
      description: "This permanently deletes your account and cannot be undone.",
      confirmLabel: "Delete account",
      destructive: true,
      typeToConfirm: "DELETE",
    })
    if (!ok) return

    try {
      const response = await fetch("/api/auth/delete-account", { method: "DELETE" })
      const data = await response.json()

      if (data.success) {
        await signOut({ callbackUrl: "/" })
      } else {
        showMessage(data.error || "Failed to delete account")
      }
    } catch {
      showMessage("Failed to delete account")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Manage your organization settings and preferences
          </p>
        </div>
        {isAdmin && (
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save All"}
          </Button>
        )}
      </div>

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

            {isAdmin && (
              <Button variant="outline" className="w-full" onClick={() => setShowInviteModal(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite User
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Schedule & Display Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Schedule & Display
            </CardTitle>
            <CardDescription>Configure scheduling preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                id="timezone"
                name="timezone"
                value={organization?.settings?.timezone || "America/St_Johns"}
                onChange={(e) =>
                  setOrganization((prev) =>
                    prev ? { ...prev, settings: { ...prev.settings, timezone: e.target.value } } : null
                  )
                }
                options={TIMEZONES.map(tz => ({ value: tz.value, label: tz.label }))}
                disabled={!isAdmin}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateFormat">Date Format</Label>
              <Select
                id="dateFormat"
                name="dateFormat"
                value={organization?.settings?.dateFormat || "MM/DD/YYYY"}
                onChange={(e) =>
                  setOrganization((prev) =>
                    prev ? { ...prev, settings: { ...prev.settings, dateFormat: e.target.value } } : null
                  )
                }
                options={DATE_FORMATS.map(f => ({ value: f.value, label: f.label }))}
                disabled={!isAdmin}
              />
            </div>

            <div className="space-y-2">
              <Label>Week Starts On</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={organization?.settings?.weekStartsOn === 0 ? "default" : "outline"}
                  onClick={() => {
                    if (isAdmin) {
                      setOrganization((prev) =>
                        prev ? { ...prev, settings: { ...prev.settings, weekStartsOn: 0 } } : null
                      )
                    }
                  }}
                  disabled={!isAdmin}
                >
                  Sunday
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={organization?.settings?.weekStartsOn === 1 ? "default" : "outline"}
                  onClick={() => {
                    if (isAdmin) {
                      setOrganization((prev) =>
                        prev ? { ...prev, settings: { ...prev.settings, weekStartsOn: 1 } } : null
                      )
                    }
                  }}
                  disabled={!isAdmin}
                >
                  Monday
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Theme</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={theme === "light" ? "default" : "outline"}
                  onClick={() => setTheme("light")}
                >
                  <Sun className="h-4 w-4 mr-1" />
                  Light
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={theme === "dark" ? "default" : "outline"}
                  onClick={() => setTheme("dark")}
                >
                  <Moon className="h-4 w-4 mr-1" />
                  Dark
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={theme === "system" ? "default" : "outline"}
                  onClick={() => setTheme("system")}
                >
                  System
                </Button>
              </div>
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
                <p className="text-xs text-muted-foreground">Receive updates via email</p>
              </div>
              <Switch
                label="Email notifications"
                checked={!!organization?.settings?.emailNotificationsEnabled}
                onCheckedChange={(v) => toggleSetting("emailNotificationsEnabled", v)}
                disabled={!isAdmin}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">SMS Notifications</p>
                <p className="text-xs text-muted-foreground">Receive urgent updates via SMS</p>
              </div>
              <Switch
                label="SMS notifications"
                checked={!!organization?.settings?.smsNotificationsEnabled}
                onCheckedChange={(v) => toggleSetting("smsNotificationsEnabled", v)}
                disabled={!isAdmin}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Minimum Staffing Alerts</p>
                <p className="text-xs text-muted-foreground">Get notified when staffing drops below minimum</p>
              </div>
              <Switch
                label="Minimum staffing alerts"
                checked={!!organization?.settings?.minStaffingAlertEnabled}
                onCheckedChange={(v) => toggleSetting("minStaffingAlertEnabled", v)}
                disabled={!isAdmin}
              />
            </div>

            {organization?.settings?.minStaffingAlertEnabled && (
              <StaffingRulesManager isAdmin={isAdmin} />
            )}
          </CardContent>
        </Card>

        {/* Auto-Checkout */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Auto-Checkout
            </CardTitle>
            <CardDescription>Automatically check out workers after their shift ends</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Enable Auto-Checkout</p>
                <p className="text-xs text-muted-foreground">Workers will be checked out after the configured shift duration</p>
              </div>
              <Switch
                label="Auto check-out"
                checked={!!organization?.settings?.autoCheckoutEnabled}
                onCheckedChange={(v) => toggleSetting("autoCheckoutEnabled", v)}
                disabled={!isAdmin}
              />
            </div>

            {organization?.settings?.autoCheckoutEnabled && (
              <div className="space-y-2 pt-2 border-t">
                <Label>Shift Duration</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={organization?.settings?.autoCheckoutHours === 8 ? "default" : "outline"}
                    onClick={() => {
                      if (isAdmin) {
                        setOrganization((prev) =>
                          prev ? { ...prev, settings: { ...prev.settings, autoCheckoutHours: 8 } } : null
                        )
                      }
                    }}
                    disabled={!isAdmin}
                  >
                    8 Hours
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={organization?.settings?.autoCheckoutHours === 12 ? "default" : "outline"}
                    onClick={() => {
                      if (isAdmin) {
                        setOrganization((prev) =>
                          prev ? { ...prev, settings: { ...prev.settings, autoCheckoutHours: 12 } } : null
                        )
                      }
                    }}
                    disabled={!isAdmin}
                  >
                    12 Hours
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Workers will be automatically checked out {organization?.settings?.autoCheckoutHours || 8} hours after check-in
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Export */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Data Export
            </CardTitle>
            <CardDescription>Export your data to CSV files</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleExport("schedules")}
              disabled={exporting}
            >
              <FileText className="h-4 w-4 mr-2" />
              Export Schedules
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleExport("workers")}
              disabled={exporting}
            >
              <Users className="h-4 w-4 mr-2" />
              Export Workers
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleExport("all")}
              disabled={exporting}
            >
              <Download className="h-4 w-4 mr-2" />
              Export All Data
            </Button>
            {exporting && (
              <p className="text-sm text-muted-foreground text-center">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Preparing export...
              </p>
            )}
          </CardContent>
        </Card>

        {/* Holidays */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  Holidays
                </CardTitle>
                <CardDescription>Company holidays and special days</CardDescription>
              </div>
              {isAdmin && !showHolidayForm && (
                <Button size="sm" onClick={() => setShowHolidayForm(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {showHolidayForm && (
              <div className="mb-4 p-3 border rounded-lg bg-muted/50 space-y-3">
                <Input
                  id="holiday-name"
                  name="holiday-name"
                  placeholder="Holiday name"
                  value={newHoliday.name}
                  onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                />
                <Input
                  id="holiday-date"
                  name="holiday-date"
                  type="date"
                  value={newHoliday.date}
                  onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                />
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="recurring"
                    checked={newHoliday.recurring}
                    onChange={(e) => setNewHoliday({ ...newHoliday, recurring: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="recurring" className="text-sm">Recurring yearly</Label>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveHoliday} disabled={savingHoliday}>
                    {savingHoliday ? "Saving..." : "Save"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowHolidayForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {holidays.map((holiday) => (
                <div key={holiday.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <p className="font-medium text-sm">{holiday.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateOnly(holiday.date, "short")}
                      {holiday.isRecurring && " (yearly)"}
                    </p>
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteHoliday(holiday.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              {holidays.length === 0 && (
                <p className="text-center text-muted-foreground py-4 text-sm">No holidays configured</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Rotation Patterns */}
        <RotationPatternsCard
          patterns={patterns}
          isAdmin={isAdmin}
          onRefresh={fetchData}
          onMessage={(msg, kind) => showMessage(msg, kind ?? (/fail|required|invalid|error/i.test(msg) ? "error" : "success"))}
        />

        {/* Custom Shift Types */}
        <CustomShiftTypesCard
          customShiftTypes={customShiftTypes}
          shiftColors={shiftColors}
          isAdmin={isAdmin}
          onRefresh={fetchData}
          onMessage={(msg, kind) => showMessage(msg, kind ?? (/fail|required|invalid|error/i.test(msg) ? "error" : "success"))}
          onShiftColorsChange={setShiftColors}
        />

        {/* Your Account */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Your Account
            </CardTitle>
            <CardDescription>Manage your personal account settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-4 gap-4">
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
              <div>
                <Label className="text-muted-foreground text-xs">Organization</Label>
                <p className="font-medium">{organization?.name}</p>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowPasswordModal(true)}>
                <Key className="h-4 w-4 mr-2" />
                Change Password
              </Button>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={handleDeleteAccount}
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Password Change Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false)
          setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
        }}
        title="Change Password"
        description="Enter your current password and choose a new one"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowPasswordModal(false)}>Cancel</Button>
            <Button onClick={handlePasswordChange} disabled={changingPassword}>
              {changingPassword ? "Changing..." : "Change Password"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* User Invite Modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => {
          setShowInviteModal(false)
          setInviteForm({ email: "", name: "", role: "WORKER", password: "" })
        }}
        title="Add New User"
        description="Create a new user account for your organization"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inviteName">Name</Label>
            <Input
              id="inviteName"
              value={inviteForm.name}
              onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
              placeholder="John Doe"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inviteEmail">Email</Label>
            <Input
              id="inviteEmail"
              type="email"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              placeholder="john@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invitePassword">Temporary Password</Label>
            <Input
              id="invitePassword"
              type="password"
              value={inviteForm.password}
              onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
              placeholder="Min 8 characters"
            />
            <p className="text-xs text-muted-foreground">Share this password with the user so they can log in</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inviteRole">Role</Label>
            <Select
              value={inviteForm.role}
              onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
              options={[
                { value: "WORKER", label: "Worker - Can view schedule and request time off" },
                { value: "SUPERVISOR", label: "Supervisor - Can manage crews and schedules" },
                { value: "ADMIN", label: "Admin - Full access to all features" },
              ]}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowInviteModal(false)}>Cancel</Button>
            <Button onClick={handleSendInvite} disabled={sendingInvite}>
              {sendingInvite ? "Creating..." : "Create User"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
