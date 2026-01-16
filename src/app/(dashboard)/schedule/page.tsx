"use client"

import { useState, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Filter,
  Users,
} from "lucide-react"
import { ShiftType } from "@/types"

// Local imports
import { SHIFT_COLORS, SHIFT_ICONS, POSITION_COLORS } from "./schedule-constants"
import { useScheduleData } from "./hooks/useScheduleData"
import { ScheduleCalendarGrid } from "./components/ScheduleCalendarGrid"
import { WorkerEditModal } from "./components/WorkerEditModal"
import type { Worker, Schedule } from "./schedule-types"

export default function SchedulePage() {
  // UI State
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [selectedCrew, setSelectedCrew] = useState<string>("")
  const scrollRef = useRef<HTMLDivElement>(null!)

  // Modal state
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null)

  // Data hook
  const {
    schedules,
    crews,
    rotationPatterns,
    yearDays,
    monthGroups,
    schedulesByUser,
    sortedWorkers,
    loading,
    setSchedules,
    updateWorker,
  } = useScheduleData({ currentYear, selectedCrew })

  // Today's date (normalized to midnight)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Navigation handlers
  const navigateYear = useCallback((direction: number) => {
    setCurrentYear((year) => year + direction)
  }, [])

  const goToCurrentYear = useCallback(() => {
    setCurrentYear(new Date().getFullYear())
    // Scroll to today
    setTimeout(() => {
      const todayDate = new Date()
      const dayOfYear = Math.floor(
        (todayDate.getTime() - new Date(todayDate.getFullYear(), 0, 0).getTime()) / 86400000
      )
      if (scrollRef.current) {
        const cellWidth = 48 // approximate width per day
        scrollRef.current.scrollLeft = Math.max(0, (dayOfYear - 15) * cellWidth)
      }
    }, 100)
  }, [])

  // Modal handlers
  const openEditModal = useCallback((worker: Worker) => {
    setSelectedWorker(worker)
    setEditModalOpen(true)
  }, [])

  const closeEditModal = useCallback(() => {
    setEditModalOpen(false)
    setSelectedWorker(null)
  }, [])

  const handleWorkerUpdated = useCallback(
    (updatedWorker: Worker) => {
      updateWorker(updatedWorker)
    },
    [updateWorker]
  )

  const handleScheduleGenerated = useCallback(
    (generatedYear: number, newSchedules: Schedule[]) => {
      // Switch to the generated year if different from current view
      if (generatedYear !== currentYear) {
        setCurrentYear(generatedYear)
      }
      // Clear crew filter to ensure we see the worker's schedule
      setSelectedCrew("")
      setSchedules(newSchedules)
    },
    [currentYear, setSchedules]
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <ScheduleHeader
        currentYear={currentYear}
        workerCount={sortedWorkers.length}
        scheduleCount={schedules.length}
        onNavigateYear={navigateYear}
        onGoToCurrentYear={goToCurrentYear}
      />

      {/* Filters */}
      <CrewFilter
        crews={crews}
        selectedCrew={selectedCrew}
        onCrewChange={setSelectedCrew}
      />

      {/* Legend */}
      <ShiftLegend />

      {/* Schedule grid */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {currentYear} Schedule
            <Badge variant="secondary" className="ml-2">
              <Users className="h-3 w-3 mr-1" />
              {sortedWorkers.length} workers
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScheduleContent
            loading={loading}
            sortedWorkers={sortedWorkers}
            yearDays={yearDays}
            monthGroups={monthGroups}
            schedulesByUser={schedulesByUser}
            today={today}
            scrollRef={scrollRef}
            onWorkerClick={openEditModal}
          />
        </CardContent>
      </Card>

      {/* Position Color Legend */}
      <PositionColorLegend />

      {/* Edit Worker Modal */}
      <WorkerEditModal
        isOpen={editModalOpen}
        worker={selectedWorker}
        crews={crews}
        rotationPatterns={rotationPatterns}
        currentYear={currentYear}
        onClose={closeEditModal}
        onWorkerUpdated={handleWorkerUpdated}
        onScheduleGenerated={handleScheduleGenerated}
      />
    </div>
  )
}

// Sub-component: Schedule Header with navigation
interface ScheduleHeaderProps {
  currentYear: number
  workerCount: number
  scheduleCount: number
  onNavigateYear: (direction: number) => void
  onGoToCurrentYear: () => void
}

function ScheduleHeader({
  currentYear,
  workerCount,
  scheduleCount,
  onNavigateYear,
  onGoToCurrentYear,
}: ScheduleHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-2xl font-bold">Yearly Schedule</h1>
        <p className="text-muted-foreground">
          {currentYear} Annual View - {workerCount} Workers - {scheduleCount} schedule entries
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onGoToCurrentYear}>
          Today
        </Button>
        <Button variant="outline" size="icon" onClick={() => onNavigateYear(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-semibold px-2">{currentYear}</span>
        <Button variant="outline" size="icon" onClick={() => onNavigateYear(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// Sub-component: Crew Filter
interface CrewFilterProps {
  crews: { id: string; name: string }[]
  selectedCrew: string
  onCrewChange: (crewId: string) => void
}

function CrewFilter({ crews, selectedCrew, onCrewChange }: CrewFilterProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Filter:</span>
      </div>
      <Select
        value={selectedCrew}
        onChange={(e) => onCrewChange(e.target.value)}
        options={[
          { value: "", label: "All Crews" },
          ...crews.map((crew) => ({ value: crew.id, label: crew.name })),
        ]}
        className="w-40"
      />
    </div>
  )
}

// Sub-component: Shift Legend
function ShiftLegend() {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(SHIFT_COLORS)
        .filter(([type]) => type !== "OFF")
        .map(([type, colors]) => (
          <Badge key={type} className={cn(colors.bg, colors.text, colors.border, "border text-xs")}>
            {SHIFT_ICONS[type as ShiftType]}
            <span className="ml-1">{type}</span>
          </Badge>
        ))}
    </div>
  )
}

// Sub-component: Schedule Content (loading/empty/grid)
interface ScheduleContentProps {
  loading: boolean
  sortedWorkers: Worker[]
  yearDays: Date[]
  monthGroups: { month: number; days: Date[] }[]
  schedulesByUser: Map<string, Map<string, Schedule>>
  today: Date
  scrollRef: React.RefObject<HTMLDivElement>
  onWorkerClick: (worker: Worker) => void
}

function ScheduleContent({
  loading,
  sortedWorkers,
  yearDays,
  monthGroups,
  schedulesByUser,
  today,
  scrollRef,
  onWorkerClick,
}: ScheduleContentProps) {
  if (loading) {
    return (
      <div className="animate-pulse space-y-2 p-4">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-8 bg-muted rounded" />
        ))}
      </div>
    )
  }

  if (sortedWorkers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No workers found</p>
        <p className="text-sm">Add workers to see their schedules</p>
      </div>
    )
  }

  return (
    <ScheduleCalendarGrid
      ref={scrollRef}
      yearDays={yearDays}
      monthGroups={monthGroups}
      sortedWorkers={sortedWorkers}
      schedulesByUser={schedulesByUser}
      today={today}
      onWorkerClick={onWorkerClick}
    />
  )
}

// Sub-component: Position Color Legend
function PositionColorLegend() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Position Colors</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {Object.entries(POSITION_COLORS)
            .filter(([key]) => key !== "default")
            .map(([position, color]) => (
              <div key={position} className="flex items-center gap-1">
                <div className={cn("w-3 h-3 rounded-full", color)} />
                <span className="text-xs text-muted-foreground">{position}</span>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  )
}
