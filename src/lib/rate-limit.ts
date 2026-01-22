import { NextResponse } from "next/server"
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store (used when Redis is not configured)
const rateLimitStore = new Map<string, RateLimitEntry>()

const redisUrl = process.env.UPSTASH_REDIS_REST_URL
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN
const upstashRedis = redisUrl && redisToken
  ? new Redis({ url: redisUrl, token: redisToken })
  : null
const upstashLimiters = new Map<string, Ratelimit>()

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now()
  Array.from(rateLimitStore.entries()).forEach(([key, entry]) => {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  })
}, 60000) // Clean every minute

export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
}

function getUpstashLimiter(config: RateLimitConfig): Ratelimit | null {
  if (!upstashRedis) {
    return null
  }

  const key = `${config.windowMs}:${config.maxRequests}`
  const existing = upstashLimiters.get(key)
  if (existing) {
    return existing
  }

  const windowSeconds = Math.max(1, Math.ceil(config.windowMs / 1000))
  const limiter = new Ratelimit({
    redis: upstashRedis,
    limiter: Ratelimit.slidingWindow(config.maxRequests, `${windowSeconds} s`),
  })
  upstashLimiters.set(key, limiter)
  return limiter
}

function rateLimitInMemory(
  identifier: string,
  config: RateLimitConfig
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

export async function rateLimit(
  identifier: string,
  config: RateLimitConfig = defaultConfig
): Promise<{ success: boolean; remaining: number; resetIn: number }> {
  const limiter = getUpstashLimiter(config)
  if (!limiter) {
    return rateLimitInMemory(identifier, config)
  }

  const result = await limiter.limit(identifier)
  return {
    success: result.success,
    remaining: result.remaining,
    resetIn: Math.max(result.reset - Date.now(), 0),
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
