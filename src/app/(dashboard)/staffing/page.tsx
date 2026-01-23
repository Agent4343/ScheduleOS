"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Modal } from "@/components/ui/modal"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Download, Filter, Loader2, AlertTriangle, Plus, Pencil, Trash2, Save } from "lucide-react"
import { endOfWeekUTC, getTodayUTC, startOfWeekUTC, toDateString } from "@/lib/timezone"

interface Organization {
  id: string
  name: string
  settings: {
    minStaffingAlertEnabled?: boolean
    minStaffOperators?: number
    minStaffOnshoreControlRoom?: number
  }
}

interface Crew {
  id: string
  name: string
}

interface StaffingRule {
  id: string
  name: string
  description?: string | null
  shiftType: string
  minWorkers: number
  maxVacation: number
  role?: string | null
  positionType?: string | null
  crewId?: string | null
  priority: number
  isActive: boolean
  crew?: { id: string; name: string }
}

interface GapWorker {
  id: string
  name: string | null
  crewName: string | null
  role: string
  positionType: string
}

interface StaffingGap {
  date: string
  shiftType: string
  shortage: number
  required: number
  scheduled: number
  ruleName: string
  crew?: { id: string; name: string }
  positionType?: string
  role?: string
  scheduledWorkers: GapWorker[]
  availableWorkers: GapWorker[]
}

interface CoverageRow {
  date: string
  shiftType: string
  ruleName: string
  required: number
  scheduled: number
  shortage: number
  crew?: { id: string; name: string }
  positionType?: string
  role?: string
}

const ROLE_OPTIONS = [
  { value: "", label: "All Roles" },
  { value: "WORKER", label: "Worker" },
  { value: "SUPERVISOR", label: "Supervisor" },
  { value: "ADMIN", label: "Administrator" },
]

const SHIFT_OPTIONS = [
  { value: "DAY", label: "Day" },
  { value: "NIGHT", label: "Night" },
]

const POSITION_OPTIONS = [
  { value: "", label: "Any Position" },
  { value: "OPERATOR", label: "Operator" },
  { value: "ONSHORE_CONTROL_ROOM", label: "Onshore Control Room" },
  { value: "OTHER", label: "Other" },
]

