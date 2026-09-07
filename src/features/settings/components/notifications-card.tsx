"use client"

import { Bell } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import type { OrganizationSettings } from "@/features/types"
import { SettingsCard, SettingRow } from "./settings-card"
import { StaffingRulesManager } from "./staffing-rules-manager"

interface Props {
  settings: OrganizationSettings
  isAdmin: boolean
  onChange: (patch: OrganizationSettings) => void
}

export function NotificationsCard({ settings, isAdmin, onChange }: Props) {
  return (
    <SettingsCard icon={Bell} title="Notifications" description="What the organization is told about, and how">
      <SettingRow label="Email Notifications" hint="Time-off decisions and schedule changes by email">
        <Switch
          label="Email notifications"
          checked={!!settings.emailNotificationsEnabled}
          onCheckedChange={(v) => onChange({ emailNotificationsEnabled: v })}
          disabled={!isAdmin}
        />
      </SettingRow>
      <SettingRow label="SMS Notifications" hint="Urgent updates by text message">
        <Switch
          label="SMS notifications"
          checked={!!settings.smsNotificationsEnabled}
          onCheckedChange={(v) => onChange({ smsNotificationsEnabled: v })}
          disabled={!isAdmin}
        />
      </SettingRow>
      <SettingRow label="Minimum Staffing Alerts" hint="Flag shifts that fall below the staffing rules">
        <Switch
          label="Minimum staffing alerts"
          checked={!!settings.minStaffingAlertEnabled}
          onCheckedChange={(v) => onChange({ minStaffingAlertEnabled: v })}
          disabled={!isAdmin}
        />
      </SettingRow>
      {settings.minStaffingAlertEnabled && <StaffingRulesManager isAdmin={isAdmin} />}
    </SettingsCard>
  )
}
