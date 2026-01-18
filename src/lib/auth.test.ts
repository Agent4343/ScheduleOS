import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'
import { hashPassword, verifyPassword } from './auth'

describe('hashPassword', () => {
  it('returns a hashed string different from input', async () => {
    const password = 'mySecurePassword123'
    const hashed = await hashPassword(password)

    expect(hashed).not.toBe(password)
    expect(hashed.length).toBeGreaterThan(0)
  })

  it('generates different hashes for same password (due to salt)', async () => {
    const password = 'testPassword'
    const hash1 = await hashPassword(password)
    const hash2 = await hashPassword(password)

    expect(hash1).not.toBe(hash2)
  })

  it('generates bcrypt hash format', async () => {
    const password = 'testPassword'
    const hashed = await hashPassword(password)

    // bcrypt hashes start with $2a$ or $2b$
    expect(hashed).toMatch(/^\$2[ab]\$\d{2}\$.{53}$/)
  })

  it('uses 12 rounds of hashing', async () => {
    const password = 'testPassword'
    const hashed = await hashPassword(password)

    // bcrypt format: $2a$12$... where 12 is the cost factor
    expect(hashed).toContain('$12$')
  })

  it('handles empty password', async () => {
    const hashed = await hashPassword('')
    expect(hashed).toBeTruthy()
    expect(hashed.length).toBeGreaterThan(0)
  })

  it('handles special characters in password', async () => {
    const password = '!@#$%^&*()_+-=[]{}|;:,.<>?`~'
    const hashed = await hashPassword(password)

    expect(hashed).toBeTruthy()
    // Verify we can verify it back
    const isValid = await bcrypt.compare(password, hashed)
    expect(isValid).toBe(true)
  })

  it('handles unicode characters in password', async () => {
    const password = '密码тест🔐'
    const hashed = await hashPassword(password)

    expect(hashed).toBeTruthy()
    const isValid = await bcrypt.compare(password, hashed)
    expect(isValid).toBe(true)
  })

  it('handles very long passwords', async () => {
    // bcrypt has a max length of 72 bytes
    const password = 'a'.repeat(100)
    const hashed = await hashPassword(password)

    expect(hashed).toBeTruthy()
  })
})

describe('verifyPassword', () => {
  it('returns true for correct password', async () => {
    const password = 'correctPassword'
    const hashed = await hashPassword(password)

    const result = await verifyPassword(password, hashed)

    expect(result).toBe(true)
  })

  it('returns false for incorrect password', async () => {
    const password = 'correctPassword'
    const hashed = await hashPassword(password)

    const result = await verifyPassword('wrongPassword', hashed)

    expect(result).toBe(false)
  })

  it('returns false for similar but different passwords', async () => {
    const password = 'Password123'
    const hashed = await hashPassword(password)

    // Test case sensitivity
    expect(await verifyPassword('password123', hashed)).toBe(false)
    expect(await verifyPassword('PASSWORD123', hashed)).toBe(false)

    // Test with extra characters
    expect(await verifyPassword('Password123 ', hashed)).toBe(false)
    expect(await verifyPassword(' Password123', hashed)).toBe(false)
  })

  it('handles empty password verification', async () => {
    const hashed = await hashPassword('')
    const result = await verifyPassword('', hashed)

    expect(result).toBe(true)
  })

  it('returns false when verifying empty password against non-empty hash', async () => {
    const hashed = await hashPassword('realPassword')
    const result = await verifyPassword('', hashed)

    expect(result).toBe(false)
  })

  it('handles special characters', async () => {
    const password = '!@#$%^&*()'
    const hashed = await hashPassword(password)

    expect(await verifyPassword(password, hashed)).toBe(true)
    expect(await verifyPassword('!@#$%^&*(', hashed)).toBe(false)
  })

  it('handles unicode characters', async () => {
    const password = '密码тест🔐'
    const hashed = await hashPassword(password)

    expect(await verifyPassword(password, hashed)).toBe(true)
    expect(await verifyPassword('密码тест', hashed)).toBe(false)
  })

  it('is timing-safe (takes similar time for correct/incorrect)', async () => {
    const password = 'testPassword'
    const hashed = await hashPassword(password)

    // This is a basic sanity check - real timing attacks need more sophisticated testing
    const correctStart = performance.now()
    await verifyPassword(password, hashed)
    const correctTime = performance.now() - correctStart

    const incorrectStart = performance.now()
    await verifyPassword('wrongPassword', hashed)
    const incorrectTime = performance.now() - incorrectStart

    // Both operations should take roughly similar time (within 50ms)
    // bcrypt is designed to be timing-safe
    expect(Math.abs(correctTime - incorrectTime)).toBeLessThan(50)
  })
})

describe('password hashing security', () => {
  it('different users with same password have different hashes', async () => {
    const password = 'sharedPassword'

    const user1Hash = await hashPassword(password)
    const user2Hash = await hashPassword(password)

    expect(user1Hash).not.toBe(user2Hash)

    // But both should verify correctly
    expect(await verifyPassword(password, user1Hash)).toBe(true)
    expect(await verifyPassword(password, user2Hash)).toBe(true)
  })

  it('hash cannot be reversed to get original password', async () => {
    const password = 'secretPassword'
    const hashed = await hashPassword(password)

    // The hash should not contain the original password
    expect(hashed).not.toContain(password)
  })

  it('validates hash format before verification', async () => {
    // Invalid hash format should not crash
    const invalidHash = 'not-a-valid-bcrypt-hash'

    // bcrypt.compare will return false for invalid hash format
    const result = await verifyPassword('password', invalidHash)
    expect(result).toBe(false)
  })
})
