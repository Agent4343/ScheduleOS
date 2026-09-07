import { NextResponse } from "next/server"

export async function GET() {
  const response: {
    status: "healthy" | "unhealthy"
    timestamp: string
    database?: "connected" | "disconnected" | "not_configured"
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
      // Log the detail server-side only: the raw error can include the
      // connection string's host and user. This endpoint is public.
      console.error("Database check failed:", error)
      response.database = "disconnected"
      response.status = "unhealthy"
    }
  } else {
    response.database = "not_configured"
  }

  // 503 lets the platform healthcheck fail a deploy whose database is unreachable
  return NextResponse.json(response, { status: response.status === "healthy" ? 200 : 503 })
}
