import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const sqlStatements = [
  // Create enums
  `DO $$ BEGIN CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'SUPERVISOR', 'WORKER'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `DO $$ BEGIN CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `DO $$ BEGIN CREATE TYPE "ShiftType" AS ENUM ('DAY', 'NIGHT', 'OFF', 'VACATION', 'SICK', 'TRAINING', 'SHUTDOWN'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `DO $$ BEGIN CREATE TYPE "TimeOffType" AS ENUM ('VACATION', 'SICK', 'PERSONAL', 'BEREAVEMENT', 'JURY_DUTY', 'OTHER'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `DO $$ BEGIN CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `DO $$ BEGIN CREATE TYPE "NotificationType" AS ENUM ('SCHEDULE_CHANGE', 'TIME_OFF_REQUEST', 'TIME_OFF_APPROVED', 'TIME_OFF_DENIED', 'STAFFING_ALERT', 'SHIFT_SWAP', 'SYSTEM'); EXCEPTION WHEN duplicate_object THEN null; END $$`,

  // Organization table
  `CREATE TABLE IF NOT EXISTS "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL UNIQUE,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  // User table
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "passwordHash" TEXT,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'WORKER',
    "position" TEXT,
    "phone" TEXT,
    "hireDate" TIMESTAMP(3),
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT REFERENCES "Organization"("id") ON DELETE SET NULL,
    "crewId" TEXT
  )`,

  // Account table
  `CREATE TABLE IF NOT EXISTS "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    UNIQUE("provider", "providerAccountId")
  )`,

  // Session table
  `CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL UNIQUE,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "expires" TIMESTAMP(3) NOT NULL
  )`,

  // VerificationToken table
  `CREATE TABLE IF NOT EXISTS "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL UNIQUE,
    "expires" TIMESTAMP(3) NOT NULL,
    UNIQUE("identifier", "token")
  )`,

  // RotationPattern table
  `CREATE TABLE IF NOT EXISTS "RotationPattern" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "daysOn" INTEGER NOT NULL,
    "daysOff" INTEGER NOT NULL,
    "includesNights" BOOLEAN NOT NULL DEFAULT false,
    "nightsAtStart" BOOLEAN NOT NULL DEFAULT true,
    "nightDays" INTEGER NOT NULL DEFAULT 0,
    "patternDefinition" JSONB NOT NULL DEFAULT '[]',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
    UNIQUE("organizationId", "name")
  )`,

  // Crew table
  `CREATE TABLE IF NOT EXISTS "Crew" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "currentPhase" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
    "rotationPatternId" TEXT REFERENCES "RotationPattern"("id") ON DELETE SET NULL,
    UNIQUE("organizationId", "name")
  )`,

  // Add crewId foreign key to User
  `DO $$ BEGIN ALTER TABLE "User" ADD CONSTRAINT "User_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "Crew"("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN null; END $$`,

  // Schedule table
  `CREATE TABLE IF NOT EXISTS "Schedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATE NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
    "isOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "crewId" TEXT REFERENCES "Crew"("id") ON DELETE SET NULL,
    UNIQUE("userId", "date")
  )`,

  `CREATE INDEX IF NOT EXISTS "Schedule_date_idx" ON "Schedule"("date")`,
  `CREATE INDEX IF NOT EXISTS "Schedule_crewId_date_idx" ON "Schedule"("crewId", "date")`,

  // TimeOffRequest table
  `CREATE TABLE IF NOT EXISTS "TimeOffRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "type" "TimeOffType" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "notes" TEXT,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "approvedById" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
    "approvedAt" TIMESTAMP(3)
  )`,

  // StaffingRule table
  `CREATE TABLE IF NOT EXISTS "StaffingRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
    "minWorkers" INTEGER NOT NULL,
    "maxVacation" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
    UNIQUE("organizationId", "name")
  )`,

  // Shutdown table
  `CREATE TABLE IF NOT EXISTS "Shutdown" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE
  )`,

  // Holiday table
  `CREATE TABLE IF NOT EXISTS "Holiday" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
    UNIQUE("organizationId", "name", "date")
  )`,

  // HolidayTracking table
  `CREATE TABLE IF NOT EXISTS "HolidayTracking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "worked" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "holidayId" TEXT NOT NULL REFERENCES "Holiday"("id") ON DELETE CASCADE,
    UNIQUE("userId", "holidayId", "year")
  )`,

  // Notification table
  `CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification"("userId", "read")`,

  // Invitation table
  `CREATE TABLE IF NOT EXISTS "Invitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'WORKER',
    "token" TEXT NOT NULL UNIQUE,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
    "createdById" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    UNIQUE("organizationId", "email")
  )`,
]

export async function GET(request: NextRequest) {
  const setupKey = request.nextUrl.searchParams.get("key")

  if (setupKey !== process.env.SETUP_KEY && setupKey !== "initial-setup-2026") {
    return NextResponse.json({ error: "Invalid setup key" }, { status: 401 })
  }

  try {
    // Test connection
    await prisma.$queryRaw`SELECT 1`

    // Check if tables already exist
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

    // Execute each SQL statement separately
    const results: string[] = []
    for (let i = 0; i < sqlStatements.length; i++) {
      try {
        await prisma.$executeRawUnsafe(sqlStatements[i])
        results.push(`Statement ${i + 1}: OK`)
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        results.push(`Statement ${i + 1}: ${errMsg}`)
      }
    }

    // Verify tables were created
    const newTables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `
    const newTableNames = newTables.map((t: { tablename: string }) => t.tablename)

    return NextResponse.json({
      success: true,
      message: "Database tables created successfully",
      tables: newTableNames,
      details: results,
    })

  } catch (error: unknown) {
    console.error("Setup error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    return NextResponse.json({
      error: "Setup failed",
      details: errorMessage,
      database_url_set: !!process.env.DATABASE_URL,
    }, { status: 500 })
  }
}
