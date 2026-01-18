import { NextResponse } from "next/server"

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store (use Redis in production for multiple instances)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}, 60000) // Clean every minute

export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
}

export function rateLimit(
  identifier: string,
  config: RateLimitConfig = defaultConfig
): { success: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  const key = identifier

  let entry = rateLimitStore.get(key)

  // If no entry or expired, create new one
  if (!entry || entry.resetTime < now) {
    entry = {
      count: 1,
      resetTime: now + config.windowMs,
    }
    rateLimitStore.set(key, entry)
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs,
    }
  }

  // Increment count
  entry.count++

  // Check if over limit
  if (entry.count > config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetIn: entry.resetTime - now,
    }
  }

  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetIn: entry.resetTime - now,
  }
}

export function rateLimitResponse(resetIn: number): NextResponse {
  return NextResponse.json(
    {
      error: "Too many requests",
      message: "Please try again later",
      retryAfter: Math.ceil(resetIn / 1000),
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil(resetIn / 1000)),
        "X-RateLimit-Remaining": "0",
      },
    }
  )
}

// Helper to get client IP from request
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const realIP = request.headers.get("x-real-ip")

  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }

  if (realIP) {
    return realIP
  }

  return "unknown"
}

// Presets for different endpoints
export const rateLimitPresets = {
  // Strict limit for auth endpoints (prevent brute force)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts
  },
  // Standard API limit
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests
  },
  // Relaxed limit for read operations
  read: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200, // 200 requests
  },
  // Very strict for expensive operations
  expensive: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests
  },
}
