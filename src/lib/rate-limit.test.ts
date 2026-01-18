import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import {
  checkRateLimit,
  createRateLimitHeaders,
  RATE_LIMITS,
} from './rate-limit'

// Helper to create mock NextRequest
function createMockRequest(ip: string = '127.0.0.1'): NextRequest {
  const url = new URL('http://localhost:3000/api/test')
  const headers = new Headers()
  headers.set('x-forwarded-for', ip)

  return {
    headers,
    nextUrl: url,
    url: url.toString(),
  } as unknown as NextRequest
}

describe('checkRateLimit', () => {
  beforeEach(() => {
    // Clear rate limit store between tests by using unique IPs
    vi.useFakeTimers()
  })

  it('allows first request within limit', () => {
    const request = createMockRequest('192.168.1.1')
    const config = { windowMs: 60000, maxRequests: 5 }

    const result = checkRateLimit(request, config)

    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('decrements remaining count with each request', () => {
    const request = createMockRequest('192.168.1.2')
    const config = { windowMs: 60000, maxRequests: 5 }

    const result1 = checkRateLimit(request, config)
    expect(result1.remaining).toBe(4)

    const result2 = checkRateLimit(request, config)
    expect(result2.remaining).toBe(3)

    const result3 = checkRateLimit(request, config)
    expect(result3.remaining).toBe(2)
  })

  it('blocks requests when limit exceeded', () => {
    const request = createMockRequest('192.168.1.3')
    const config = { windowMs: 60000, maxRequests: 3 }

    // Make 3 allowed requests
    checkRateLimit(request, config)
    checkRateLimit(request, config)
    checkRateLimit(request, config)

    // 4th request should be blocked
    const result = checkRateLimit(request, config)

    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfter).toBeDefined()
    expect(result.retryAfter).toBeGreaterThan(0)
  })

  it('resets after window expires', () => {
    const request = createMockRequest('192.168.1.4')
    const config = { windowMs: 1000, maxRequests: 2 } // 1 second window

    // Exhaust the limit
    checkRateLimit(request, config)
    checkRateLimit(request, config)

    const blockedResult = checkRateLimit(request, config)
    expect(blockedResult.success).toBe(false)

    // Advance time past the window
    vi.advanceTimersByTime(1100)

    // Should be allowed again
    const result = checkRateLimit(request, config)
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(1)
  })

  it('tracks different IPs separately', () => {
    const request1 = createMockRequest('10.0.0.1')
    const request2 = createMockRequest('10.0.0.2')
    const config = { windowMs: 60000, maxRequests: 2 }

    // Exhaust limit for first IP
    checkRateLimit(request1, config)
    checkRateLimit(request1, config)
    const blocked = checkRateLimit(request1, config)
    expect(blocked.success).toBe(false)

    // Second IP should still be allowed
    const result = checkRateLimit(request2, config)
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(1)
  })

  it('uses custom identifier when provided', () => {
    const request = createMockRequest('10.0.0.3')
    const config = { windowMs: 60000, maxRequests: 2 }

    // Use custom identifier (e.g., user ID)
    checkRateLimit(request, config, 'user-123')
    checkRateLimit(request, config, 'user-123')
    const blocked = checkRateLimit(request, config, 'user-123')
    expect(blocked.success).toBe(false)

    // Same IP but different identifier should be allowed
    const result = checkRateLimit(request, config, 'user-456')
    expect(result.success).toBe(true)
  })

  it('returns correct resetTime', () => {
    const now = Date.now()
    vi.setSystemTime(now)

    const request = createMockRequest('10.0.0.4')
    const config = { windowMs: 60000, maxRequests: 5 }

    const result = checkRateLimit(request, config)

    expect(result.resetTime).toBe(now + 60000)
  })
})

describe('createRateLimitHeaders', () => {
  it('creates headers with remaining and reset', () => {
    const result = {
      success: true,
      remaining: 5,
      resetTime: 1700000000000,
    }

    const headers = createRateLimitHeaders(result)

    expect(headers['X-RateLimit-Remaining']).toBe('5')
    expect(headers['X-RateLimit-Reset']).toBe('1700000000')
  })

  it('includes Retry-After when rate limited', () => {
    const result = {
      success: false,
      remaining: 0,
      resetTime: 1700000000000,
      retryAfter: 30,
    }

    const headers = createRateLimitHeaders(result)

    expect(headers['Retry-After']).toBe('30')
    expect(headers['X-RateLimit-Remaining']).toBe('0')
  })

  it('does not include Retry-After when not rate limited', () => {
    const result = {
      success: true,
      remaining: 5,
      resetTime: 1700000000000,
    }

    const headers = createRateLimitHeaders(result)

    expect(headers['Retry-After']).toBeUndefined()
  })
})

describe('RATE_LIMITS configurations', () => {
  it('has auth rate limit configuration', () => {
    expect(RATE_LIMITS.auth).toBeDefined()
    expect(RATE_LIMITS.auth.windowMs).toBe(15 * 60 * 1000) // 15 minutes
    expect(RATE_LIMITS.auth.maxRequests).toBe(5)
  })

  it('has register rate limit configuration', () => {
    expect(RATE_LIMITS.register).toBeDefined()
    expect(RATE_LIMITS.register.windowMs).toBe(60 * 60 * 1000) // 1 hour
    expect(RATE_LIMITS.register.maxRequests).toBe(3)
  })

  it('has api rate limit configuration', () => {
    expect(RATE_LIMITS.api).toBeDefined()
    expect(RATE_LIMITS.api.windowMs).toBe(60 * 1000) // 1 minute
    expect(RATE_LIMITS.api.maxRequests).toBe(60)
  })

  it('has scheduleGeneration rate limit configuration', () => {
    expect(RATE_LIMITS.scheduleGeneration).toBeDefined()
    expect(RATE_LIMITS.scheduleGeneration.windowMs).toBe(60 * 1000) // 1 minute
    expect(RATE_LIMITS.scheduleGeneration.maxRequests).toBe(10)
  })

  it('has setup rate limit configuration', () => {
    expect(RATE_LIMITS.setup).toBeDefined()
    expect(RATE_LIMITS.setup.windowMs).toBe(60 * 60 * 1000) // 1 hour
    expect(RATE_LIMITS.setup.maxRequests).toBe(1)
  })

  it('has passwordReset rate limit configuration', () => {
    expect(RATE_LIMITS.passwordReset).toBeDefined()
    expect(RATE_LIMITS.passwordReset.windowMs).toBe(60 * 60 * 1000) // 1 hour
    expect(RATE_LIMITS.passwordReset.maxRequests).toBe(3)
  })

  it('all rate limits have reasonable values', () => {
    Object.entries(RATE_LIMITS).forEach(([_name, config]) => {
      expect(config.windowMs).toBeGreaterThan(0)
      expect(config.maxRequests).toBeGreaterThan(0)
      // Windows should be at least 1 second
      expect(config.windowMs).toBeGreaterThanOrEqual(1000)
    })
  })
})
