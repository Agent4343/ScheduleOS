import { describe, it, expect, vi } from "vitest"

vi.mock("../prisma", () => ({ prisma: {} }))

import {
  generateInvitationToken,
  hashInvitationToken,
  tokensMatch,
  invitationExpiry,
  invitationUrl,
  INVITATION_TTL_DAYS,
} from "../invitations"

describe("invitation tokens", () => {
  it("generates a different token every time", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateInvitationToken()))
    expect(tokens.size).toBe(200)
  })

  it("generates URL-safe tokens with at least 256 bits of entropy", () => {
    const token = generateInvitationToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    // 32 random bytes in base64url
    expect(token.length).toBeGreaterThanOrEqual(43)
  })

  it("hashes deterministically, and the hash does not contain the token", () => {
    const token = generateInvitationToken()
    expect(hashInvitationToken(token)).toBe(hashInvitationToken(token))
    expect(hashInvitationToken(token)).not.toContain(token)
    expect(hashInvitationToken(token)).toMatch(/^[0-9a-f]{64}$/)
  })

  it("gives different tokens different hashes", () => {
    expect(hashInvitationToken("a")).not.toBe(hashInvitationToken("b"))
  })

  it("compares without leaking length mismatches as a throw", () => {
    expect(tokensMatch("abc", "abc")).toBe(true)
    expect(tokensMatch("abc", "abd")).toBe(false)
    expect(tokensMatch("abc", "abcd")).toBe(false)
    expect(tokensMatch("", "")).toBe(true)
  })

  it("expires a week out", () => {
    const from = new Date("2026-03-02T00:00:00.000Z")
    const expiry = invitationExpiry(from)
    expect(expiry.toISOString()).toBe("2026-03-09T00:00:00.000Z")
    expect(INVITATION_TTL_DAYS).toBe(7)
  })

  it("builds a link without doubling the slash", () => {
    expect(invitationUrl("abc", "https://example.com")).toBe("https://example.com/invite/abc")
    expect(invitationUrl("abc", "https://example.com/")).toBe("https://example.com/invite/abc")
  })
})
