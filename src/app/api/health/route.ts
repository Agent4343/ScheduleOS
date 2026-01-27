import { NextResponse } from "next/server"

export async function GET() {
  const response: {
    status: string
    timestamp: string
    database?: string
    customRoleTable?: string
    error?: string
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

      // Check if CustomRole table exists
      try {
        await prisma.customRole.count()
        response.customRoleTable = "exists"
      } catch (tableError) {
        response.customRoleTable = "missing"
        response.status = "degraded"
      }
    } catch (error) {
      console.error("Database check failed:", error)
      response.database = "disconnected"
      response.error = error instanceof Error ? error.message : "Unknown error"
      // Still return 200 - app is running, just database is not ready
    }
  } else {
    response.database = "not_configured"
  }

  return NextResponse.json(response)
}
