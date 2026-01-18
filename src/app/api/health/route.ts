import { NextResponse } from "next/server"
import { logger } from "@/lib/logger"

export async function GET() {
  const response: {
    status: string
    timestamp: string
    database?: string
  } = {
    status: "healthy",
    timestamp: new Date().toISOString(),
  }

  // Only check database if DATABASE_URL is configured
  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/prisma")
      await prisma.$queryRaw`SELECT 1`
      response.database = "connected"
    } catch (error) {
      logger.error("Database health check failed", error)
      response.database = "disconnected"
      // Don't expose error details in response
    }
  } else {
    response.database = "not_configured"
  }

  return NextResponse.json(response)
}
