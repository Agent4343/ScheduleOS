import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import { isPublicPath } from "@/lib/public-paths"

export default withAuth(
  function middleware(req) {
    // ── CSRF origin check for state-changing requests ──────────────
    // Skip for Stripe webhooks (origin is Stripe servers, not browser)
    const { pathname } = req.nextUrl
    const method = req.method
    const isWebhook = pathname.startsWith("/api/stripe/webhook")
    if (!isWebhook && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      const origin = req.headers.get("origin")
      const host = req.headers.get("host")
      if (origin && host) {
        try {
          const originHost = new URL(origin).host
          if (originHost !== host) {
            return NextResponse.json(
              { error: "CSRF origin mismatch" },
              { status: 403 }
            )
          }
        } catch {
          return NextResponse.json(
            { error: "Invalid origin header" },
            { status: 403 }
          )
        }
      }
    }

    const response = NextResponse.next()

    // Security headers
    response.headers.set("X-Content-Type-Options", "nosniff")
    response.headers.set("X-Frame-Options", "DENY")
    response.headers.set("X-XSS-Protection", "1; mode=block")
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    )
    response.headers.set(
      "Permissions-Policy",
      "camera=(self), microphone=(), geolocation=()"
    )

    // CSP header for production
    if (process.env.NODE_ENV === "production") {
      response.headers.set(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.ingest.sentry.io https://*.sentry.io; frame-ancestors 'none'"
      )
    }

    return response
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl

        // The list lives in src/lib/public-paths.ts so it can be tested
        if (isPublicPath(pathname)) {
          return true
        }

        // Require a live token for protected paths. A token is marked
        // invalidated by the jwt callback when the account was deleted or
        // is no longer ACTIVE (see src/lib/auth.ts).
        return !!token && !token.invalidated
      },
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api/health (health check - must bypass auth for Railway)
     */
    "/((?!_next/static|_next/image|favicon.ico|public/|api/health).*)",
  ],
}
