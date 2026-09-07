"use client"

import { useEffect, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Minimize2 } from "lucide-react"
import { Button } from "./button"

interface FullscreenPanelProps {
  open: boolean
  onClose: () => void
  /** Shown in the slim top bar, left of the exit button */
  toolbar?: ReactNode
  children: ReactNode
}

/**
 * Fills the viewport with one thing and nothing else — no sidebar, no header,
 * no page chrome. Escape exits, as does the button.
 *
 * Rendered through a portal so it escapes the dashboard layout's own
 * scrolling and stacking contexts, which would otherwise clip it.
 */
export function FullscreenPanel({ open, onClose, toolbar, children }: FullscreenPanelProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    // Stop the page behind from scrolling while the panel owns the screen
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener("keydown", onKey)
    }
  }, [open, onClose])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true" aria-label="Full screen view">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">{toolbar}</div>
        <Button variant="outline" size="sm" onClick={onClose} className="shrink-0">
          <Minimize2 className="h-4 w-4 mr-1" />
          Exit
          <kbd className="ml-2 hidden rounded border px-1 text-[10px] text-muted-foreground sm:inline">Esc</kbd>
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>,
    document.body
  )
}
