import { createHash, randomBytes, timingSafeEqual } from "crypto"

/**
 * Invitation tokens.
 *
 * The token travels in a link and is shown to the admin exactly once. Only its
 * SHA-256 hash is stored, so a copy of the database cannot be used to accept
 * invitations — the same reason password hashes are stored rather than
 * passwords. A plain hash is right here (unlike for passwords) because the
 * token is 256 bits of randomness, so there is nothing to brute-force.
 */

export const INVITATION_TTL_DAYS = 7

export function generateInvitationToken(): string {
  return randomBytes(32).toString("base64url")
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

/** Constant-time compare, so lookups cannot be timed to recover a token. */
export function tokensMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export function invitationExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000)
}

/** The link an invited person opens. */
export function invitationUrl(token: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/invite/${token}`
}
