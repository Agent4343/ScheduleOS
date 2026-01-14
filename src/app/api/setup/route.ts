import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

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

    // Create tables using raw SQL if they don't exist
    // This is a simplified setup - for full schema, use prisma db push from CLI

    // Check if User table exists
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `

    const tableNames = tables.map(t => t.tablename)

    if (tableNames.includes('User')) {
      return NextResponse.json({
        success: true,
        message: "Database already set up",
        tables: tableNames,
      })
    }

    // If tables don't exist, we need to run migrations
    // Since we can't run prisma db push directly, provide instructions
    return NextResponse.json({
      success: false,
      message: "Database connected but tables not created. Please run 'npx prisma db push' from a terminal with access to the DATABASE_URL.",
      database_url_configured: !!process.env.DATABASE_URL,
      connection: "successful",
      existing_tables: tableNames,
    })

  } catch (error) {
    console.error("Setup error:", error)

    // Check if it's a connection error
    if (error instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json({
        error: "Database connection failed",
        details: error.message,
        database_url_set: !!process.env.DATABASE_URL,
        hint: "Make sure DATABASE_URL is set correctly in Railway variables"
      }, { status: 500 })
    }

    return NextResponse.json(
      {
        error: "Setup failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
