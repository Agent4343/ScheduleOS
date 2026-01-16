"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import type { Schedule, Worker, Crew, RotationPattern } from "../schedule-types"
import { getDaysInYear, groupDaysByMonth } from "../schedule-utils"

interface UseScheduleDataOptions {
  currentYear: number
  selectedCrew: string
}

interface UseScheduleDataReturn {
  // Data
  schedules: Schedule[]
  workers: Worker[]
  crews: Crew[]
  rotationPatterns: RotationPattern[]

  // Computed
  yearDays: Date[]
  monthGroups: { month: number; days: Date[] }[]
  schedulesByUser: Map<string, Map<string, Schedule>>
  sortedWorkers: Worker[]

  // State
  loading: boolean

  // Actions
  setSchedules: (schedules: Schedule[]) => void
  setWorkers: (workers: Worker[]) => void
  updateWorker: (worker: Worker) => void
}

export function useScheduleData({
  currentYear,
  selectedCrew,
}: UseScheduleDataOptions): UseScheduleDataReturn {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [rotationPatterns, setRotationPatterns] = useState<RotationPattern[]>([])
  const [loading, setLoading] = useState(true)

  // Computed: days in the year
  const yearDays = useMemo(() => getDaysInYear(currentYear), [currentYear])

  // Computed: group days by month for header
  const monthGroups = useMemo(() => groupDaysByMonth(yearDays), [yearDays])

  // Computed: group schedules by user
  const schedulesByUser = useMemo(() => {
    const map = new Map<string, Map<string, Schedule>>()

    for (const schedule of schedules) {
      if (!map.has(schedule.user.id)) {
        map.set(schedule.user.id, new Map())
      }
      // Date is already YYYY-MM-DD from API, but handle both formats
      const dateKey = schedule.date.includes("T")
        ? schedule.date.split("T")[0]
        : schedule.date
      map.get(schedule.user.id)!.set(dateKey, schedule)
    }

    return map
  }, [schedules])

  // Computed: sort workers by crew name, then position, then name
  const sortedWorkers = useMemo(() => {
    return [...workers].sort((a, b) => {
      const crewCompare = (a.crew?.name || "ZZZ").localeCompare(b.crew?.name || "ZZZ")
      if (crewCompare !== 0) return crewCompare
      const posCompare = (a.position || "ZZZ").localeCompare(b.position || "ZZZ")
      if (posCompare !== 0) return posCompare
      return (a.name || "").localeCompare(b.name || "")
    })
  }, [workers])

  // Fetch crews (once on mount)
  useEffect(() => {
    async function fetchCrews() {
      try {
        const response = await fetch("/api/crews")
        const result = await response.json()
        if (result.success) {
          setCrews(result.data)
        }
      } catch (error) {
        console.error("Failed to fetch crews:", error)
      }
    }
    fetchCrews()
  }, [])

  // Fetch rotation patterns (once on mount)
  useEffect(() => {
    async function fetchPatterns() {
      try {
        const response = await fetch("/api/rotation-patterns")
        const result = await response.json()
        if (result.success) {
          setRotationPatterns(result.data)
        }
      } catch (error) {
        console.error("Failed to fetch rotation patterns:", error)
      }
    }
    fetchPatterns()
  }, [])

  // Fetch workers (when crew filter changes)
  useEffect(() => {
    async function fetchWorkers() {
      try {
        let url = "/api/users?status=ACTIVE"
        if (selectedCrew) {
          url += `&crewId=${selectedCrew}`
        }
        const response = await fetch(url)
        const result = await response.json()
        if (result.success) {
          setWorkers(result.data)
        }
      } catch (error) {
        console.error("Failed to fetch workers:", error)
      }
    }
    fetchWorkers()
  }, [selectedCrew])

  // Fetch schedules for the year (when year or crew filter changes)
  useEffect(() => {
    async function fetchSchedules() {
      setLoading(true)
      try {
        const startDate = `${currentYear}-01-01`
        const endDate = `${currentYear}-12-31`

        let url = `/api/schedules?startDate=${startDate}&endDate=${endDate}`
        if (selectedCrew) {
          url += `&crewId=${selectedCrew}`
        }

        const response = await fetch(url)
        const result = await response.json()
        if (result.success) {
          setSchedules(result.data)
        } else {
          console.error("Failed to fetch schedules:", result.error)
        }
      } catch (error) {
        console.error("Failed to fetch schedules:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchSchedules()
  }, [currentYear, selectedCrew])

  // Helper to update a single worker in the list
  const updateWorker = useCallback((updatedWorker: Worker) => {
    setWorkers((prev) =>
      prev.map((w) => (w.id === updatedWorker.id ? updatedWorker : w))
    )
  }, [])

  return {
    // Data
    schedules,
    workers,
    crews,
    rotationPatterns,

    // Computed
    yearDays,
    monthGroups,
    schedulesByUser,
    sortedWorkers,

    // State
    loading,

    // Actions
    setSchedules,
    setWorkers,
    updateWorker,
  }
}
