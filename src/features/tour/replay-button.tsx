"use client"

import { useState } from "react"
import { PlayCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTourState } from "./hooks"
import { WelcomeTour } from "./welcome-tour"

/** Watch the walkthrough again, any time. */
export function ReplayTourButton() {
  const state = useTourState()
  const [open, setOpen] = useState(false)
  const isStaff = state.data?.role === "ADMIN" || state.data?.role === "SUPERVISOR"

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PlayCircle className="h-4 w-4 mr-1" />
        Play the walkthrough
      </Button>
      <WelcomeTour open={open} isStaff={isStaff} onClose={() => setOpen(false)} />
    </>
  )
}
