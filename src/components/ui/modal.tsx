"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
}

function Modal({ isOpen, onClose, title, description, children, className }: ModalProps) {
  const modalRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = "unset"
    }
  }, [isOpen, onClose])

  // Focus trap
  React.useEffect(() => {
    if (!isOpen || !modalRef.current) return

    const modal = modalRef.current
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    const firstFocusable = focusableElements[0]
    const lastFocusable = focusableElements[focusableElements.length - 1]

    function handleTab(e: KeyboardEvent) {
      if (e.key !== "Tab") return

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault()
          lastFocusable?.focus()
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault()
          firstFocusable?.focus()
        }
      }
    }

    document.addEventListener("keydown", handleTab)
    const timer = setTimeout(() => firstFocusable?.focus(), 50)

    return () => {
      document.removeEventListener("keydown", handleTab)
      clearTimeout(timer)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal content - slides up from bottom on mobile, centered on desktop */}
      <div
        ref={modalRef}
        className={cn(
          "relative z-50 w-full max-h-[85vh] sm:max-h-[90vh] flex flex-col bg-background shadow-lg",
          "rounded-t-xl sm:rounded-lg",
          "sm:max-w-lg sm:mx-4",
          "animate-in fade-in-0 zoom-in-95",
          "pb-[env(safe-area-inset-bottom)]",
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        aria-describedby={description ? "modal-description" : undefined}
      >
        {/* Drag handle indicator for mobile */}
        <div className="flex justify-center pt-2 sm:hidden" aria-hidden="true">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 sm:right-4 sm:top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>

        {/* Header */}
        {(title || description) && (
          <div className="px-4 sm:px-6 pt-3 sm:pt-6 pb-0 flex-shrink-0 pr-12">
            {title && (
              <h2 id="modal-title" className="text-lg font-semibold">
                {title}
              </h2>
            )}
            {description && (
              <p id="modal-description" className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-6 pt-4">
          {children}
        </div>
      </div>
    </div>
  )
}

export { Modal }
