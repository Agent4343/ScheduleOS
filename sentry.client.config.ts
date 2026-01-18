import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Performance monitoring
  tracesSampleRate: 0.1, // 10% of transactions

  // Session replay for debugging
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Filter out noisy errors
  ignoreErrors: [
    // Network errors
    "Failed to fetch",
    "NetworkError",
    "Load failed",
    // User-caused errors
    "ResizeObserver loop",
    // Auth errors (expected)
    "NEXT_NOT_FOUND",
  ],

  // Don't send PII
  beforeSend(event) {
    // Remove sensitive data
    if (event.request?.headers) {
      delete event.request.headers["authorization"]
      delete event.request.headers["cookie"]
    }
    return event
  },
})
