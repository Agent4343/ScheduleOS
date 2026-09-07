"use client"

import { useState, type FormEvent } from "react"
import { CalendarDays, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { errorMessage } from "@/lib/api-client"
import { formatDateOnly } from "@/lib/dates"
import { useHolidays, useCreateHoliday, useDeleteHoliday } from "@/features/holidays/hooks"
import { SettingsCard } from "./settings-card"

export function HolidaysCard({ isAdmin }: { isAdmin: boolean }) {
  const toast = useToast()
  const confirm = useConfirm()
  const holidays = useHolidays()
  const create = useCreateHoliday()
  const remove = useDeleteHoliday()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", date: "", recurring: true })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await create.mutateAsync(form)
      toast.success(`${form.name} added`)
      setForm({ name: "", date: "", recurring: true })
      setShowForm(false)
    } catch (error) {
      toast.error(errorMessage(error, "Failed to add holiday"))
    }
  }

  const del = async (id: string, name: string) => {
    if (!(await confirm({ title: `Remove ${name}?`, confirmLabel: "Remove", destructive: true }))) return
    try {
      await remove.mutateAsync(id)
      toast.success("Holiday removed")
    } catch (error) {
      toast.error(errorMessage(error, "Failed to remove holiday"))
    }
  }

  return (
    <SettingsCard
      icon={CalendarDays}
      title="Holidays"
      description="Company holidays and special days"
      action={
        isAdmin && !showForm ? (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        ) : undefined
      }
    >
      {showForm && (
        <form onSubmit={submit} className="p-3 border rounded-lg bg-muted/50 space-y-3">
          <div className="space-y-1">
            <Label htmlFor="holiday-name">Name</Label>
            <Input id="holiday-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={100} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="holiday-date">Date</Label>
            <Input id="holiday-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.checked })} />
            Recurring yearly
          </label>
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={create.isPending}>
              {create.isPending ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" type="button" variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <ul className="space-y-2 max-h-48 overflow-y-auto">
        {(holidays.data ?? []).map((h) => (
          <li key={h.id} className="flex items-center justify-between p-2 border rounded">
            <div>
              <p className="font-medium text-sm">{h.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateOnly(h.date, "short")}
                {h.isRecurring && " (yearly)"}
              </p>
            </div>
            {isAdmin && (
              <Button variant="ghost" size="sm" aria-label={`Remove ${h.name}`} onClick={() => del(h.id, h.name)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </li>
        ))}
        {holidays.isSuccess && holidays.data.length === 0 && (
          <li className="text-center text-muted-foreground py-4 text-sm">No holidays configured</li>
        )}
      </ul>
    </SettingsCard>
  )
}
