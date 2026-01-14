import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  // Simple security: require a setup key
  const setupKey = request.nextUrl.searchParams.get("key")

  if (setupKey !== process.env.SETUP_KEY && setupKey !== "initial-setup-2026") {
    return NextResponse.json(
      { error: "Invalid setup key" },
      { status: 401 }
    )
  }

  try {
    // Test database connection first
    await prisma.$queryRaw`SELECT 1`

    // Check if User table exists
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `

    const tableNames = tables.map((t: { tablename: string }) => t.tablename)

    if (tableNames.includes('User')) {
      return NextResponse.json({
        success: true,
        message: "Database already set up",
        tables: tableNames,
      })
    }

    // If tables don't exist, we need to run migrations
    return NextResponse.json({
      success: false,
      message: "Database connected but tables not created. Please run 'npx prisma db push' from a terminal with access to the DATABASE_URL.",
      database_url_configured: !!process.env.DATABASE_URL,
      connection: "successful",
      existing_tables: tableNames,
    })

  } catch (error: unknown) {
    console.error("Setup error:", error)

    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    return NextResponse.json({
      error: "Database connection failed",
      details: errorMessage,
      database_url_set: !!process.env.DATABASE_URL,
      hint: "Make sure DATABASE_URL is set correctly in Railway variables"
    }, { status: 500 })
  }
}
