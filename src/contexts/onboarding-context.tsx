"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"

interface OnboardingChecklist {
  addWorkers: boolean
  createCrews: boolean
  setupPatterns: boolean
  generateSchedules: boolean
}

interface OnboardingStats {
  workers: number
  crews: number
  schedules: number
  patterns: number
}

interface OnboardingState {
  hasSeenWelcome: boolean
  hasCompletedTour: boolean
  onboardingProgress: Record<string, unknown>
  checklist: OnboardingChecklist
  completedSteps: number
  totalSteps: number
  isOnboardingComplete: boolean
  stats: OnboardingStats
}

interface OnboardingContextValue {
  state: OnboardingState | null
  loading: boolean
  showWelcomeModal: boolean
  showTour: boolean
  dismissWelcome: () => Promise<void>
  completeTour: () => Promise<void>
  startTour: () => void
  refreshOnboarding: () => Promise<void>
  updateProgress: (progress: Record<string, unknown>) => Promise<void>
}

const defaultState: OnboardingState = {
  hasSeenWelcome: true,
  hasCompletedTour: true,
  onboardingProgress: {},
  checklist: {
    addWorkers: false,
    createCrews: false,
    setupPatterns: false,
    generateSchedules: false,
  },
  completedSteps: 0,
  totalSteps: 4,
  isOnboardingComplete: false,
  stats: {
    workers: 0,
    crews: 0,
    schedules: 0,
    patterns: 0,
  },
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined)

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OnboardingState | null>(null)
  const [loading, setLoading] = useState(true)
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)
  const [showTour, setShowTour] = useState(false)

  const fetchOnboardingState = useCallback(async () => {
    try {
      const response = await fetch("/api/onboarding")
      const result = await response.json()

      if (result.success) {
        setState(result.data)

        // Show welcome modal if user hasn't seen it
        if (!result.data.hasSeenWelcome) {
          setShowWelcomeModal(true)
        }
      }
    } catch (error) {
      console.error("Failed to fetch onboarding state:", error)
      setState(defaultState)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOnboardingState()
  }, [fetchOnboardingState])

  const dismissWelcome = useCallback(async () => {
    setShowWelcomeModal(false)
    try {
      await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hasSeenWelcome: true }),
      })
      setState((prev) => prev ? { ...prev, hasSeenWelcome: true } : prev)
    } catch (error) {
      console.error("Failed to dismiss welcome:", error)
    }
  }, [])

  const completeTour = useCallback(async () => {
    setShowTour(false)
    try {
      await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hasCompletedTour: true }),
      })
      setState((prev) => prev ? { ...prev, hasCompletedTour: true } : prev)
    } catch (error) {
      console.error("Failed to complete tour:", error)
    }
  }, [])

  const startTour = useCallback(() => {
    setShowTour(true)
  }, [])

  const updateProgress = useCallback(async (progress: Record<string, unknown>) => {
    try {
      await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingProgress: progress }),
      })
      setState((prev) =>
        prev
          ? {
              ...prev,
              onboardingProgress: { ...prev.onboardingProgress, ...progress },
            }
          : prev
      )
    } catch (error) {
      console.error("Failed to update progress:", error)
    }
  }, [])

  const refreshOnboarding = useCallback(async () => {
    await fetchOnboardingState()
  }, [fetchOnboardingState])

  return (
    <OnboardingContext.Provider
      value={{
        state,
        loading,
        showWelcomeModal,
        showTour,
        dismissWelcome,
        completeTour,
        startTour,
        refreshOnboarding,
        updateProgress,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (context === undefined) {
    throw new Error("useOnboarding must be used within an OnboardingProvider")
  }
  return context
}
