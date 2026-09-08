"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Pause, Play, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  CoverageIllustration,
  ImportIllustration,
  InviteIllustration,
  ScheduleIllustration,
  SignOffIllustration,
} from "./illustrations"

/**
 * The welcome walkthrough.
 *
 * It plays by itself like a video, but every step can be paused, stepped
 * through, or skipped — people read at very different speeds, and being
 * unable to stop a tour is worse than not having one.
 *
 * The illustrations are diagrams rather than screenshots on purpose: a
 * screenshot of a screen that has since changed teaches the wrong thing, and
 * nobody notices it has gone stale.
 */

const STEP_MS = 9000

interface TourStep {
  title: string
  body: React.ReactNode
  art: React.ReactNode
  /** Optional deep link offered at the end of this step */
  link?: { href: string; label: string }
}

const STAFF_STEPS: TourStep[] = [
  {
    title: "This replaces the roster spreadsheet",
    body: (
      <>
        <p>
          Everything your workbook does — who is on days, who is on nights, who is short — plus the parts a spreadsheet
          cannot do: people see their own shifts, request time off, and swap with each other.
        </p>
        <p className="text-muted-foreground">This takes about a minute. You can stop it at any point.</p>
      </>
    ),
    art: <ScheduleIllustration />,
  },
  {
    title: "Start from the spreadsheet you already have",
    body: (
      <>
        <p>
          Do not type anyone in. Upload your roster workbook and it reads the people, which block each one sits in, who
          is control-room trained, and every shift for the year.
        </p>
        <p>
          It shows you exactly what it found <em>before</em> saving anything, so you can check it read your sheet
          correctly.
        </p>
      </>
    ),
    art: <ImportIllustration />,
    link: { href: "/settings#import", label: "Import a spreadsheet" },
  },
  {
    title: "It knows what each shift needs",
    body: (
      <>
        <p>
          You tell it once: three outside operators minimum, four preferred, two in the control room, days and nights.
          After that every day is checked for you.
        </p>
        <p>
          Red is below the minimum and cannot run. Amber will run but is below what you asked for. Green is fine.
        </p>
      </>
    ),
    art: <CoverageIllustration />,
    link: { href: "/coverage", label: "See the coverage board" },
  },
  {
    title: "One person can only do one job",
    body: (
      <>
        <p>
          If a shift needs someone signed off on utilities, someone on oil and someone on gas, those have to be three
          different people.
        </p>
        <p>
          So a crew at full strength can still come up short — if your only gas operator is also your only oil operator,
          one of those jobs has nobody. Counting certificates misses that. This does not.
        </p>
      </>
    ),
    art: <SignOffIllustration />,
    link: { href: "/help#sign-off", label: "How sign-offs work" },
  },
  {
    title: "Getting your crew in",
    body: (
      <>
        <p>
          Send people an invitation link. They pick their own password and appear on your roster — you never have to
          invent one and read it out.
        </p>
        <p className="text-muted-foreground">
          Links last a week, work once, and can be withdrawn if you send one by mistake.
        </p>
      </>
    ),
    art: <InviteIllustration />,
    link: { href: "/workers", label: "Invite someone" },
  },
]

const WORKER_STEPS: TourStep[] = [
  {
    title: "Welcome",
    body: (
      <p>
        This is where your shifts live. You can see the whole year, check what you are on next, and put in for time off
        without chasing anybody.
      </p>
    ),
    art: <ScheduleIllustration />,
    link: { href: "/schedule", label: "See the schedule" },
  },
  {
    title: "Your shifts, and swapping them",
    body: (
      <>
        <p>
          Your own shifts are on the dashboard. If you need a day covered, ask someone directly through Shift Swaps —
          they accept, a supervisor approves, and both calendars update.
        </p>
        <p className="text-muted-foreground">Nothing changes on the schedule until it has been approved.</p>
      </>
    ),
    art: <InviteIllustration />,
    link: { href: "/shift-swaps", label: "Shift swaps" },
  },
]

interface WelcomeTourProps {
  open: boolean
  isStaff: boolean
  onClose: () => void
}

export function WelcomeTour({ open, isStaff, onClose }: WelcomeTourProps) {
  const steps = isStaff ? STAFF_STEPS : WORKER_STEPS
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const startedAt = useRef<number>(Date.now())

  const last = index === steps.length - 1

  const next = useCallback(() => {
    setIndex((i) => Math.min(i + 1, steps.length - 1))
    setElapsed(0)
    startedAt.current = Date.now()
  }, [steps.length])

  const back = useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0))
    setElapsed(0)
    startedAt.current = Date.now()
  }, [])

  // Advance on a timer, and drive the progress bar from the same clock so the
  // bar cannot drift out of step with the slide.
  useEffect(() => {
    if (!open || !playing) return
    startedAt.current = Date.now() - elapsed
    const tick = window.setInterval(() => {
      const spent = Date.now() - startedAt.current
      if (spent >= STEP_MS) {
        if (last) {
          setPlaying(false)
          setElapsed(STEP_MS)
        } else {
          next()
        }
      } else {
        setElapsed(spent)
      }
    }, 80)
    return () => window.clearInterval(tick)
    // `elapsed` is intentionally omitted: it is written by this effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, playing, index, last, next])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowRight") { setPlaying(false); next() }
      if (e.key === "ArrowLeft") { setPlaying(false); back() }
      if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p) }
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener("keydown", onKey)
    }
  }, [open, onClose, next, back])

  if (!open || typeof document === "undefined") return null

  const step = steps[index]
  const progress = Math.min(100, (elapsed / STEP_MS) * 100)

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Welcome walkthrough">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border bg-background shadow-2xl">
        {/* One segment per step; the current one fills as it plays */}
        <div className="flex gap-1 p-2" aria-hidden>
          {steps.map((_, i) => (
            <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full bg-primary", i === index && playing && "transition-[width] duration-100 ease-linear")}
                style={{ width: i < index ? "100%" : i === index ? `${progress}%` : "0%" }}
              />
            </div>
          ))}
        </div>

        <div className="flex items-start justify-between gap-4 px-5 pt-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Step {index + 1} of {steps.length}
            </p>
            <h2 className="text-xl font-semibold">{step.title}</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close the walkthrough">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-5 py-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-foreground">{step.art}</div>
          <div className="mt-4 space-y-2 text-sm">{step.body}</div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-5 py-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => { setPlaying(false); back() }} disabled={index === 0} aria-label="Previous step">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setPlaying(false); next() }} disabled={last} aria-label="Next step">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {step.link && (
              <Link href={step.link.href} onClick={onClose} className="text-sm underline underline-offset-4">
                {step.link.label}
              </Link>
            )}
            {last ? (
              <Button size="sm" onClick={onClose}>Get started</Button>
            ) : (
              <Button size="sm" variant="outline" onClick={onClose}>Skip</Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