export default function StaffingPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPERVISOR"

  const today = useMemo(() => getTodayUTC(), [])
  const [startDate, setStartDate] = useState(() => toDateString(startOfWeekUTC(today)))
  const [endDate, setEndDate] = useState(() => toDateString(endOfWeekUTC(today)))
  const [crewId, setCrewId] = useState("")
  const [shiftType, setShiftType] = useState("")
  const [role, setRole] = useState("")
  const [positionType, setPositionType] = useState("")

  const [organization, setOrganization] = useState<Organization | null>(null)
  const [rules, setRules] = useState<StaffingRule[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null)

  const [gaps, setGaps] = useState<StaffingGap[]>([])
  const [totalGaps, setTotalGaps] = useState(0)
  const [totalDays, setTotalDays] = useState(0)
  const [loadingGaps, setLoadingGaps] = useState(true)
  const [coverageRows, setCoverageRows] = useState<CoverageRow[]>([])
  const [coverageSummary, setCoverageSummary] = useState({ totalRows: 0, satisfied: 0, unsatisfied: 0 })
  const [loadingCoverage, setLoadingCoverage] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null)
  const [assignSelections, setAssignSelections] = useState<Record<string, string>>({})
  const [assigning, setAssigning] = useState<Record<string, boolean>>({})

  const [showRuleModal, setShowRuleModal] = useState(false)
  const [editingRule, setEditingRule] = useState<StaffingRule | null>(null)
  const [savingRule, setSavingRule] = useState(false)
  const [ruleForm, setRuleForm] = useState({
    name: "",
    description: "",
    shiftType: "DAY",
    minWorkers: 1,
    maxVacation: 1,
    role: "",
    positionType: "",
    crewId: "",
    priority: 0,
    isActive: true,
  })

  const activeRuleCount = useMemo(
    () => rules.filter((rule) => rule.isActive).length,
    [rules]
  )
  const alertsEnabled = organization?.settings?.minStaffingAlertEnabled ?? false

  const loadStaffingData = useCallback(async () => {
    setLoadingSettings(true)
    try {
      const [orgRes, rulesRes, crewsRes] = await Promise.all([
        fetch("/api/organization"),
        fetch("/api/staffing-rules"),
        fetch("/api/crews"),
      ])
      const orgData = await orgRes.json()
      const rulesData = await rulesRes.json()
      const crewsData = await crewsRes.json()

      if (orgData.success) {
        setOrganization(orgData.data)
      }
      if (rulesData.success) {
        setRules(rulesData.data)
      }
      if (crewsData.success) {
        setCrews(crewsData.data)
      }
    } catch (err) {
      console.error("Failed to load staffing settings:", err)
    } finally {
      setLoadingSettings(false)
    }
  }, [])

  useEffect(() => {
    loadStaffingData()
  }, [loadStaffingData])

  const handleSaveSettings = async () => {
    if (!organization) return
    setSavingSettings(true)
    setSettingsMessage(null)

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
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to save settings.")
      }
      setSettingsMessage("Minimum staffing settings saved.")
    } catch (err) {
      setSettingsMessage(err instanceof Error ? err.message : "Failed to save settings.")
    } finally {
      setSavingSettings(false)
    }
  }

  const openCreateRule = () => {
    setEditingRule(null)
    setRuleForm({
      name: "",
      description: "",
      shiftType: "DAY",
      minWorkers: 1,
      maxVacation: 1,
      role: "",
      positionType: "",
      crewId: "",
      priority: 0,
      isActive: true,
    })
    setShowRuleModal(true)
  }

  const openEditRule = (rule: StaffingRule) => {
    setEditingRule(rule)
    setRuleForm({
      name: rule.name,
      description: rule.description || "",
      shiftType: rule.shiftType,
      minWorkers: rule.minWorkers,
      maxVacation: rule.maxVacation,
      role: rule.role || "",
      positionType: rule.positionType || "",
      crewId: rule.crewId || "",
      priority: rule.priority,
      isActive: rule.isActive,
    })
    setShowRuleModal(true)
  }

  const handleSaveRule = async () => {
    if (!isAdmin) {
      setFeedback({ type: "error", message: "Only admins can update staffing rules." })
      return
    }
    if (!ruleForm.name.trim()) {
      setFeedback({ type: "error", message: "Rule name is required." })
      return
    }

    setSavingRule(true)
    setFeedback(null)

    try {
      const payload = {
        name: ruleForm.name,
        description: ruleForm.description || null,
        shiftType: ruleForm.shiftType,
        minWorkers: Number(ruleForm.minWorkers),
        maxVacation: Number(ruleForm.maxVacation),
        role: ruleForm.role || null,
        positionType: ruleForm.positionType || null,
        crewId: ruleForm.crewId || null,
        priority: Number(ruleForm.priority),
        isActive: ruleForm.isActive,
      }

      const response = await fetch(
        editingRule ? `/api/staffing-rules/${editingRule.id}` : "/api/staffing-rules",
        {
          method: editingRule ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to save rule.")
      }

      setShowRuleModal(false)
      setEditingRule(null)
      await loadStaffingData()
      setFeedback({ type: "success", message: "Staffing rule saved." })
    } catch (err) {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Failed to save rule." })
    } finally {
      setSavingRule(false)
    }
  }

  const handleDeleteRule = async (rule: StaffingRule) => {
    if (!isAdmin) {
      setFeedback({ type: "error", message: "Only admins can delete staffing rules." })
      return
    }
    if (!confirm(`Delete rule "${rule.name}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/staffing-rules/${rule.id}`, {
        method: "DELETE",
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to delete rule.")
      }
      await loadStaffingData()
      setFeedback({ type: "success", message: "Staffing rule deleted." })
    } catch (err) {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Failed to delete rule." })
    }
  }

  const fetchGaps = useCallback(async () => {
    setLoadingGaps(true)
    setError(null)
    setFeedback(null)

    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
      })
      if (crewId) params.set("crewId", crewId)
      if (shiftType) params.set("shiftType", shiftType)
      if (role) params.set("role", role)
      if (positionType) params.set("positionType", positionType)

      const response = await fetch(`/api/staffing-gaps?${params.toString()}`)
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch staffing gaps.")
      }

      setGaps(data.data.gaps || [])
      setTotalGaps(data.data.totalGaps || 0)
      setTotalDays(data.data.totalDays || 0)
    } catch (err) {
      console.error("Failed to load staffing gaps:", err)
      setError(err instanceof Error ? err.message : "Failed to load staffing gaps.")
    } finally {
      setLoadingGaps(false)
    }
  }, [startDate, endDate, crewId, shiftType, role, positionType])

  const fetchCoverage = useCallback(async () => {
    setLoadingCoverage(true)

    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
      })
      if (crewId) params.set("crewId", crewId)
      if (shiftType) params.set("shiftType", shiftType)
      if (role) params.set("role", role)
      if (positionType) params.set("positionType", positionType)

      const response = await fetch(`/api/staffing-coverage?${params.toString()}`)
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch staffing coverage.")
      }

      setCoverageRows(data.data.rows || [])
      setCoverageSummary({
        totalRows: data.data.totalRows || 0,
        satisfied: data.data.satisfied || 0,
        unsatisfied: data.data.unsatisfied || 0,
      })
    } catch (err) {
      console.error("Failed to load staffing coverage:", err)
    } finally {
      setLoadingCoverage(false)
    }
  }, [startDate, endDate, crewId, shiftType, role, positionType])

  const getGapKey = (gap: StaffingGap) => {
    return [
      gap.date,
      gap.shiftType,
      gap.ruleName,
      gap.crew?.id || "org",
      gap.positionType || "any",
      gap.role || "any",
    ].join("|")
  }

  const handleAssign = async (gap: StaffingGap) => {
    if (!isAdmin) {
      setFeedback({ type: "error", message: "Only admins and supervisors can assign coverage." })
      return
    }

    const key = getGapKey(gap)
    const selectedWorkerId = assignSelections[key]
    if (!selectedWorkerId) {
      setFeedback({ type: "error", message: "Select a worker before assigning coverage." })
      return
    }

    setAssigning((prev) => ({ ...prev, [key]: true }))
    setFeedback(null)

    try {
      const response = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedWorkerId,
          date: gap.date,
          shiftType: gap.shiftType,
          isOverride: true,
          overrideReason: `Staffing gap coverage: ${gap.ruleName}`,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to assign worker.")
      }

      setFeedback({ type: "success", message: "Coverage assigned successfully." })
      await fetchGaps()
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to assign worker.",
      })
    } finally {
      setAssigning((prev) => ({ ...prev, [key]: false }))
    }
  }

  useEffect(() => {
    fetchGaps()
    fetchCoverage()
  }, [fetchGaps, fetchCoverage])

  const handleExport = () => {
    const params = new URLSearchParams({
      startDate,
      endDate,
      format: "csv",
    })
    if (crewId) params.set("crewId", crewId)
    if (shiftType) params.set("shiftType", shiftType)
    if (role) params.set("role", role)
    if (positionType) params.set("positionType", positionType)
    window.location.href = `/api/staffing-gaps?${params.toString()}`
  }

  const crewFilterActive = Boolean(crewId)

  return (
    <div className="space-y-8">
      <PageHeader
        title="Staffing"
        description="Manage staffing requirements, rules, and coverage gaps in one place."
        actions={(
          <Button variant="outline" className="gap-2" onClick={handleExport} disabled={loadingGaps}>
            <Download className="h-4 w-4" />
            Export Gaps CSV
          </Button>
        )}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Minimum Alerts</CardDescription>
            <CardTitle className="text-2xl">
              {alertsEnabled ? "Enabled" : "Disabled"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {alertsEnabled
              ? "Alerts are active for minimum staffing."
              : "Enable alerts to track minimum staffing."}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Rules</CardDescription>
            <CardTitle className="text-2xl">{activeRuleCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {rules.length > 0
              ? `${rules.length} total rules configured.`
              : "No staffing rules configured yet."}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Coverage Gaps</CardDescription>
            <CardTitle className="text-2xl">{totalGaps}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {totalDays > 0
              ? `Across ${totalDays} day${totalDays === 1 ? "" : "s"} in range.`
              : "Select a date range to see gaps."}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How staffing works</CardTitle>
          <CardDescription>Understand how minimums and gaps are calculated.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Organization minimums apply to all DAY and NIGHT shifts by position.</p>
          <p>2. Staffing rules add crew, role, or position-specific minimums.</p>
          <p>3. Gaps show required vs scheduled and the workers who can cover.</p>
          <p>4. Assign coverage to create a schedule override for that day.</p>
        </CardContent>
      </Card>

      {feedback ? (
        <Alert variant={feedback.type === "error" ? "destructive" : "success"}>
          <AlertTitle>{feedback.type === "error" ? "Action failed" : "Success"}</AlertTitle>
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Minimum Staffing Alerts
          </CardTitle>
          <CardDescription>Set organization-wide minimum staffing thresholds.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingSettings ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading settings...
            </div>
          ) : organization ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Minimum Staffing Alerts</p>
                  <p className="text-xs text-muted-foreground">Get notified when staffing drops below minimum</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setOrganization((prev) =>
                      prev
                        ? {
                            ...prev,
                            settings: {
                              ...prev.settings,
                              minStaffingAlertEnabled: !prev.settings.minStaffingAlertEnabled,
                            },
                          }
                        : prev
                    )
                  }
                  disabled={!isAdmin}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    organization.settings.minStaffingAlertEnabled ? "bg-primary" : "bg-muted"
                  } ${!isAdmin ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      organization.settings.minStaffingAlertEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {organization.settings.minStaffingAlertEnabled ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="minOperators">Minimum Operators</Label>
                    <Input
                      id="minOperators"
                      type="number"
                      min={0}
                      value={organization.settings.minStaffOperators ?? 1}
                      onChange={(e) =>
                        setOrganization((prev) =>
                          prev
                            ? {
                                ...prev,
                                settings: {
                                  ...prev.settings,
                                  minStaffOperators: parseInt(e.target.value) || 0,
                                },
                              }
                            : prev
                        )
                      }
                      disabled={!isAdmin}
                    />
                    <p className="text-xs text-muted-foreground">Minimum operators required per shift</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minOnshore">Minimum Onshore Control Room</Label>
                    <Input
                      id="minOnshore"
                      type="number"
                      min={0}
                      value={organization.settings.minStaffOnshoreControlRoom ?? 1}
                      onChange={(e) =>
                        setOrganization((prev) =>
                          prev
                            ? {
                                ...prev,
                                settings: {
                                  ...prev.settings,
                                  minStaffOnshoreControlRoom: parseInt(e.target.value) || 0,
                                },
                              }
                            : prev
                        )
                      }
                      disabled={!isAdmin}
                    />
                    <p className="text-xs text-muted-foreground">Minimum onshore control room staff per shift</p>
                  </div>
                </div>
              ) : null}

              {settingsMessage ? (
                <Alert variant={settingsMessage.includes("Failed") ? "destructive" : "success"}>
                  <AlertDescription>{settingsMessage}</AlertDescription>
                </Alert>
              ) : null}

              <div className="flex justify-end">
                <Button onClick={handleSaveSettings} disabled={!isAdmin || savingSettings}>
                  <Save className="h-4 w-4 mr-2" />
                  {savingSettings ? "Saving..." : "Save Minimums"}
                </Button>
              </div>
            </>
          ) : (
            <Alert variant="destructive">
              <AlertTitle>Unable to load settings</AlertTitle>
              <AlertDescription>Refresh the page to try again.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle>Staffing Rules</CardTitle>
            <CardDescription>Define minimum staffing requirements by crew, role, or position.</CardDescription>
          </div>
          {isAdmin && (
            <Button onClick={openCreateRule}>
              <Plus className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No staffing rules configured yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Min</TableHead>
                  <TableHead>Crew</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>{rule.name}</TableCell>
                    <TableCell>{rule.shiftType}</TableCell>
                    <TableCell>{rule.minWorkers}</TableCell>
                    <TableCell>{rule.crew?.name || "Any"}</TableCell>
                    <TableCell>{rule.role || "Any"}</TableCell>
                    <TableCell>{rule.positionType || "Any"}</TableCell>
                    <TableCell>{rule.priority}</TableCell>
                    <TableCell>
                      <Badge variant={rule.isActive ? "default" : "secondary"}>
                        {rule.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="flex items-center gap-2">
                      {isAdmin && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => openEditRule(rule)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteRule(rule)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Coverage Filters
          </CardTitle>
          <CardDescription>Filter staffing gaps by date range and scope.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="crewFilter">Crew</Label>
              <Select
                id="crewFilter"
                value={crewId}
                onChange={(e) => setCrewId(e.target.value)}
                options={[
                  { value: "", label: "All Crews" },
                  ...crews.map((crew) => ({ value: crew.id, label: crew.name })),
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shiftFilter">Shift</Label>
              <Select
                id="shiftFilter"
                value={shiftType}
                onChange={(e) => setShiftType(e.target.value)}
                options={[{ value: "", label: "All Shifts" }, ...SHIFT_OPTIONS]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roleFilter">Role</Label>
              <Select
                id="roleFilter"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                options={ROLE_OPTIONS}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="positionFilter">Position</Label>
              <Select
                id="positionFilter"
                value={positionType}
                onChange={(e) => setPositionType(e.target.value)}
                options={POSITION_OPTIONS}
              />
            </div>
          </div>

          {crewFilterActive ? (
            <Alert variant="info">
              <AlertTitle>Crew filter applied</AlertTitle>
              <AlertDescription>
                Crew filtering only shows gaps from crew-specific rules. Organization-wide minimums are hidden.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex justify-end">
            <Button
              onClick={() => {
                fetchGaps()
                fetchCoverage()
              }}
              disabled={loadingGaps || loadingCoverage}
            >
              {loadingGaps || loadingCoverage ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Apply Filters"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coverage Summary</CardTitle>
          <CardDescription>See if minimums are satisfied by date and shift.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Checks</CardDescription>
                <CardTitle className="text-2xl">{coverageSummary.totalRows}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Minimums Met</CardDescription>
                <CardTitle className="text-2xl">{coverageSummary.satisfied}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Minimums Missed</CardDescription>
                <CardTitle className="text-2xl">{coverageSummary.unsatisfied}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {loadingCoverage ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : coverageRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No coverage checks found for this range.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Crew</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coverageRows.map((row, index) => (
                  <TableRow key={`${row.date}-${row.shiftType}-${row.ruleName}-${index}`}>
                    <TableCell>{new Date(row.date).toLocaleDateString()}</TableCell>
                    <TableCell>{row.shiftType}</TableCell>
                    <TableCell>{row.ruleName}</TableCell>
                    <TableCell>{row.required}</TableCell>
                    <TableCell>{row.scheduled}</TableCell>
                    <TableCell>
                      {row.shortage === 0 ? (
                        <Badge variant="default">Met</Badge>
                      ) : (
                        <Badge variant="destructive">Missing {row.shortage}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{row.crew?.name || "Org-wide"}</TableCell>
                    <TableCell>{row.positionType || "Any"}</TableCell>
                    <TableCell>{row.role || "Any"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load staffing gaps</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Gaps</CardDescription>
            <CardTitle className="text-2xl">{totalGaps}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Date Range</CardDescription>
            <CardTitle className="text-2xl">
              {startDate} → {endDate}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Days</CardDescription>
            <CardTitle className="text-2xl">{totalDays}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Gap Details
          </CardTitle>
          <CardDescription>Review exactly who is scheduled and who can cover each gap.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingGaps ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : gaps.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p>No staffing gaps found for this range.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Shortage</TableHead>
                  <TableHead>Crew</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gaps.map((gap, index) => (
                  <TableRow key={`${gap.date}-${gap.shiftType}-${index}`}>
                    <TableCell>{new Date(gap.date).toLocaleDateString()}</TableCell>
                    <TableCell>{gap.shiftType}</TableCell>
                    <TableCell>{gap.ruleName}</TableCell>
                    <TableCell>{gap.required}</TableCell>
                    <TableCell>{gap.scheduled}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">-{gap.shortage}</Badge>
                    </TableCell>
                    <TableCell>{gap.crew?.name || "Org-wide"}</TableCell>
                    <TableCell>{gap.positionType || "Any"}</TableCell>
                    <TableCell>{gap.role || "Any"}</TableCell>
                    <TableCell>
                      <details className="text-xs">
                        <summary className="cursor-pointer text-primary">View</summary>
                        <div className="mt-2 space-y-1 text-muted-foreground">
                          <p>
                            <span className="font-medium text-foreground">Scheduled:</span>{" "}
                            {gap.scheduledWorkers.length > 0
                              ? gap.scheduledWorkers.map((w) => w.name || "Unnamed").join(", ")
                              : "None"}
                          </p>
                          <p>
                            <span className="font-medium text-foreground">Available:</span>{" "}
                            {gap.availableWorkers.length > 0
                              ? gap.availableWorkers.map((w) => w.name || "Unnamed").join(", ")
                              : "None"}
                          </p>
                          {isAdmin ? (
                            <div className="pt-2 space-y-2">
                              <Label htmlFor={`assign-${index}`} className="text-xs">Assign coverage</Label>
                              <Select
                                id={`assign-${index}`}
                                value={assignSelections[getGapKey(gap)] || ""}
                                onChange={(e) =>
                                  setAssignSelections((prev) => ({
                                    ...prev,
                                    [getGapKey(gap)]: e.target.value,
                                  }))
                                }
                                options={[
                                  { value: "", label: "Select worker" },
                                  ...gap.availableWorkers.map((worker) => ({
                                    value: worker.id,
                                    label: worker.name
                                      ? `${worker.name}${worker.crewName ? ` (${worker.crewName})` : ""}`
                                      : worker.id,
                                  })),
                                ]}
                              />
                              <Button
                                size="sm"
                                onClick={() => handleAssign(gap)}
                                disabled={assigning[getGapKey(gap)] || gap.availableWorkers.length === 0}
                              >
                                {assigning[getGapKey(gap)] ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Assign"
                                )}
                              </Button>
                              {gap.availableWorkers.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No available workers match this rule.</p>
                              ) : null}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground pt-2">
                              Only supervisors and admins can assign coverage.
                            </p>
                          )}
                        </div>
                      </details>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={showRuleModal}
        onClose={() => setShowRuleModal(false)}
        title={editingRule ? "Edit Staffing Rule" : "Add Staffing Rule"}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ruleName">Rule Name</Label>
            <Input
              id="ruleName"
              value={ruleForm.name}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ruleDescription">Description (optional)</Label>
            <Input
              id="ruleDescription"
              value={ruleForm.description}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ruleShift">Shift</Label>
              <Select
                id="ruleShift"
                value={ruleForm.shiftType}
                onChange={(e) => setRuleForm((prev) => ({ ...prev, shiftType: e.target.value }))}
                options={SHIFT_OPTIONS}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ruleMin">Minimum Workers</Label>
              <Input
                id="ruleMin"
                type="number"
                min={0}
                value={ruleForm.minWorkers}
                onChange={(e) =>
                  setRuleForm((prev) => ({
                    ...prev,
                    minWorkers: Number(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ruleCrew">Crew (optional)</Label>
              <Select
                id="ruleCrew"
                value={ruleForm.crewId}
                onChange={(e) => setRuleForm((prev) => ({ ...prev, crewId: e.target.value }))}
                options={[{ value: "", label: "Any Crew" }, ...crews.map((crew) => ({ value: crew.id, label: crew.name }))]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ruleRole">Role (optional)</Label>
              <Select
                id="ruleRole"
                value={ruleForm.role}
                onChange={(e) => setRuleForm((prev) => ({ ...prev, role: e.target.value }))}
                options={ROLE_OPTIONS}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rulePosition">Position (optional)</Label>
              <Select
                id="rulePosition"
                value={ruleForm.positionType}
                onChange={(e) => setRuleForm((prev) => ({ ...prev, positionType: e.target.value }))}
                options={POSITION_OPTIONS}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rulePriority">Priority</Label>
              <Input
                id="rulePriority"
                type="number"
                min={0}
                value={ruleForm.priority}
                onChange={(e) =>
                  setRuleForm((prev) => ({ ...prev, priority: Number(e.target.value) || 0 }))
                }
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Active</Label>
              <p className="text-xs text-muted-foreground">Disable rules without deleting them</p>
            </div>
            <button
              type="button"
              onClick={() => setRuleForm((prev) => ({ ...prev, isActive: !prev.isActive }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                ruleForm.isActive ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  ruleForm.isActive ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowRuleModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRule} disabled={savingRule}>
              {savingRule ? "Saving..." : "Save Rule"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
