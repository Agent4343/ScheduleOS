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

interface NewPatternForm {
  name: string
  daysOn: number
  daysOff: number
  includesNights: boolean
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [patterns, setPatterns] = useState<RotationPattern[]>([])
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

  const isAdmin = session?.user?.role === "ADMIN"

  useEffect(() => {
    async function fetchData() {
      try {
        const [orgRes, patternsRes] = await Promise.all([
          fetch("/api/organization"),
          fetch("/api/rotation-patterns"),
        ])

        const orgData = await orgRes.json()
        const patternsData = await patternsRes.json()

        if (orgData.success) setOrganization(orgData.data)
        if (patternsData.success) setPatterns(patternsData.data)
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
          nightDays: newPattern.daysOn, // Full rotation is nights when it's night rotation
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
                    <Label htmlFor="daysOn">Days On (working)</Label>
                    <Input
                      id="daysOn"
                      type="number"
                      min={1}
                      value={newPattern.daysOn}
                      onChange={(e) => setNewPattern({ ...newPattern, daysOn: parseInt(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground">
                      {newPattern.daysOn} days = {Math.round(newPattern.daysOn / 7 * 10) / 10} weeks
                    </p>
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
                    <p className="text-xs text-muted-foreground">
                      {newPattern.daysOff} days = {Math.round(newPattern.daysOff / 7 * 10) / 10} weeks
                    </p>
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
                  <div>
                    <Label htmlFor="includesNights" className="font-medium cursor-pointer">
                      Alternates Days/Nights
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      First rotation days, next rotation nights, then repeats
                    </p>
                  </div>
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
                  No patterns yet. Create one to get started!
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
                        {pattern.daysOn} days on / {pattern.daysOff} days off
                        {pattern.includesNights && " • Alternates Days/Nights"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {pattern.isDefault && <Badge variant="secondary">Default</Badge>}
                      {pattern.includesNights && <Badge className="bg-blue-600">Day/Night</Badge>}
                    </div>
                  </div>
                ))
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
