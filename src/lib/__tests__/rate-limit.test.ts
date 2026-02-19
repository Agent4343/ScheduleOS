import { describe, it, expect } from "vitest"
import { rateLimit, getClientIP, rateLimitPresets } from "../rate-limit"

describe("rateLimit", () => {
  it("allows requests under the limit", async () => {
    const result = await rateLimit("test-under-limit", { windowMs: 60_000, maxRequests: 5 })
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it("blocks requests over the limit", async () => {
    const config = { windowMs: 60_000, maxRequests: 2 }
    const id = `test-over-limit-${Date.now()}`

    await rateLimit(id, config)
    await rateLimit(id, config)
    const third = await rateLimit(id, config)

    expect(third.success).toBe(false)
    expect(third.remaining).toBe(0)
  })

  it("tracks remaining count correctly", async () => {
    const config = { windowMs: 60_000, maxRequests: 3 }
    const id = `test-remaining-${Date.now()}`

    const r1 = await rateLimit(id, config)
    const r2 = await rateLimit(id, config)

    expect(r1.remaining).toBe(2)
    expect(r2.remaining).toBe(1)
  })
})

describe("getClientIP", () => {
  it("extracts IP from x-forwarded-for", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    })
    expect(getClientIP(req)).toBe("1.2.3.4")
  })

  it("extracts IP from x-real-ip", () => {
    const req = new Request("http://localhost", {
      headers: { "x-real-ip": "10.0.0.1" },
    })
    expect(getClientIP(req)).toBe("10.0.0.1")
  })

  it("returns unknown when no headers", () => {
    const req = new Request("http://localhost")
    expect(getClientIP(req)).toBe("unknown")
  })
})

describe("rateLimitPresets", () => {
  it("defines auth preset with strict limits", () => {
    expect(rateLimitPresets.auth.maxRequests).toBe(5)
    expect(rateLimitPresets.auth.windowMs).toBe(15 * 60 * 1000)
  })

  it("defines api preset", () => {
    expect(rateLimitPresets.api.maxRequests).toBe(100)
  })
})
