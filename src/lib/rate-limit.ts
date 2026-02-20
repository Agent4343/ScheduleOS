import { NextResponse } from "next/server"
import { Redis } from "@upstash/redis"

interface RateLimitEntry {
  count: number
  resetTime: number
}

// ── Storage abstraction ──────────────────────────────────────────────
// Uses @upstash/redis SDK when configured, falls back to in-memory.
// Redis is required for multi-replica Railway deployments.

interface RateLimitStore {
  get(key: string): Promise<RateLimitEntry | null>
  set(key: string, entry: RateLimitEntry, ttlMs: number): Promise<void>
}

// ── Redis store (official @upstash/redis SDK) ────────────────────────
function createRedisStore(url: string, token: string): RateLimitStore {
  const redis = new Redis({ url, token })

  return {
    async get(key) {
      const raw = await redis.get<RateLimitEntry>(key)
      return raw ?? null
    },
    async set(key, entry, ttlMs) {
      await redis.set(key, entry, { px: ttlMs })
    },
  }
}

// ── In-memory store (single instance fallback) ───────────────────────
function createMemoryStore(): RateLimitStore {
  const map = new Map<string, RateLimitEntry>()

  // Clean up expired entries every minute
  setInterval(() => {
    const now = Date.now()
    map.forEach((entry, key) => {
      if (entry.resetTime < now) map.delete(key)
    })
  }, 60_000)

  return {
    async get(key) {
      return map.get(key) ?? null
    },
    async set(key, entry, _ttlMs) {
      map.set(key, entry)
    },
  }
}

// ── Pick the right store ─────────────────────────────────────────────
const store: RateLimitStore =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? createRedisStore(
        process.env.UPSTASH_REDIS_REST_URL,
        process.env.UPSTASH_REDIS_REST_TOKEN
      )
    : createMemoryStore()

// ── Public API ───────────────────────────────────────────────────────

export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 100,
}

export async function rateLimit(
  identifier: string,
  config: RateLimitConfig = defaultConfig
): Promise<{ success: boolean; remaining: number; resetIn: number }> {
  const now = Date.now()
  const key = `rl:${identifier}`

  try {
    let entry = await store.get(key)

    // If no entry or expired, create new one
    if (!entry || entry.resetTime < now) {
      entry = { count: 1, resetTime: now + config.windowMs }
      await store.set(key, entry, config.windowMs)
      return { success: true, remaining: config.maxRequests - 1, resetIn: config.windowMs }
    }

    // Increment
    entry.count++
    await store.set(key, entry, entry.resetTime - now)

    if (entry.count > config.maxRequests) {
      return { success: false, remaining: 0, resetIn: entry.resetTime - now }
    }

    return {
      success: true,
      remaining: config.maxRequests - entry.count,
      resetIn: entry.resetTime - now,
    }
  } catch {
    // If Redis is down, allow the request rather than blocking all traffic
    return { success: true, remaining: config.maxRequests, resetIn: config.windowMs }
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
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 5 },
  api: { windowMs: 60 * 1000, maxRequests: 100 },
  read: { windowMs: 60 * 1000, maxRequests: 200 },
  expensive: { windowMs: 60 * 1000, maxRequests: 10 },
}
