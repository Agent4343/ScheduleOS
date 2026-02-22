import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

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

        // Public paths that don't require authentication
        const publicPaths = [
          "/login",
          "/register",
          "/pricing",
          "/api/auth",
          "/api/health",
          "/api/setup",
          "/api/register",
          "/api/stripe",
        ]

        // Check if the path is public
        const isPublicPath = publicPaths.some(
          (path) => pathname.startsWith(path) || pathname === "/"
        )

        if (isPublicPath) {
          return true
        }

        // Require token for protected paths
        return !!token
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
     * - api/setup (database setup - must work before auth is configured)
     * - api/migrate (database migrations - must work before auth is configured)
     */
    "/((?!_next/static|_next/image|favicon.ico|public/|api/health|api/setup|api/migrate).*)",
  ],
}
