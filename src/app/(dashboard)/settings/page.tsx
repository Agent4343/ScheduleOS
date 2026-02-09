"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession, signOut } from "next-auth/react"
import { useTheme } from "next-themes"
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
  Plus,
  Pencil,
  Trash2,
  X,
  Palette,
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
  Award,
  CreditCard,
  Zap,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  RotateCcw,
} from "lucide-react"
import { useOnboarding } from "@/contexts/onboarding-context"

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

interface Holiday {
  id: string
  name: string
  date: string
  isRecurring: boolean
}

interface CustomRole {
  id: string
  name: string
  description: string | null
  color: string
  baseRole: "ADMIN" | "SUPERVISOR" | "WORKER"
  isActive: boolean
  _count: { users: number }
}

interface CertificationType {
  id: string
  name: string
  description: string | null
  color: string
  isRequired: boolean
  isActive: boolean
  requireOnSchedule: boolean
  minPerDayShift: number
  minPerNightShift: number
  expiryWarningDays: number
  _count: { userCertifications: number }
}

interface SubscriptionData {
  tier: string
  status: string
  tierName: string
  price: number
  workerLimit: number
  workerCount: number
  workersRemaining: number
  trialEndsAt: string | null
  trialDaysRemaining: number | null
  subscriptionEndsAt: string | null
  features: string[]
  canAddWorkers: boolean
  isAtLimit: boolean
  isTrialExpired: boolean
}

