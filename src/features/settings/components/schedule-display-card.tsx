"use client"

import { Calendar, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import type { OrganizationSettings } from "@/features/types"
import { SettingsCard } from "./settings-card"

const DATE_FORMATS = [
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (US)" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (EU)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (ISO)" },
  { value: "DD-MMM-YYYY", label: "DD-MMM-YYYY" },
]

const COMMON_TIMEZONES = [
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

function timezoneOptions(current: string) {
  const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : []
  const common = new Set(COMMON_TIMEZONES.map((t) => t.value))
  const rest = all.filter((tz) => !common.has(tz)).map((tz) => ({ value: tz, label: tz.replace(/_/g, " ") }))
  const opts = [...COMMON_TIMEZONES, ...rest]
  return opts.some((o) => o.value === current) ? opts : [{ value: current, label: current }, ...opts]
}

interface Props {
  settings: OrganizationSettings
  isAdmin: boolean
  onChange: (patch: OrganizationSettings) => void
}

/** Timezone, date format, week start (saved immediately) and theme (per browser). */
export function ScheduleDisplayCard({ settings, isAdmin, onChange }: Props) {
  const { theme, setTheme } = useTheme()
  const timezone = settings.timezone ?? "America/St_Johns"

  return (
    <SettingsCard icon={Calendar} title="Schedule & Display" description="Where and how dates are shown">
      <div className="space-y-2">
        <Label htmlFor="timezone">Timezone</Label>
        <Select
          id="timezone"
          value={timezone}
          onChange={(e) => onChange({ timezone: e.target.value })}
          options={timezoneOptions(timezone)}
          disabled={!isAdmin}
        />
        <p className="text-xs text-muted-foreground">Check-ins and &ldquo;today&rdquo; are worked out in this timezone.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dateFormat">Date Format</Label>
        <Select
          id="dateFormat"
          value={settings.dateFormat ?? "MM/DD/YYYY"}
          onChange={(e) => onChange({ dateFormat: e.target.value })}
          options={DATE_FORMATS}
          disabled={!isAdmin}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Week Starts On</legend>
        <div className="flex gap-2">
          {[
            [0, "Sunday"],
            [1, "Monday"],
          ].map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={(settings.weekStartsOn ?? 0) === value ? "default" : "outline"}
              aria-pressed={(settings.weekStartsOn ?? 0) === value}
              onClick={() => onChange({ weekStartsOn: value as number })}
              disabled={!isAdmin}
            >
              {label}
            </Button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Theme</legend>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={theme === "light" ? "default" : "outline"} aria-pressed={theme === "light"} onClick={() => setTheme("light")}>
            <Sun className="h-4 w-4 mr-1" /> Light
          </Button>
          <Button type="button" size="sm" variant={theme === "dark" ? "default" : "outline"} aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>
            <Moon className="h-4 w-4 mr-1" /> Dark
          </Button>
          <Button type="button" size="sm" variant={theme === "system" ? "default" : "outline"} aria-pressed={theme === "system"} onClick={() => setTheme("system")}>
            System
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Theme is saved on this device only.</p>
      </fieldset>
    </SettingsCard>
  )
}
