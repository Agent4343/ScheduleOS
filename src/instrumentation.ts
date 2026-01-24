import * as Sentry from "@sentry/nextjs"

const sentryConfig = {
  dsn: process.env.SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
  ignoreErrors: ["NEXT_NOT_FOUND", "NEXT_REDIRECT"],
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init(sentryConfig)
    const { runAutoMigrations } = await import("./lib/auto-migrate")
    await runAutoMigrations()
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(sentryConfig)
  }
}
