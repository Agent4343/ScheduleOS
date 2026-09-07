"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface SettingsCardProps {
  icon: LucideIcon
  title: string
  description?: string
  /** Rendered on the right of the header (e.g. an Add button) */
  action?: ReactNode
  className?: string
  children: ReactNode
}

/** The frame every settings section shares. */
export function SettingsCard({ icon: Icon, title, description, action, className, children }: SettingsCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5" aria-hidden />
              {title}
            </CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

/** A labelled row with a control on the right (used for switches). */
export function SettingRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="font-medium text-sm">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  )
}
