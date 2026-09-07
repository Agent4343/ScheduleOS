"use client"

import { useState } from "react"
import { Download, FileText, Users, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { todayKey } from "@/lib/dates"
import { SettingsCard } from "./settings-card"

type ExportType = "schedules" | "workers" | "all"

const EXPORTS: { type: ExportType; label: string; icon: typeof Download }[] = [
  { type: "schedules", label: "Export Schedules", icon: FileText },
  { type: "workers", label: "Export Workers", icon: Users },
  { type: "all", label: "Export All Data", icon: Download },
]

export function DataExportCard() {
  const [exporting, setExporting] = useState<ExportType | null>(null)
  const toast = useToast()

  const run = async (type: ExportType) => {
    setExporting(type)
    try {
      const res = await fetch(`/api/export?type=${type}`)
      if (!res.ok) throw new Error(`Export failed (${res.status})`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `schedule-export-${type}-${todayKey()}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success("Export downloaded")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export data")
    } finally {
      setExporting(null)
    }
  }

  return (
    <SettingsCard icon={Download} title="Data Export" description="Download your data as CSV files">
      {EXPORTS.map(({ type, label, icon: Icon }) => (
        <Button key={type} variant="outline" className="w-full justify-start" onClick={() => run(type)} disabled={exporting !== null}>
          {exporting === type ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Icon className="h-4 w-4 mr-2" />}
          {label}
        </Button>
      ))}
    </SettingsCard>
  )
}
