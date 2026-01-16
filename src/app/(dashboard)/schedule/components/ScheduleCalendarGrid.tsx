"use client"

import { forwardRef } from "react"
import { cn } from "@/lib/utils"
import { Pencil } from "lucide-react"
import { SHIFT_COLORS, SHIFT_ABBREV } from "../schedule-constants"
import { getMonthName, getPositionColor, formatDateKey } from "../schedule-utils"
import type { Worker, Schedule } from "../schedule-types"

interface ScheduleCalendarGridProps {
  yearDays: Date[]
  monthGroups: { month: number; days: Date[] }[]
  sortedWorkers: Worker[]
  schedulesByUser: Map<string, Map<string, Schedule>>
  today: Date
  onWorkerClick: (worker: Worker) => void
}

export const ScheduleCalendarGrid = forwardRef<HTMLDivElement, ScheduleCalendarGridProps>(
  function ScheduleCalendarGrid(
    { yearDays, monthGroups, sortedWorkers, schedulesByUser, today, onWorkerClick },
    scrollRef
  ) {
    return (
      <div className="relative">
        <div className="flex">
          {/* Fixed left column for worker info */}
          <WorkerColumn workers={sortedWorkers} onWorkerClick={onWorkerClick} />

          {/* Scrollable calendar grid */}
          <div ref={scrollRef} className="overflow-x-auto flex-1">
            <div className="inline-block min-w-max">
              <MonthHeaders monthGroups={monthGroups} />
              <DayHeaders yearDays={yearDays} today={today} />
              <ScheduleRows
                sortedWorkers={sortedWorkers}
                yearDays={yearDays}
                schedulesByUser={schedulesByUser}
                today={today}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }
)

// Sub-component for the fixed worker column
interface WorkerColumnProps {
  workers: Worker[]
  onWorkerClick: (worker: Worker) => void
}

function WorkerColumn({ workers, onWorkerClick }: WorkerColumnProps) {
  return (
    <div className="sticky left-0 z-20 bg-background border-r shadow-sm">
      {/* Header for worker column - matches month (h-10) + day headers (h-12) */}
      <div className="h-[88px] border-b flex items-end p-3 bg-muted/50">
        <span className="font-semibold text-base">Worker</span>
      </div>
      {/* Worker rows */}
      {workers.map((worker) => (
        <div
          key={worker.id}
          className="h-12 border-b flex items-center px-3 min-w-[180px] hover:bg-muted/50 cursor-pointer group"
          onClick={() => onWorkerClick(worker)}
        >
          <div
            className={cn(
              "w-3 h-10 rounded-full mr-3 flex-shrink-0",
              getPositionColor(worker.position)
            )}
            title={worker.position || "No position"}
          />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-base truncate">{worker.name || "Unnamed"}</p>
            <p className="text-sm text-muted-foreground truncate">
              {worker.crew?.name || "No crew"}
            </p>
          </div>
          <Pencil className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-2" />
        </div>
      ))}
    </div>
  )
}

// Sub-component for month headers
interface MonthHeadersProps {
  monthGroups: { month: number; days: Date[] }[]
}

function MonthHeaders({ monthGroups }: MonthHeadersProps) {
  return (
    <div className="flex h-10 border-b bg-muted/30">
      {monthGroups.map(({ month, days }) => (
        <div
          key={month}
          className="text-center text-sm font-semibold border-r flex items-center justify-center"
          style={{ width: `${days.length * 48}px` }}
        >
          {getMonthName(month)}
        </div>
      ))}
    </div>
  )
}

// Sub-component for day headers
interface DayHeadersProps {
  yearDays: Date[]
  today: Date
}

function DayHeaders({ yearDays, today }: DayHeadersProps) {
  return (
    <div className="flex h-12 border-b">
      {yearDays.map((day) => {
        const isToday = day.getTime() === today.getTime()
        const isWeekend = day.getDay() === 0 || day.getDay() === 6
        const isFirstOfMonth = day.getDate() === 1

        return (
          <div
            key={day.toISOString()}
            className={cn(
              "w-12 text-center text-sm flex flex-col items-center justify-center",
              isWeekend && "bg-muted/50",
              isToday && "bg-primary/20 font-bold",
              isFirstOfMonth && "border-l border-gray-300"
            )}
          >
            <span className="text-muted-foreground">
              {day.toLocaleDateString("en-US", { weekday: "narrow" })}
            </span>
            <span className={cn(isToday && "text-primary")}>
              {day.getDate()}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// Sub-component for schedule rows
interface ScheduleRowsProps {
  sortedWorkers: Worker[]
  yearDays: Date[]
  schedulesByUser: Map<string, Map<string, Schedule>>
  today: Date
}

function ScheduleRows({ sortedWorkers, yearDays, schedulesByUser, today }: ScheduleRowsProps) {
  return (
    <>
      {sortedWorkers.map((worker) => {
        const userSchedules = schedulesByUser.get(worker.id)

        return (
          <div key={worker.id} className="flex h-12 border-b hover:bg-muted/30">
            {yearDays.map((day) => (
              <ScheduleCell
                key={formatDateKey(day)}
                day={day}
                schedule={userSchedules?.get(formatDateKey(day))}
                workerName={worker.name}
                today={today}
              />
            ))}
          </div>
        )
      })}
    </>
  )
}

// Sub-component for individual schedule cell
interface ScheduleCellProps {
  day: Date
  schedule: Schedule | undefined
  workerName: string | null
  today: Date
}

function ScheduleCell({ day, schedule, workerName, today }: ScheduleCellProps) {
  const isToday = day.getTime() === today.getTime()
  const isWeekend = day.getDay() === 0 || day.getDay() === 6
  const isFirstOfMonth = day.getDate() === 1
  const isOff = schedule?.shiftType === "OFF"
  const isWorking = schedule && (schedule.shiftType === "DAY" || schedule.shiftType === "NIGHT")

  return (
    <div
      className={cn(
        "w-12 h-12 flex items-center justify-center text-base font-bold border-r border-b",
        isFirstOfMonth && "border-l-2 border-l-gray-400",
        isToday && "ring-2 ring-primary ring-inset",
        schedule && !isOff
          ? cn(
              SHIFT_COLORS[schedule.shiftType].bg,
              SHIFT_COLORS[schedule.shiftType].text,
              isWorking && "border-white/20"
            )
          : cn(
              isWeekend ? "bg-gray-50" : "bg-white",
              "text-transparent"
            )
      )}
      title={schedule && !isOff ? `${schedule.shiftType} - ${workerName}` : "Off"}
    >
      {schedule && !isOff ? SHIFT_ABBREV[schedule.shiftType] : ""}
    </div>
  )
}
