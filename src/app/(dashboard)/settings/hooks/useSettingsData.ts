"use client"

import { useEffect, useState, useCallback } from "react"
import type { Organization, RotationPattern, Position, NewPatternForm } from "../settings-types"
import { INITIAL_PATTERN_FORM } from "../settings-constants"

interface UseSettingsDataReturn {
  // Data
  organization: Organization | null
  patterns: RotationPattern[]
  positions: Position[]

  // State
  loading: boolean
  saving: boolean
  message: string

  // Actions
  setOrganization: React.Dispatch<React.SetStateAction<Organization | null>>
  setPatterns: React.Dispatch<React.SetStateAction<RotationPattern[]>>
  setPositions: React.Dispatch<React.SetStateAction<Position[]>>
  setMessage: (message: string) => void
  showMessageBriefly: (message: string) => void
  saveOrganization: () => Promise<void>
  createPattern: (pattern: NewPatternForm) => Promise<boolean>
  refreshPositions: () => Promise<void>
}

export function useSettingsData(): UseSettingsDataReturn {
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [patterns, setPatterns] = useState<RotationPattern[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  // Fetch initial data
  useEffect(() => {
    async function fetchData() {
      try {
        const [orgRes, patternsRes, positionsRes] = await Promise.all([
          fetch("/api/organization"),
          fetch("/api/rotation-patterns"),
          fetch("/api/positions"),
        ])

        const orgData = await orgRes.json()
        const patternsData = await patternsRes.json()
        const positionsData = await positionsRes.json()

        if (orgData.success) setOrganization(orgData.data)
        if (patternsData.success) setPatterns(patternsData.data)
        if (positionsData.success) setPositions(positionsData.data)
      } catch (error) {
        console.error("Failed to fetch data:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Show a message that auto-clears after 3 seconds
  const showMessageBriefly = useCallback((msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(""), 3000)
  }, [])

  // Save organization settings
  const saveOrganization = useCallback(async () => {
    if (!organization) return

    setSaving(true)
    setMessage("")

    try {
      const response = await fetch("/api/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: organization.name,
          settings: organization.settings,
        }),
      })

      const data = await response.json()

      if (data.success) {
        showMessageBriefly("Settings saved successfully")
      } else {
        setMessage(data.error || "Failed to save settings")
      }
    } catch (error) {
      console.error("Failed to save:", error)
      setMessage("Failed to save settings")
    } finally {
      setSaving(false)
    }
  }, [organization, showMessageBriefly])

  // Create a new rotation pattern
  const createPattern = useCallback(
    async (newPattern: NewPatternForm): Promise<boolean> => {
      if (!newPattern.name || newPattern.daysOn <= 0 || newPattern.daysOff <= 0) {
        setMessage("Please fill in all pattern fields")
        return false
      }

      try {
        const response = await fetch("/api/rotation-patterns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newPattern.name,
            daysOn: newPattern.daysOn,
            daysOff: newPattern.daysOff,
            includesNights: newPattern.includesNights,
            nightsAtStart: true,
            nightDays: newPattern.daysOn,
          }),
        })

        const data = await response.json()

        if (response.ok) {
          setPatterns((prev) => [...prev, data.data])
          showMessageBriefly("Pattern created successfully!")
          return true
        } else {
          setMessage(data.error || "Failed to create pattern")
          return false
        }
      } catch (error) {
        console.error("Failed to create pattern:", error)
        setMessage("Failed to create pattern")
        return false
      }
    },
    [showMessageBriefly]
  )

  // Refresh positions from API
  const refreshPositions = useCallback(async () => {
    try {
      const positionsRes = await fetch("/api/positions")
      const positionsData = await positionsRes.json()
      if (positionsData.success) {
        setPositions(positionsData.data)
      }
    } catch (error) {
      console.error("Failed to refresh positions:", error)
    }
  }, [])

  return {
    // Data
    organization,
    patterns,
    positions,

    // State
    loading,
    saving,
    message,

    // Actions
    setOrganization,
    setPatterns,
    setPositions,
    setMessage,
    showMessageBriefly,
    saveOrganization,
    createPattern,
    refreshPositions,
  }
}
