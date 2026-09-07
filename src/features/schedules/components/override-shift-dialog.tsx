"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import { errorMessage } from "@/lib/api-client"
import { formatDateRange } from "@/lib/dates"
import { useBulkSetShift } from "../hooks"
import { ASSIGNABLE_SHIFT_KEYS, shiftKeyToApi, type ShiftKey, type ShiftStyle } from "../shift-styles"

interface OverrideShiftDialogProps {
  open: boolean
  onClose: () => void
  worker: { id: string; name: string | null } | null
  /** YYYY-MM-DD the user clicked; pre-fills both ends of the range */
  date: string | null
  styles: Record<ShiftKey, ShiftStyle>
}

/**
 * Set a shift for one worker over a date range. One request for the whole
 * range (POST /api/schedules/bulk); the rows become overrides that survive
 * regeneration.
 */
export function OverrideShiftDialog({ open, onClose, worker, date, styles }: OverrideShiftDialogProps) {
  // Keyed remount by the page resets these when the target changes
  const [startDate, setStartDate] = useState(date ?? "")
  const [endDate, setEndDate] = useState(date ?? "")
  const [shiftKey, setShiftKey] = useState<ShiftKey>("SICK")
  const [reason, setReason] = useState("")
  const toast = useToast()
  const bulk = useBulkSetShift()

  const options: ShiftKey[] = [
    ...ASSIGNABLE_SHIFT_KEYS,
    ...Object.keys(styles).filter((k) => k.startsWith("CUSTOM:")),
  ]
  const quick: ShiftKey[] = ["SICK", "VACATION", "LEAVE", "OFF", "DAY", "NIGHT", ...options.filter((k) => k.startsWith("CUSTOM:"))]

  const save = async () => {
    if (!worker || !startDate || !endDate) return
    if (endDate < startDate) {
      toast.error("End date must be on or after start date")
      return
    }
    try {
      const { data } = await bulk.mutateAsync({
        userId: worker.id,
        startDate,
        endDate,
        ...shiftKeyToApi(shiftKey),
        overrideReason: reason || null,
      })
      toast.success(`${worker.name ?? "Worker"}: ${data.days} day(s) set to ${styles[shiftKey]?.name ?? shiftKey}`)
      onClose()
    } catch (error) {
      toast.error(errorMessage(error, "Failed to update schedule"))
    }
  }

  return (
    <Modal isOpen={open} onClose={onClose} title="Update Schedule" description={worker?.name ?? undefined}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="override-start">Start Date</Label>
            <Input id="override-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="override-end">End Date</Label>
            <Input id="override-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate || undefined} />
          </div>
        </div>
        {startDate && endDate && endDate >= startDate && (
          <p className="text-xs text-muted-foreground">{formatDateRange(startDate, endDate)}</p>
        )}

        <div className="space-y-2">
          <Label htmlFor="override-shift">Shift Type</Label>
          <Select
            id="override-shift"
            value={shiftKey}
            onChange={(e) => setShiftKey(e.target.value)}
            options={options.map((k) => ({ value: k, label: `${styles[k]?.name ?? k} (${styles[k]?.label ?? k})` }))}
          />
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium">Quick Select</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Quick select shift">
            {quick.map((k) => {
              const st = styles[k]
              const active = shiftKey === k
              return (
                <Button
                  key={k}
                  type="button"
                  variant="outline"
                  size="sm"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setShiftKey(k)}
                  className={cn("transition-all", active && "ring-2 ring-offset-2 ring-blue-500")}
                  style={active && st ? { backgroundColor: st.bg, color: st.text } : undefined}
                >
                  {st?.name ?? k}
                </Button>
              )
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="override-reason">Reason (optional)</Label>
          <Input
            id="override-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Doctor's appointment, family vacation"
            maxLength={500}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={bulk.isPending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={bulk.isPending || !startDate || !endDate}>
            {bulk.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating…
              </>
            ) : (
              "Update Schedule"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
