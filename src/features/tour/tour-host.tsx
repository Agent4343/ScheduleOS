"use client"

import { useEffect, useState } from "react"
import { useTourState, useMarkTourSeen } from "./hooks"
import { WelcomeTour } from "./welcome-tour"

/**
 * Decides whether to play the walkthrough, and remembers that it has.
 *
 * Mounted once in the dashboard layout. Marking it seen is fire-and-forget:
 * if that write fails the worst case is that it plays again, which is much
 * better than blocking someone's first sign-in on it.
 */
export function TourHost() {
  const state = useTourState()
  const markSeen = useMarkTourSeen()
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (state.data && !state.data.hasSeenWelcome && !dismissed) setOpen(true)
  }, [state.data, dismissed])

  const close = () => {
    setOpen(false)
    setDismissed(true)
    markSeen.mutate()
  }

  if (!state.data) return null

  return (
    <WelcomeTour
      open={open}
      isStaff={state.data.role === "ADMIN" || state.data.role === "SUPERVISOR"}
      onClose={close}
    />
  )
}
