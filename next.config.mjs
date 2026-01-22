import { withSentryConfig } from "@sentry/nextjs"

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output standalone for optimal Railway/Docker deployment
  output: "standalone",

  // Enable instrumentation hook for automatic database migrations
  experimental: {
    instrumentationHook: true,
  },

  // Include Prisma client in standalone output
  // This is required for Prisma to work correctly in containerized deployments
  outputFileTracingIncludes: {
    "/api/**/*": ["./node_modules/.prisma/**/*"],
    "/": ["./node_modules/.prisma/**/*"],
  },

  // Optimize images
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },

  // Enable strict mode for better error catching
  reactStrictMode: true,

  // Disable x-powered-by header for security
  poweredByHeader: false,

  // Environment variables available to the browser
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXTAUTH_URL,
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ]
  },

  // Compress output
  compress: true,

  // Production optimizations
  ...(process.env.NODE_ENV === "production" && {
    compiler: {
      removeConsole: {
        exclude: ["error", "warn"],
      },
    },
  }),
}

const sentryConfig = {
  // Suppresses source map uploading logs during build
  silent: true,

  // Upload source maps only in production
  disableServerWebpackPlugin: process.env.NODE_ENV !== "production",
  disableClientWebpackPlugin: process.env.NODE_ENV !== "production",

  // Hides source maps from users
  hideSourceMaps: true,

  // Disable Sentry telemetry
  telemetry: false,
}

export default withSentryConfig(nextConfig, sentryConfig)
