"use client"

import { memo, useMemo } from "react"
import { Pencil } from "lucide-react"
import { cn } from "@/lib/utils"
import { todayKey } from "@/lib/dates"
import type { Schedule } from "@/features/types"
import { shiftKeyOf, type ShiftKey, type ShiftStyle } from "../shift-styles"

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export interface GridWorker {
  id: string
  name: string | null
  crew: { id: string; name: string; color: string } | null
}

interface DayInfo {
  key: string // YYYY-MM-DD
  day: number
  isWeekend: boolean
  isToday: boolean
}

interface MonthInfo {
  month: number
  days: DayInfo[]
}

function buildYear(year: number): MonthInfo[] {
  const today = todayKey()
  return Array.from({ length: 12 }, (_, month) => {
    const count = new Date(year, month + 1, 0).getDate()
    const days = Array.from({ length: count }, (_, i) => {
      const day = i + 1
      const dow = new Date(year, month, day).getDay()
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      return { key, day, isWeekend: dow === 0 || dow === 6, isToday: key === today }
    })
    return { month, days }
  })
}

interface DayCellProps {
  shiftKey: ShiftKey | null
  style: ShiftStyle | null
  isWeekend: boolean
  isToday: boolean
  editable: boolean
  onClick?: () => void
}

/** One day for one worker. Memoised: the grid has ~18k of these. */
const DayCell = memo(function DayCell({ shiftKey, style, isWeekend, isToday, editable, onClick }: DayCellProps) {
  const isOff = shiftKey === "OFF"
  const painted = style && !isOff
  const label = shiftKey ? (isOff ? "Off" : style?.name ?? shiftKey) : "No shift"
  return (
    <td
      className={cn(
        "border text-center w-8 min-w-[32px] h-8 transition-all",
        editable && "cursor-pointer hover:ring-2 hover:ring-blue-300 dark:hover:ring-blue-500 hover:ring-inset",
        !painted && (isWeekend ? "bg-muted/50" : "bg-background dark:bg-gray-900/50"),
        isToday && "ring-2 ring-blue-400 ring-inset"
      )}
      style={painted ? { backgroundColor: style.bg, color: style.text } : undefined}
      title={editable ? `${label} – click to edit` : label}
      onClick={editable ? onClick : undefined}
      role={editable ? "button" : undefined}
      tabIndex={editable ? 0 : undefined}
      onKeyDown={editable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.() } } : undefined}
    >
      <span className="text-xs font-bold">{painted ? style.label : ""}</span>
    </td>
  )
})

interface ScheduleGridProps {
  year: number
  workers: GridWorker[]
  schedules: Schedule[]
  styles: Record<ShiftKey, ShiftStyle>
  editable: boolean
  onWorkerClick?: (worker: GridWorker) => void
  onDayClick?: (worker: GridWorker, dateKey: string) => void
}

/**
 * The year-at-a-glance table: one row per worker, one column per day.
 * Pure presentation — data and dialogs are the page's business.
 */
export function ScheduleGrid({ year, workers, schedules, styles, editable, onWorkerClick, onDayClick }: ScheduleGridProps) {
  const months = useMemo(() => buildYear(year), [year])

  // (userId, YYYY-MM-DD) → shift key
  const lookup = useMemo(() => {
    const map = new Map<string, ShiftKey>()
    for (const s of schedules) map.set(`${s.userId}|${s.date.slice(0, 10)}`, shiftKeyOf(s))
    return map
  }, [schedules])

  return (
    <div className="overflow-x-auto max-h-[80vh] overflow-y-auto">
      <table
        className="border-collapse text-sm [&_td]:border-gray-200 [&_th]:border-gray-200 dark:[&_td]:border-gray-700 dark:[&_th]:border-gray-700"
        style={{ minWidth: "max-content" }}
      >
        <thead className="sticky top-0 z-30 bg-background shadow-[0_2px_5px_-2px_rgba(0,0,0,0.15)] dark:shadow-[0_2px_5px_-2px_rgba(255,255,255,0.1)]">
          <tr>
            <th scope="col" className="border p-2 text-left font-semibold sticky left-0 bg-muted z-40 min-w-[200px]">
              Worker
            </th>
            {months.map(({ month, days }) => (
              <th key={month} scope="colgroup" colSpan={days.length} className="border p-2 text-center font-semibold bg-muted text-base">
                {MONTH_NAMES[month]}
              </th>
            ))}
          </tr>
          <tr>
            <th className="border p-1 sticky left-0 bg-muted/50 z-40" />
            {months.map(({ month, days }) =>
              days.map((d) => (
                <th
                  key={`${month}-${d.day}`}
                  scope="col"
                  className={cn(
                    "border p-1 text-center font-normal w-8 min-w-[32px]",
                    d.isWeekend ? "bg-muted" : "bg-muted/50",
                    d.isToday && "bg-blue-200 dark:bg-blue-900 font-bold"
                  )}
                >
                  <div className={cn("text-sm font-semibold text-foreground", d.isToday && "text-blue-600 dark:text-blue-300")}>{d.day}</div>
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {workers.map((worker) => (
            <tr key={worker.id} className="hover:bg-muted/20">
              <th
                scope="row"
                className={cn(
                  "border p-2 text-left font-normal sticky left-0 bg-background z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_5px_-2px_rgba(255,255,255,0.1)]",
                  editable && onWorkerClick && "cursor-pointer hover:bg-muted/50"
                )}
                onClick={editable && onWorkerClick ? () => onWorkerClick(worker) : undefined}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-8 rounded" style={{ backgroundColor: worker.crew?.color || "#ccc" }} aria-hidden />
                  <div className="truncate max-w-[160px]">
                    <div className="font-medium truncate text-sm">{worker.name || "Unnamed"}</div>
                    <div className="text-xs text-muted-foreground truncate">{worker.crew?.name || "No crew"}</div>
                  </div>
                  {editable && onWorkerClick && <Pencil className="h-3 w-3 text-muted-foreground ml-auto flex-shrink-0" aria-hidden />}
                </div>
              </th>
              {months.map(({ month, days }) =>
                days.map((d) => {
                  const shiftKey = lookup.get(`${worker.id}|${d.key}`) ?? null
                  return (
                    <DayCell
                      key={`${month}-${d.day}`}
                      shiftKey={shiftKey}
                      style={shiftKey ? styles[shiftKey] ?? null : null}
                      isWeekend={d.isWeekend}
                      isToday={d.isToday}
                      editable={editable}
                      onClick={onDayClick ? () => onDayClick(worker, d.key) : undefined}
                    />
                  )
                })
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
