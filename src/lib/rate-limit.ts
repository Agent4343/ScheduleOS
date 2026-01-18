import { NextRequest } from 'next/server'

interface RateLimitEntry {
  count: number
  resetTime: number
}

interface RateLimitConfig {
  windowMs: number      // Time window in milliseconds
  maxRequests: number   // Max requests per window
}

// In-memory store for rate limiting
// Note: For production with multiple instances, use Redis instead
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up old entries periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanupExpiredEntries(): void {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return

  lastCleanup = now
  rateLimitStore.forEach((entry, key) => {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key)
    }
  })
}

// Get client identifier from request
function getClientId(request: NextRequest): string {
  // Try to get real IP from headers (for proxied requests)
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')

  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  if (realIp) {
    return realIp
  }

  // Fallback to a hash of user-agent + accept-language as identifier
  const userAgent = request.headers.get('user-agent') || 'unknown'
  const acceptLang = request.headers.get('accept-language') || 'unknown'
  return `${userAgent}-${acceptLang}`.substring(0, 100)
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: number
  retryAfter?: number
}

/**
 * Check if a request should be rate limited
 */
export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  identifier?: string
): RateLimitResult {
  cleanupExpiredEntries()

  const clientId = identifier || getClientId(request)
  const now = Date.now()

  const entry = rateLimitStore.get(clientId)

  if (!entry || now > entry.resetTime) {
    // No entry or expired - create new window
    rateLimitStore.set(clientId, {
      count: 1,
      resetTime: now + config.windowMs,
    })

    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    }
  }

  if (entry.count >= config.maxRequests) {
    // Rate limit exceeded
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
    }
  }

  // Increment count
  entry.count++
  rateLimitStore.set(clientId, entry)

  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  }
}

// Predefined rate limit configurations
export const RATE_LIMITS = {
  // Auth endpoints - stricter limits to prevent brute force
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,           // 5 attempts per 15 minutes
  },

  // Registration - very strict
  register: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,           // 3 registrations per hour per IP
  },

  // Password reset - strict
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,           // 3 reset attempts per hour
  },

  // General API - more lenient
  api: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 60,          // 60 requests per minute
  },

  // Schedule generation - expensive operation
  scheduleGeneration: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 10,          // 10 generations per minute
  },

  // Setup endpoint - very strict (should rarely be called)
  setup: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 1,           // 1 attempt per hour
  },
} as const

/**
 * Create rate limit headers for response
 */
export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
  }

  if (result.retryAfter !== undefined) {
    headers['Retry-After'] = String(result.retryAfter)
  }

  return headers
}
