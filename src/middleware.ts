import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const nonceBytes = new Uint8Array(16)
    crypto.getRandomValues(nonceBytes)
    const nonce = btoa(String.fromCharCode(...nonceBytes))

    const requestHeaders = new Headers(req.headers)
    requestHeaders.set("x-nonce", nonce)

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })

    // Security headers
    response.headers.set("X-Content-Type-Options", "nosniff")
    response.headers.set("X-Frame-Options", "DENY")
    response.headers.set("X-XSS-Protection", "1; mode=block")
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.set(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()"
    )

    // CSP header for production
    if (process.env.NODE_ENV === "production") {
      const csp = [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}'`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "connect-src 'self' https://*.ingest.sentry.io https://*.sentry.io",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
      ].join("; ")

      response.headers.set(
        "Content-Security-Policy",
        csp
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
          "/api/auth",
          "/api/health",
          "/api/setup",
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
