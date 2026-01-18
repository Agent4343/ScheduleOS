import { z } from 'zod'

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),

  // Authentication
  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL must be a valid URL'),
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),

  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export type Env = z.infer<typeof envSchema>

function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors
    const errorMessages = Object.entries(errors)
      .map(([key, messages]) => `  ${key}: ${messages?.join(', ')}`)
      .join('\n')

    throw new Error(
      `Invalid environment variables:\n${errorMessages}\n\nPlease check your .env file.`
    )
  }

  return parsed.data
}

// Validate on import (will throw if invalid)
let env: Env

try {
  env = validateEnv()
} catch (error) {
  // In test environment, use mock values
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    env = {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      NEXTAUTH_URL: 'http://localhost:3000',
      NEXTAUTH_SECRET: 'test-secret-that-is-at-least-32-characters-long',
      NODE_ENV: 'test',
    }
  } else {
    throw error
  }
}

export { env }

// Helper to check if we're in production
export const isProduction = env.NODE_ENV === 'production'
export const isDevelopment = env.NODE_ENV === 'development'
export const isTest = env.NODE_ENV === 'test'
