"use client"

import { useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Building2, Calendar, Bell, Shield, Save } from "lucide-react"

// Local imports
import { useSettingsData } from "./hooks/useSettingsData"
import { RotationPatternsCard } from "./components/RotationPatternsCard"
import { PositionsCard } from "./components/PositionsCard"
import { PositionModal } from "./components/PositionModal"
import type { Position, Organization } from "./settings-types"

export default function SettingsPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN"

  // Data hook
  const {
    organization,
    patterns,
    positions,
    loading,
    saving,
    message,
    setOrganization,
    setPositions,
    setMessage,
    showMessageBriefly,
    saveOrganization,
    createPattern,
    refreshPositions,
  } = useSettingsData()

  // Position modal state
  const [positionModalOpen, setPositionModalOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState<Position | null>(null)

  // Position handlers
  const openAddPosition = useCallback(() => {
    setEditingPosition(null)
    setPositionModalOpen(true)
  }, [])

  const openEditPosition = useCallback((position: Position) => {
    setEditingPosition(position)
    setPositionModalOpen(true)
  }, [])

  const handlePositionSaved = useCallback(async () => {
    await refreshPositions()
    setTimeout(() => setMessage(""), 3000)
  }, [refreshPositions, setMessage])

  const deletePosition = useCallback(
    async (position: Position) => {
      if (!confirm(`Delete position "${position.name}"?`)) return

      try {
        const response = await fetch(`/api/positions/${position.id}`, {
          method: "DELETE",
        })

        if (response.ok) {
          setPositions((prev) => prev.filter((p) => p.id !== position.id))
          showMessageBriefly("Position deleted!")
        } else {
          const data = await response.json()
          setMessage(data.error || "Failed to delete position")
        }
      } catch (error) {
        console.error("Failed to delete position:", error)
        setMessage("Failed to delete position")
      }
    },
    [setPositions, showMessageBriefly, setMessage]
  )

  if (loading) {
    return <LoadingSkeleton />
  }

  const isSuccessMessage =
    message.includes("success") ||
    message.includes("created") ||
    message.includes("updated") ||
    message.includes("deleted")

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
        <Alert variant={isSuccessMessage ? "success" : "destructive"}>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Organization Info */}
        <OrganizationCard
          organization={organization}
          isAdmin={isAdmin}
          onOrganizationChange={setOrganization}
        />

        {/* Schedule Settings */}
        <ScheduleSettingsCard
          organization={organization}
          isAdmin={isAdmin}
          onOrganizationChange={setOrganization}
        />

        {/* Notifications */}
        <NotificationsCard organization={organization} />

        {/* Rotation Patterns */}
        <RotationPatternsCard
          patterns={patterns}
          isAdmin={isAdmin}
          onCreatePattern={createPattern}
        />

        {/* Positions Management */}
        <PositionsCard
          positions={positions}
          isAdmin={isAdmin}
          onAddPosition={openAddPosition}
          onEditPosition={openEditPosition}
          onDeletePosition={deletePosition}
        />
      </div>

      {/* Save button */}
      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={saveOrganization} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      )}

      {/* Account section */}
      <AccountCard session={session} />

      {/* Position Modal */}
      <PositionModal
        isOpen={positionModalOpen}
        editingPosition={editingPosition}
        onClose={() => setPositionModalOpen(false)}
        onSaved={handlePositionSaved}
        onMessage={showMessageBriefly}
      />
    </div>
  )
}

// Loading skeleton
function LoadingSkeleton() {
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

// Organization card component
interface OrganizationCardProps {
  organization: Organization | null
  isAdmin: boolean
  onOrganizationChange: React.Dispatch<React.SetStateAction<Organization | null>>
}

function OrganizationCard({ organization, isAdmin, onOrganizationChange }: OrganizationCardProps) {
  return (
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
              onOrganizationChange((prev) =>
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
  )
}

// Schedule settings card component
interface ScheduleSettingsCardProps {
  organization: Organization | null
  isAdmin: boolean
  onOrganizationChange: React.Dispatch<React.SetStateAction<Organization | null>>
}

function ScheduleSettingsCard({
  organization,
  isAdmin,
  onOrganizationChange,
}: ScheduleSettingsCardProps) {
  return (
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
              onOrganizationChange((prev) =>
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
  )
}

// Notifications card component
interface NotificationsCardProps {
  organization: Organization | null
}

function NotificationsCard({ organization }: NotificationsCardProps) {
  return (
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
          <Badge
            variant={organization?.settings?.emailNotificationsEnabled ? "success" : "secondary"}
          >
            {organization?.settings?.emailNotificationsEnabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">SMS Notifications</p>
            <p className="text-xs text-muted-foreground">Receive urgent updates via SMS</p>
          </div>
          <Badge
            variant={organization?.settings?.smsNotificationsEnabled ? "success" : "secondary"}
          >
            {organization?.settings?.smsNotificationsEnabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

// Account card component
interface AccountCardProps {
  session: { user?: { name?: string | null; email?: string | null; role?: string } } | null
}

function AccountCard({ session }: AccountCardProps) {
  return (
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
  )
}
