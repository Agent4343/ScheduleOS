import * as Sentry from "@sentry/nextjs"

/**
 * Next.js instrumentation hook. Runs once per server process at startup.
 *
 * With @sentry/nextjs v8 the server and edge configs are NOT picked up
 * automatically; they must be imported from here.
 *
 * Database migrations no longer run here. They are applied by
 * `prisma migrate deploy` before the server starts (see docs/DEPLOYMENT.md).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config")
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config")
  }
}

/** Capture errors thrown by React Server Components and route handlers. */
export const onRequestError = Sentry.captureRequestError
