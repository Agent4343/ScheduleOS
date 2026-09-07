"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/toast"
import { errorMessage } from "@/lib/api-client"
import { useRole } from "@/lib/auth/use-role"
import { useRotationPatterns, rotationPatternKeys } from "@/features/rotation-patterns/hooks"
import { useCustomShiftTypes, customShiftTypeKeys } from "@/features/custom-shift-types/hooks"
import { useOrgSettings } from "@/features/settings/use-org-settings"
import { OrganizationCard } from "@/features/settings/components/organization-card"
import { ScheduleDisplayCard } from "@/features/settings/components/schedule-display-card"
import { NotificationsCard } from "@/features/settings/components/notifications-card"
import { AutoCheckoutCard } from "@/features/settings/components/auto-checkout-card"
import { DataExportCard } from "@/features/settings/components/data-export-card"
import { HolidaysCard } from "@/features/settings/components/holidays-card"
import { AccountCard } from "@/features/settings/components/account-card"
import { RotationPatternsCard } from "@/features/settings/components/rotation-patterns-card"
import { CustomShiftTypesCard, DEFAULT_SHIFT_COLORS } from "@/features/settings/components/custom-shift-types-card"
import { CoverageCard } from "@/features/settings/components/coverage-card"
import { useCoverageRoles } from "@/features/coverage/hooks"

/**
 * Settings is a grid of independent cards. Every control saves as soon as it
 * changes (see useOrgSettings), so there is no page-level Save button.
 */
export default function SettingsPage() {
  const { isAdmin } = useRole()
  const toast = useToast()
  const qc = useQueryClient()
  const org = useOrgSettings()
  const patterns = useRotationPatterns()
  const customTypes = useCustomShiftTypes()
  const coverageRoles = useCoverageRoles()

  // Shift colours: edited locally as the colour pickers move, saved shortly after
  const [shiftColors, setShiftColors] = useState(DEFAULT_SHIFT_COLORS)
  const saveTimer = useRef<number | null>(null)
  useEffect(() => {
    if (org.settings.shiftColors) setShiftColors({ ...DEFAULT_SHIFT_COLORS, ...org.settings.shiftColors })
  }, [org.settings.shiftColors])
  const changeShiftColors = (colors: typeof shiftColors) => {
    setShiftColors(colors)
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => org.saveSettings({ shiftColors: colors }, "Shift colours saved"), 600)
  }
  useEffect(() => () => { if (saveTimer.current) window.clearTimeout(saveTimer.current) }, [])

  // The two legacy cards report through a message callback
  const onMessage = useMemo(
    () => (msg: string, kind?: "success" | "error") => {
      const k = kind ?? (/fail|required|invalid|error/i.test(msg) ? "error" : "success")
      if (k === "success") toast.success(msg)
      else toast.error(msg)
    },
    [toast]
  )

  if (org.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (org.error || !org.organization) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {errorMessage(org.error, "Could not load settings")}{" "}
          <button className="underline" onClick={() => org.refetch()}>
            Retry
          </button>
        </AlertDescription>
      </Alert>
    )
  }

  const settings = org.settings

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Organization settings and preferences. Changes save automatically.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <OrganizationCard organization={org.organization} isAdmin={isAdmin} saving={org.saving} onSaveName={org.saveName} />
        <ScheduleDisplayCard settings={settings} isAdmin={isAdmin} onChange={(patch) => org.saveSettings(patch)} />
        <NotificationsCard settings={settings} isAdmin={isAdmin} onChange={(patch) => org.saveSettings(patch)} />
        <AutoCheckoutCard settings={settings} isAdmin={isAdmin} onChange={(patch) => org.saveSettings(patch)} />
        <DataExportCard />
        <HolidaysCard isAdmin={isAdmin} />
        <RotationPatternsCard
          patterns={patterns.data ?? []}
          isAdmin={isAdmin}
          onRefresh={() => {
            qc.invalidateQueries({ queryKey: rotationPatternKeys.all })
            qc.invalidateQueries({ queryKey: ["crews"] })
          }}
          onMessage={onMessage}
        />
        <CoverageCard isAdmin={isAdmin} />
        <CustomShiftTypesCard
          customShiftTypes={customTypes.data ?? []}
          coverageRoles={coverageRoles.data ?? []}
          shiftColors={shiftColors}
          isAdmin={isAdmin}
          onRefresh={() => qc.invalidateQueries({ queryKey: customShiftTypeKeys.all })}
          onMessage={onMessage}
          onShiftColorsChange={changeShiftColors}
        />
        <AccountCard organizationName={org.organization.name} />
      </div>
    </div>
  )
}
