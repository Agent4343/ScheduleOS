"use client"

import { Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import type { OrganizationSettings } from "@/features/types"
import { SettingsCard, SettingRow } from "./settings-card"

const HOURS = [8, 10, 12, 14]

interface Props {
  settings: OrganizationSettings
  isAdmin: boolean
  onChange: (patch: OrganizationSettings) => void
}

export function AutoCheckoutCard({ settings, isAdmin, onChange }: Props) {
  const hours = settings.autoCheckoutHours ?? 12
  return (
    <SettingsCard icon={Clock} title="Auto-Checkout" description="Close forgotten check-ins after a shift's length">
      <SettingRow label="Enable Auto-Checkout" hint="Open check-ins are closed automatically after the shift duration">
        <Switch
          label="Auto check-out"
          checked={!!settings.autoCheckoutEnabled}
          onCheckedChange={(v) => onChange({ autoCheckoutEnabled: v, autoCheckoutHours: hours })}
          disabled={!isAdmin}
        />
      </SettingRow>

      {settings.autoCheckoutEnabled && (
        <fieldset className="space-y-2 pt-2 border-t">
          <legend className="text-sm font-medium pt-2">Shift Duration</legend>
          <div className="flex flex-wrap gap-2">
            {HOURS.map((h) => (
              <Button
                key={h}
                type="button"
                size="sm"
                variant={hours === h ? "default" : "outline"}
                aria-pressed={hours === h}
                onClick={() => onChange({ autoCheckoutHours: h })}
                disabled={!isAdmin}
              >
                {h} hours
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Workers still checked in {hours} hours after check-in are checked out automatically.</p>
        </fieldset>
      )}
    </SettingsCard>
  )
}
