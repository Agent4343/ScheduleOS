import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(_req) {
    const response = NextResponse.next()

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
      response.headers.set(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.ingest.sentry.io https://*.sentry.io"
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
          "/api/register",
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
