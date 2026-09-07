"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

/**
 * Catches errors thrown by the root layout, which (dashboard)/error.tsx
 * cannot reach. Must render its own <html> and <body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Something went wrong</h1>
        <p style={{ color: "#555", marginBottom: "1.5rem" }}>
          The error has been reported. Please try again.
        </p>
        <button
          onClick={() => reset()}
          style={{ padding: "0.6rem 1.2rem", borderRadius: 6, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
