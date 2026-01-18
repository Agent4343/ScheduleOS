import { PrismaClient } from '@prisma/client'
import { logger } from './logger'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Prisma Client with connection pooling optimization.
 *
 * Connection pooling is primarily configured via DATABASE_URL parameters:
 * - connection_limit: Maximum connections in the pool (default: 10)
 * - pool_timeout: Time to wait for a connection (default: 10s)
 *
 * Example DATABASE_URL with pooling:
 * postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=30
 *
 * For serverless environments (Vercel, AWS Lambda), consider using:
 * - PgBouncer or similar connection pooler
 * - Prisma Accelerate for managed connection pooling
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'stdout', level: 'error' },
          { emit: 'stdout', level: 'warn' },
        ]
      : [{ emit: 'stdout', level: 'error' }],
  })

// Log slow queries in development
if (process.env.NODE_ENV === 'development') {
  // @ts-expect-error - Prisma event types
  prisma.$on('query', (e: { query: string; duration: number }) => {
    if (e.duration > 100) {
      logger.warn(`Slow query (${e.duration}ms)`, { query: e.query })
    }
  })
}

// Graceful shutdown handling
const shutdownPrisma = async () => {
  logger.info('Disconnecting Prisma client...')
  await prisma.$disconnect()
  process.exit(0)
}

// Only register shutdown handlers in production
if (process.env.NODE_ENV === 'production') {
  process.on('SIGINT', shutdownPrisma)
  process.on('SIGTERM', shutdownPrisma)
}

// Reuse client in development to prevent connection exhaustion
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
