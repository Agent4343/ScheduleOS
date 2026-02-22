"use client"

import { useState, useEffect } from "react"

const CONSENT_KEY = "shiftsync_cookie_consent"

type ConsentStatus = "accepted" | "rejected" | null

export function CookieConsent() {
  const [consent, setConsent] = useState<ConsentStatus>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem(CONSENT_KEY)
    if (stored === "accepted" || stored === "rejected") {
      setConsent(stored)
    }
  }, [])

  function accept() {
    localStorage.setItem(CONSENT_KEY, "accepted")
    setConsent("accepted")
  }

  function reject() {
    localStorage.setItem(CONSENT_KEY, "rejected")
    setConsent("rejected")
  }

  // Don't render during SSR or if user has already made a choice
  if (!mounted || consent !== null) {
    return null
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-4 shadow-lg"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 sm:flex-row">
        <p className="flex-1 text-sm text-muted-foreground">
          We use essential cookies for authentication and functionality.
          Analytics cookies help us improve ShiftSync.
          Read our{" "}
          <a href="/cookies" className="underline hover:text-foreground">
            Cookie Policy
          </a>{" "}
          for details.
        </p>
        <div className="flex gap-2">
          <button
            onClick={reject}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Reject non-essential
          </button>
          <button
            onClick={accept}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  )
}