const DEFAULT_SHIFT_COLORS = {
  DAY: { bg: "#22c55e", text: "#ffffff" },
  NIGHT: { bg: "#3b82f6", text: "#ffffff" },
  OFF: { bg: "#6b7280", text: "#ffffff" },
  LEAVE: { bg: "#f59e0b", text: "#ffffff" },
  VACATION: { bg: "#8b5cf6", text: "#ffffff" },
  SICK: { bg: "#ef4444", text: "#ffffff" },
  TRAINING: { bg: "#06b6d4", text: "#ffffff" },
  SHUTDOWN: { bg: "#78716c", text: "#ffffff" },
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
    if (!confirm("Delete this staffing rule?")) return

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
                    {rule.shiftType === "DAY" ? "☀️ Day" : "🌙 Night"}
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
                    className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors touch-action-manipulation ${
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

// ─── Help & Onboarding ──────────────────────────────────────────────

function HelpOnboardingCard() {
  const { state, startTour, refreshOnboarding } = useOnboarding()
  const [resetting, setResetting] = useState(false)

  const handleRestartTour = () => {
    startTour()
  }

  const handleResetOnboarding = async () => {
    setResetting(true)
    try {
      await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hasSeenWelcome: false,
          hasCompletedTour: false,
        }),
      })
      await refreshOnboarding()
      window.location.reload()
    } catch (error) {
      console.error("Failed to reset onboarding:", error)
    } finally {
      setResetting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5" />
          Help & Onboarding
        </CardTitle>
        <CardDescription>Get help with using ShiftSync</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">Guided Tour</p>
            <p className="text-xs text-muted-foreground">
              Take a walkthrough of all the features
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRestartTour}
          >
            <Sparkles className="h-4 w-4 mr-1" />
            Start Tour
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">Reset Onboarding</p>
            <p className="text-xs text-muted-foreground">
              Show welcome message and tour again
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetOnboarding}
            disabled={resetting}
          >
            <RotateCcw className={`h-4 w-4 mr-1 ${resetting ? "animate-spin" : ""}`} />
            Reset
          </Button>
        </div>

        {state && !state.isOnboardingComplete && (
          <div className="pt-3 border-t">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Setup Progress</span>
              <span className="font-medium">
                {state.completedSteps} of {state.totalSteps} complete
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(state.completedSteps / state.totalSteps) * 100}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
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
    alternatesShifts: false,
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

  // Custom roles state
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([])
  const [showRoleForm, setShowRoleForm] = useState(false)
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null)
  const [savingRole, setSavingRole] = useState(false)
  const [newRole, setNewRole] = useState<{ name: string; description: string; color: string; baseRole: "ADMIN" | "SUPERVISOR" | "WORKER" }>({ name: "", description: "", color: "#6b7280", baseRole: "WORKER" })

  // Certifications state
  const [certifications, setCertifications] = useState<CertificationType[]>([])
  const [showCertForm, setShowCertForm] = useState(false)
  const [editingCert, setEditingCert] = useState<CertificationType | null>(null)
  const [savingCert, setSavingCert] = useState(false)
  const [newCert, setNewCert] = useState<{
    name: string
    description: string
    color: string
    isRequired: boolean
    requireOnSchedule: boolean
    minPerDayShift: number
    minPerNightShift: number
    expiryWarningDays: number
  }>({
    name: "",
    description: "",
    color: "#3B82F6",
    isRequired: false,
    requireOnSchedule: false,
    minPerDayShift: 1,
    minPerNightShift: 1,
    expiryWarningDays: 180,
  })

  // Subscription state
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)

  // User invite state
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: "", name: "", role: "WORKER" })
  const [sendingInvite, setSendingInvite] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)

  // Export state
  const [exporting, setExporting] = useState(false)
  const [exportingPersonalData, setExportingPersonalData] = useState(false)

  // Shift colors state
  const [shiftColors, setShiftColors] = useState(DEFAULT_SHIFT_COLORS)
  const [showColorEditor, setShowColorEditor] = useState(false)

  const isAdmin = session?.user?.role === "ADMIN"

  const fetchData = useCallback(async () => {
    try {
      const [orgRes, patternsRes, shiftTypesRes, holidaysRes, rolesRes, certsRes, subRes] = await Promise.all([
        fetch("/api/organization"),
        fetch("/api/rotation-patterns"),
        fetch("/api/custom-shift-types"),
        fetch("/api/holidays"),
        fetch("/api/roles"),
        fetch("/api/certifications"),
        fetch("/api/subscription"),
      ])

      const orgData = await orgRes.json()
      const patternsData = await patternsRes.json()
      const shiftTypesData = await shiftTypesRes.json()
      const holidaysData = await holidaysRes.json()
      const rolesData = await rolesRes.json()
      const certsData = await certsRes.json()
      const subData = await subRes.json()

      if (orgData.success) {
        setOrganization(orgData.data)
        if (orgData.data.settings?.shiftColors) {
          setShiftColors({ ...DEFAULT_SHIFT_COLORS, ...orgData.data.settings.shiftColors })
        }
      }
      if (patternsData.success) setPatterns(patternsData.data)
      if (shiftTypesData.success) setCustomShiftTypes(shiftTypesData.data)
      if (holidaysData.success) setHolidays(holidaysData.data)
      if (rolesData.success) setCustomRoles(rolesData.data)
      if (certsData.success) setCertifications(certsData.data)
      if (subData.success) setSubscription(subData.data)
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const showMessage = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(""), 3000)
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

  // Pattern handlers
  const resetPatternForm = () => {
    setNewPattern({
      name: "",
      description: "",
      daysOn: 14,
      daysOff: 14,
      includesNights: false,
      nightDays: 0,
      nightsAtStart: true,
      alternatesShifts: false,
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
      alternatesShifts: pattern.alternatesShifts,
    })
    setShowPatternForm(true)
  }

  const handleSavePattern = async () => {
    if (!newPattern.name.trim()) {
      showMessage("Pattern name is required")
      return
    }

    setSavingPattern(true)

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
        const patternsRes = await fetch("/api/rotation-patterns")
        const patternsData = await patternsRes.json()
        if (patternsData.success) setPatterns(patternsData.data)

        showMessage(editingPattern ? "Pattern updated successfully" : "Pattern created successfully")
        resetPatternForm()
      } else {
        showMessage(data.error || "Failed to save pattern")
      }
    } catch {
      showMessage("Failed to save pattern")
    } finally {
      setSavingPattern(false)
    }
  }

  const handleDeletePattern = async (patternId: string) => {
    if (!confirm("Are you sure you want to delete this pattern?")) return

    try {
      const response = await fetch(`/api/rotation-patterns?id=${patternId}`, { method: "DELETE" })
      const data = await response.json()

      if (data.success) {
        setPatterns(patterns.filter(p => p.id !== patternId))
        showMessage("Pattern deleted successfully")
      } else {
        showMessage(data.error || "Failed to delete pattern")
      }
    } catch {
      showMessage("Failed to delete pattern")
    }
  }

  // Custom shift type handlers
  const resetShiftTypeForm = () => {
    setNewShiftType({ code: "", name: "", color: "#6b7280", textColor: "#ffffff", description: "" })
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
      showMessage("Code and name are required")
      return
    }

    setSavingShiftType(true)

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
        const shiftTypesRes = await fetch("/api/custom-shift-types")
        const shiftTypesData = await shiftTypesRes.json()
        if (shiftTypesData.success) setCustomShiftTypes(shiftTypesData.data)

        showMessage(editingShiftType ? "Shift type updated" : "Shift type created")
        resetShiftTypeForm()
      } else {
        showMessage(data.error || "Failed to save shift type")
      }
    } catch {
      showMessage("Failed to save shift type")
    } finally {
      setSavingShiftType(false)
    }
  }

  const handleDeleteShiftType = async (shiftTypeId: string) => {
    if (!confirm("Delete this shift type?")) return

    try {
      const response = await fetch(`/api/custom-shift-types/${shiftTypeId}`, { method: "DELETE" })
      const data = await response.json()

      if (data.success) {
        setCustomShiftTypes(customShiftTypes.filter(st => st.id !== shiftTypeId))
        showMessage("Shift type deleted")
      } else {
        showMessage(data.error || "Failed to delete")
      }
    } catch {
      showMessage("Failed to delete")
    }
  }

  // Custom role handlers
  const resetRoleForm = () => {
    setNewRole({ name: "", description: "", color: "#6b7280", baseRole: "WORKER" })
    setEditingRole(null)
    setShowRoleForm(false)
  }

  const startEditRole = (role: CustomRole) => {
    setEditingRole(role)
    setNewRole({
      name: role.name,
      description: role.description || "",
      color: role.color,
      baseRole: role.baseRole,
    })
    setShowRoleForm(true)
  }

  const handleSaveRole = async () => {
    if (!newRole.name.trim()) {
      showMessage("Role name is required")
      return
    }

    setSavingRole(true)

    try {
      const url = editingRole
        ? `/api/roles/${editingRole.id}`
        : "/api/roles"

      const response = await fetch(url, {
        method: editingRole ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRole),
      })

      const data = await response.json()

      if (data.success) {
        const rolesRes = await fetch("/api/roles")
        const rolesData = await rolesRes.json()
        if (rolesData.success) setCustomRoles(rolesData.data)

        showMessage(editingRole ? "Role updated successfully" : "Role created successfully")
        resetRoleForm()
      } else {
        // Show error message longer for database issues
        const errorMsg = data.error || "Failed to save role"
        setMessage(errorMsg)
        if (errorMsg.includes("table") || errorMsg.includes("migration") || errorMsg.includes("redeploy")) {
          // Keep error visible longer for database migration issues
          setTimeout(() => setMessage(""), 10000)
        } else {
          setTimeout(() => setMessage(""), 3000)
        }
      }
    } catch (err) {
      console.error("Error saving role:", err)
      showMessage("Failed to save role. Please try again.")
    } finally {
      setSavingRole(false)
    }
  }

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm("Delete this role?")) return

    try {
      const response = await fetch(`/api/roles/${roleId}`, { method: "DELETE" })
      const data = await response.json()

      if (data.success) {
        setCustomRoles(customRoles.filter(r => r.id !== roleId))
        showMessage("Role deleted")
      } else {
        showMessage(data.error || "Failed to delete")
      }
    } catch {
      showMessage("Failed to delete")
    }
  }

  // Certification handlers
  const resetCertForm = () => {
    setNewCert({
      name: "",
      description: "",
      color: "#3B82F6",
      isRequired: false,
      requireOnSchedule: false,
      minPerDayShift: 1,
      minPerNightShift: 1,
      expiryWarningDays: 180,
    })
    setEditingCert(null)
    setShowCertForm(false)
  }

  const startEditCert = (cert: CertificationType) => {
    setEditingCert(cert)
    setNewCert({
      name: cert.name,
      description: cert.description || "",
      color: cert.color,
      isRequired: cert.isRequired,
      requireOnSchedule: cert.requireOnSchedule || false,
      minPerDayShift: cert.minPerDayShift || 1,
      minPerNightShift: cert.minPerNightShift || 1,
      expiryWarningDays: cert.expiryWarningDays || 180,
    })
    setShowCertForm(true)
  }

  const handleSaveCert = async () => {
    if (!newCert.name.trim()) {
      showMessage("Certification name is required")
      return
    }

    setSavingCert(true)

    try {
      const url = editingCert
        ? `/api/certifications/${editingCert.id}`
        : "/api/certifications"

      const response = await fetch(url, {
        method: editingCert ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCert),
      })

      const data = await response.json()

      if (data.success) {
        const certsRes = await fetch("/api/certifications")
        const certsData = await certsRes.json()
        if (certsData.success) setCertifications(certsData.data)

        showMessage(editingCert ? "Certification updated" : "Certification created")
        resetCertForm()
      } else {
        showMessage(data.error || "Failed to save certification")
      }
    } catch {
      showMessage("Failed to save certification")
    } finally {
      setSavingCert(false)
    }
  }

  const handleDeleteCert = async (certId: string) => {
    if (!confirm("Delete this certification? Workers with this certification will have it removed.")) return

    try {
      const response = await fetch(`/api/certifications/${certId}`, { method: "DELETE" })
      const data = await response.json()

      if (data.success) {
        setCertifications(certifications.filter(c => c.id !== certId))
        showMessage("Certification deleted")
      } else {
        showMessage(data.error || "Failed to delete")
      }
    } catch {
      showMessage("Failed to delete")
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
        showMessage("Password changed successfully")
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
        showMessage("Holiday added")
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
        showMessage("Holiday deleted")
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

    setSendingInvite(true)
    setInviteLink(null)

    try {
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteForm.email,
          name: inviteForm.name,
          role: inviteForm.role,
        }),
      })

      const data = await response.json()

      if (data.success) {
        if (data.emailSent) {
          showMessage(`Invitation sent to ${inviteForm.email}. They will receive an email with instructions to set up their account.`)
          setShowInviteModal(false)
          setInviteForm({ email: "", name: "", role: "WORKER" })
        } else {
          // Email wasn't sent, show the invite link
          setInviteLink(data.inviteLink)
          showMessage("Invitation created. Email could not be sent - please share the invite link manually.")
        }
      } else {
        showMessage(data.error || data.message || "Failed to send invitation")
      }
    } catch {
      showMessage("Failed to send invitation")
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

      showMessage("Export downloaded successfully")
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
        showMessage("Settings saved successfully")
      } else {
        showMessage(data.error || "Failed to save settings")
      }
    } catch {
      showMessage("Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  // Personal data export handler (GDPR)
  const handleExportPersonalData = async () => {
    setExportingPersonalData(true)

    try {
      const response = await fetch("/api/user/export-data")
      const blob = await response.blob()

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `my-data-export-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()

      showMessage("Personal data exported successfully")
    } catch {
      showMessage("Failed to export personal data")
    } finally {
      setExportingPersonalData(false)
    }
  }

  // Delete account handler
  const handleDeleteAccount = async () => {
    const confirm1 = confirm("Are you sure you want to delete your account? This cannot be undone.")
    if (!confirm1) return

    const confirm2 = prompt("Type DELETE to confirm account deletion:")
    if (confirm2 !== "DELETE") {
      showMessage("Account deletion cancelled")
      return
    }

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

      {message && (
        <Alert variant={message.includes("success") ? "default" : "destructive"}>
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

            <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-4 border-t">
              <div className="text-center">
                <p className="text-xl sm:text-2xl font-bold">{organization?._count.users || 0}</p>
                <p className="text-xs text-muted-foreground">Workers</p>
              </div>
              <div className="text-center">
                <p className="text-xl sm:text-2xl font-bold">{organization?._count.crews || 0}</p>
                <p className="text-xs text-muted-foreground">Crews</p>
              </div>
              <div className="text-center">
                <p className="text-xl sm:text-2xl font-bold">{organization?._count.rotationPatterns || 0}</p>
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

        {/* Subscription & Billing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscription
            </CardTitle>
            <CardDescription>Manage your plan and billing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {subscription && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{subscription.tierName} Plan</p>
                    <p className="text-sm text-muted-foreground">
                      {subscription.price > 0 ? `$${subscription.price}/month` : "Free Trial"}
                    </p>
                  </div>
                  <Badge variant={
                    subscription.status === "ACTIVE" ? "default" :
                    subscription.status === "TRIALING" ? "secondary" :
                    subscription.isTrialExpired ? "destructive" : "outline"
                  }>
                    {subscription.isTrialExpired ? "Expired" : subscription.status}
                  </Badge>
                </div>

                {subscription.tier === "TRIAL" && subscription.trialDaysRemaining !== null && (
                  <Alert variant={subscription.trialDaysRemaining <= 3 ? "destructive" : "default"}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {subscription.isTrialExpired
                        ? "Your trial has expired. Upgrade to continue using ShiftSync."
                        : `${subscription.trialDaysRemaining} days left in your trial`}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="pt-3 border-t">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Workers</span>
                    <span className={subscription.isAtLimit ? "text-destructive font-medium" : ""}>
                      {subscription.workerCount} / {subscription.workerLimit === 999999 ? "Unlimited" : subscription.workerLimit}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        subscription.isAtLimit ? "bg-destructive" :
                        subscription.workerCount / subscription.workerLimit > 0.8 ? "bg-yellow-500" :
                        "bg-primary"
                      }`}
                      style={{ width: `${Math.min(100, (subscription.workerCount / subscription.workerLimit) * 100)}%` }}
                    />
                  </div>
                  {subscription.workersRemaining > 0 && subscription.workerLimit !== 999999 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {subscription.workersRemaining} slot{subscription.workersRemaining !== 1 ? "s" : ""} remaining
                    </p>
                  )}
                </div>

                <div className="space-y-2 pt-3 border-t">
                  <p className="text-sm font-medium">Plan features:</p>
                  {subscription.features.slice(0, 4).map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      {feature}
                    </div>
                  ))}
                </div>

                {isAdmin && subscription.tier !== "BUSINESS" && (
                  <Button className="w-full" onClick={() => window.open("/pricing", "_blank")}>
                    <Zap className="h-4 w-4 mr-2" />
                    {subscription.tier === "TRIAL" ? "Choose a Plan" : "Upgrade Plan"}
                  </Button>
                )}
              </>
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
              <button
                type="button"
                onClick={() => toggleSetting("emailNotificationsEnabled", !organization?.settings?.emailNotificationsEnabled)}
                disabled={!isAdmin}
                className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors touch-action-manipulation ${
                  organization?.settings?.emailNotificationsEnabled ? "bg-primary" : "bg-muted"
                } ${!isAdmin ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                    organization?.settings?.emailNotificationsEnabled ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">SMS Notifications</p>
                <p className="text-xs text-muted-foreground">Receive urgent updates via SMS</p>
              </div>
              <button
                type="button"
                onClick={() => toggleSetting("smsNotificationsEnabled", !organization?.settings?.smsNotificationsEnabled)}
                disabled={!isAdmin}
                className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors touch-action-manipulation ${
                  organization?.settings?.smsNotificationsEnabled ? "bg-primary" : "bg-muted"
                } ${!isAdmin ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                    organization?.settings?.smsNotificationsEnabled ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Minimum Staffing Alerts</p>
                <p className="text-xs text-muted-foreground">Get notified when staffing drops below minimum</p>
              </div>
              <button
                type="button"
                onClick={() => toggleSetting("minStaffingAlertEnabled", !organization?.settings?.minStaffingAlertEnabled)}
                disabled={!isAdmin}
                className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors touch-action-manipulation ${
                  organization?.settings?.minStaffingAlertEnabled ? "bg-primary" : "bg-muted"
                } ${!isAdmin ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                    organization?.settings?.minStaffingAlertEnabled ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {organization?.settings?.minStaffingAlertEnabled && (
              <StaffingRulesManager isAdmin={isAdmin} />
            )}
          </CardContent>
        </Card>

        {/* Help & Onboarding */}
        <HelpOnboardingCard />

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
                      {new Date(holiday.date).toLocaleDateString()}
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
            {showPatternForm && (
              <div className="mb-4 p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium">{editingPattern ? "Edit Pattern" : "New Pattern"}</h4>
                  <Button variant="ghost" size="sm" onClick={resetPatternForm}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
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
                    <Label htmlFor="patternDesc">Description</Label>
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
                  <div className="sm:col-span-2 space-y-3">
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
                      <div className="ml-6 space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="alternatesShifts"
                            checked={newPattern.alternatesShifts}
                            onChange={(e) => setNewPattern({ ...newPattern, alternatesShifts: e.target.checked })}
                            className="h-4 w-4"
                          />
                          <Label htmlFor="alternatesShifts">Alternates Between Day/Night Rotations</Label>
                        </div>
                        {!newPattern.alternatesShifts && (
                          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
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
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={resetPatternForm}>Cancel</Button>
                  <Button onClick={handleSavePattern} disabled={savingPattern}>
                    {savingPattern ? "Saving..." : editingPattern ? "Update" : "Create"}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {patterns.map((pattern) => (
                <div key={pattern.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded border gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{pattern.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {pattern.daysOn} on / {pattern.daysOff} off
                      {pattern.includesNights && pattern.alternatesShifts && " • alternates"}
                      {pattern.includesNights && !pattern.alternatesShifts && ` • ${pattern.nightDays} nights`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0 flex-wrap">
                    {pattern.isDefault && <Badge variant="secondary">Default</Badge>}
                    <Badge variant="outline">{pattern._count.crews} crews</Badge>
                    {isAdmin && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => startEditPattern(pattern)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePattern(pattern.id)}
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
              <div className="flex gap-2">
                {isAdmin && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setShowColorEditor(!showColorEditor)}>
                      <Palette className="h-4 w-4 mr-1" />
                      Colors
                    </Button>
                    {!showShiftTypeForm && (
                      <Button size="sm" onClick={() => setShowShiftTypeForm(true)}>
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
            {/* Built-in colors editor */}
            {showColorEditor && (
              <div className="mb-4 p-4 border rounded-lg bg-muted/50">
                <h4 className="font-medium mb-3">Built-in Shift Colors</h4>
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
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
                        onChange={(e) => setShiftColors({ ...shiftColors, [type]: { ...colors, bg: e.target.value } })}
                        className="w-8 h-8 rounded cursor-pointer min-h-[44px] min-w-[44px] p-0"
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

            {showShiftTypeForm && (
              <div className="mb-4 p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium">{editingShiftType ? "Edit" : "New"} Shift Type</h4>
                  <Button variant="ghost" size="sm" onClick={resetShiftTypeForm}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="shift-type-code">Code</Label>
                    <Input
                      id="shift-type-code"
                      name="shift-type-code"
                      placeholder="e.g., BRV"
                      value={newShiftType.code}
                      onChange={(e) => setNewShiftType({ ...newShiftType, code: e.target.value.toUpperCase() })}
                      maxLength={10}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shift-type-name">Name</Label>
                    <Input
                      id="shift-type-name"
                      name="shift-type-name"
                      placeholder="e.g., Bereavement"
                      value={newShiftType.name}
                      onChange={(e) => setNewShiftType({ ...newShiftType, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shift-type-bg-color">Background Color</Label>
                    <div className="flex gap-2">
                      <input
                        id="shift-type-bg-color"
                        name="shift-type-bg-color"
                        type="color"
                        value={newShiftType.color}
                        onChange={(e) => setNewShiftType({ ...newShiftType, color: e.target.value })}
                        className="w-10 h-10 rounded cursor-pointer"
                      />
                      <Input
                        id="shift-type-bg-color-hex"
                        name="shift-type-bg-color-hex"
                        value={newShiftType.color}
                        onChange={(e) => setNewShiftType({ ...newShiftType, color: e.target.value })}
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
                        value={newShiftType.textColor}
                        onChange={(e) => setNewShiftType({ ...newShiftType, textColor: e.target.value })}
                        className="w-10 h-10 rounded cursor-pointer"
                      />
                      <Input
                        id="shift-type-text-color-hex"
                        name="shift-type-text-color-hex"
                        value={newShiftType.textColor}
                        onChange={(e) => setNewShiftType({ ...newShiftType, textColor: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Preview</Label>
                    <div className="mt-2">
                      <span
                        className="px-3 py-1 rounded text-sm font-bold"
                        style={{ backgroundColor: newShiftType.color, color: newShiftType.textColor }}
                      >
                        {newShiftType.code || "CODE"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={resetShiftTypeForm}>Cancel</Button>
                  <Button onClick={handleSaveShiftType} disabled={savingShiftType}>
                    {savingShiftType ? "Saving..." : editingShiftType ? "Update" : "Create"}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {customShiftTypes.map((st) => (
                <div key={st.id} className="flex items-center justify-between p-3 rounded border gap-2 min-h-[44px]">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="px-2 py-1 rounded text-xs font-bold shrink-0"
                      style={{ backgroundColor: st.color, color: st.textColor }}
                    >
                      {st.code}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{st.name}</p>
                      {st.description && <p className="text-sm text-muted-foreground truncate">{st.description}</p>}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => startEditShiftType(st)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteShiftType(st.id)}>
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

        {/* Custom Roles */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Custom Roles
                </CardTitle>
                <CardDescription>Create custom roles for your organization</CardDescription>
              </div>
              {isAdmin && !showRoleForm && (
                <Button size="sm" onClick={() => setShowRoleForm(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Role
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>System Roles:</strong> Admin, Supervisor, Worker (control permissions)
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Custom roles are for organizational titles and can be assigned to users alongside system roles.
              </p>
            </div>

            {showRoleForm && (
              <div className="mb-4 p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium">{editingRole ? "Edit" : "New"} Role</h4>
                  <Button variant="ghost" size="sm" onClick={resetRoleForm}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="role-name">Name</Label>
                    <Input
                      id="role-name"
                      placeholder="e.g., Team Lead"
                      value={newRole.name}
                      onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role-base">Base Permission Level</Label>
                    <Select
                      value={newRole.baseRole}
                      onChange={(e) => setNewRole({ ...newRole, baseRole: e.target.value as "ADMIN" | "SUPERVISOR" | "WORKER" })}
                      options={[
                        { value: "WORKER", label: "Worker" },
                        { value: "SUPERVISOR", label: "Supervisor" },
                        { value: "ADMIN", label: "Admin" },
                      ]}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role-color">Color</Label>
                    <div className="flex gap-2">
                      <input
                        id="role-color"
                        type="color"
                        value={newRole.color}
                        onChange={(e) => setNewRole({ ...newRole, color: e.target.value })}
                        className="w-10 h-10 rounded cursor-pointer"
                      />
                      <Input
                        value={newRole.color}
                        onChange={(e) => setNewRole({ ...newRole, color: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role-description">Description</Label>
                    <Input
                      id="role-description"
                      placeholder="Optional description"
                      value={newRole.description}
                      onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={resetRoleForm}>Cancel</Button>
                  <Button onClick={handleSaveRole} disabled={savingRole}>
                    {savingRole ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    {editingRole ? "Update" : "Create"}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {customRoles.map((role) => (
                <div key={role.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: role.color }}
                    />
                    <div>
                      <p className="font-medium">{role.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Base: {role.baseRole} • {role._count.users} user{role._count.users !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => startEditRole(role)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRole(role.id)}
                        disabled={role._count.users > 0}
                        title={role._count.users > 0 ? "Cannot delete: users assigned" : "Delete role"}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {customRoles.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No custom roles</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Training Certifications */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Training & Certifications
                </CardTitle>
                <CardDescription>Define training certifications for your organization</CardDescription>
              </div>
              {isAdmin && !showCertForm && (
                <Button size="sm" onClick={() => setShowCertForm(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Certification
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Create certifications specific to your business (e.g., Forklift Operator, Food Safety, First Aid).
                Workers can be assigned certifications in their profile.
              </p>
            </div>

            {showCertForm && (
              <div className="mb-4 p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium">{editingCert ? "Edit" : "New"} Certification</h4>
                  <Button variant="ghost" size="sm" onClick={resetCertForm}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cert-name">Name</Label>
                    <Input
                      id="cert-name"
                      placeholder="e.g., Forklift Operator"
                      value={newCert.name}
                      onChange={(e) => setNewCert({ ...newCert, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cert-color">Color</Label>
                    <div className="flex gap-2">
                      <input
                        id="cert-color"
                        type="color"
                        value={newCert.color}
                        onChange={(e) => setNewCert({ ...newCert, color: e.target.value })}
                        className="w-10 h-10 rounded cursor-pointer"
                      />
                      <Input
                        value={newCert.color}
                        onChange={(e) => setNewCert({ ...newCert, color: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="cert-description">Description</Label>
                    <Input
                      id="cert-description"
                      placeholder="Optional description"
                      value={newCert.description}
                      onChange={(e) => setNewCert({ ...newCert, description: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newCert.isRequired}
                        onChange={(e) => setNewCert({ ...newCert, isRequired: e.target.checked })}
                        className="h-4 w-4 rounded"
                      />
                      Required for all workers
                    </label>
                  </div>

                  {/* Schedule Staffing Requirements */}
                  <div className="md:col-span-2 pt-3 border-t">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newCert.requireOnSchedule}
                        onChange={(e) => setNewCert({ ...newCert, requireOnSchedule: e.target.checked })}
                        className="h-4 w-4 rounded"
                      />
                      <span className="font-medium">Require on schedule</span>
                    </label>
                    <p className="text-xs text-muted-foreground mt-1 ml-6">
                      Alert if no worker with this certification is scheduled
                    </p>
                  </div>

                  {newCert.requireOnSchedule && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="min-day">Min. per Day Shift</Label>
                        <Input
                          id="min-day"
                          type="number"
                          min={1}
                          value={newCert.minPerDayShift}
                          onChange={(e) => setNewCert({ ...newCert, minPerDayShift: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="min-night">Min. per Night Shift</Label>
                        <Input
                          id="min-night"
                          type="number"
                          min={1}
                          value={newCert.minPerNightShift}
                          onChange={(e) => setNewCert({ ...newCert, minPerNightShift: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                    </>
                  )}

                  {/* Expiry Warning */}
                  <div className="md:col-span-2 pt-3 border-t space-y-2">
                    <Label htmlFor="expiry-warning">Expiry Warning (days before)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="expiry-warning"
                        type="number"
                        min={7}
                        className="w-24"
                        value={newCert.expiryWarningDays}
                        onChange={(e) => setNewCert({ ...newCert, expiryWarningDays: parseInt(e.target.value) || 180 })}
                      />
                      <span className="text-sm text-muted-foreground">
                        ({Math.round(newCert.expiryWarningDays / 30)} months)
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Send reminder when certification is about to expire
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={resetCertForm}>Cancel</Button>
                  <Button onClick={handleSaveCert} disabled={savingCert}>
                    {savingCert ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    {editingCert ? "Update" : "Create"}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {certifications.map((cert) => (
                <div key={cert.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: cert.color }}
                    />
                    <div>
                      <p className="font-medium">{cert.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {cert._count.userCertifications} worker{cert._count.userCertifications !== 1 ? "s" : ""}
                        {cert.isRequired && " • Required for all"}
                        {cert.requireOnSchedule && ` • Min ${cert.minPerDayShift}D/${cert.minPerNightShift}N per shift`}
                      </p>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => startEditCert(cert)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCert(cert.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {certifications.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No certifications defined yet. Add certifications specific to your industry.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-muted-foreground text-xs">Name</Label>
                <p className="font-medium text-sm sm:text-base truncate">{session?.user?.name || "Not set"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Email</Label>
                <p className="font-medium text-sm sm:text-base truncate">{session?.user?.email}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Role</Label>
                <Badge>{session?.user?.role}</Badge>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Organization</Label>
                <p className="font-medium text-sm sm:text-base truncate">{organization?.name}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowPasswordModal(true)}>
                <Key className="h-4 w-4 mr-2" />
                Change Password
              </Button>
              <Button
                variant="outline"
                onClick={handleExportPersonalData}
                disabled={exportingPersonalData}
              >
                <Download className="h-4 w-4 mr-2" />
                {exportingPersonalData ? "Exporting..." : "Download My Data"}
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
            <p className="text-xs text-muted-foreground pt-2">
              Your rights under GDPR/CCPA: You can download all your personal data or delete your account at any time.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Legal Links */}
      <div className="mt-8 pt-6 border-t text-center text-sm text-muted-foreground">
        <p>
          By using ShiftSync, you agree to our{" "}
          <a href="/terms" className="text-primary hover:underline">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </a>
        </p>
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
          setInviteForm({ email: "", name: "", role: "WORKER" })
          setInviteLink(null)
        }}
        title="Invite User"
        description="Send an invitation email to add a new user to your organization"
      >
        <div className="space-y-4">
          {inviteLink ? (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                  Email could not be sent. Please share this link with the user:
                </p>
                <div className="flex gap-2">
                  <Input
                    value={inviteLink}
                    readOnly
                    className="text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(inviteLink)
                      showMessage("Link copied to clipboard")
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => {
                  setShowInviteModal(false)
                  setInviteForm({ email: "", name: "", role: "WORKER" })
                  setInviteLink(null)
                }}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <>
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
                <p className="text-xs text-muted-foreground">They will receive an email with a link to set their password</p>
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
                  {sendingInvite ? "Sending..." : "Send Invitation"}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
