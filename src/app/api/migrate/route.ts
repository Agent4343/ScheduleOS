import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

// Migration statements to bring database in sync with current Prisma schema
// These are idempotent - safe to run multiple times
const migrationStatements = [
  // =====================
  // PositionType enum (required for User.positionType)
  // =====================
  `DO $$ BEGIN CREATE TYPE "PositionType" AS ENUM ('OPERATOR', 'ONSHORE_CONTROL_ROOM', 'OTHER'); EXCEPTION WHEN duplicate_object THEN null; END $$`,

  // =====================
  // ShiftType enum additions
  // =====================
  `DO $$ BEGIN ALTER TYPE "ShiftType" ADD VALUE IF NOT EXISTS 'LEAVE'; EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `DO $$ BEGIN ALTER TYPE "ShiftType" ADD VALUE IF NOT EXISTS 'PL_DAY'; EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `DO $$ BEGIN ALTER TYPE "ShiftType" ADD VALUE IF NOT EXISTS 'PL_NIGHT'; EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `DO $$ BEGIN ALTER TYPE "ShiftType" ADD VALUE IF NOT EXISTS 'CUSTOM'; EXCEPTION WHEN duplicate_object THEN null; END $$`,

  // =====================
  // Schedule table updates
  // =====================
  // Add customShiftCode column for CUSTOM shift types
  `ALTER TABLE "Schedule" ADD COLUMN IF NOT EXISTS "customShiftCode" TEXT`,

  // Add missing indexes
  `CREATE INDEX IF NOT EXISTS "Schedule_userId_idx" ON "Schedule"("userId")`,
  `CREATE INDEX IF NOT EXISTS "Schedule_userId_isOverride_idx" ON "Schedule"("userId", "isOverride")`,

  // =====================
  // CustomShiftType table (new)
  // =====================
  `CREATE TABLE IF NOT EXISTS "CustomShiftType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "textColor" TEXT NOT NULL DEFAULT '#ffffff',
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE
  )`,

  // Unique constraint for CustomShiftType
  `DO $$ BEGIN
    ALTER TABLE "CustomShiftType" ADD CONSTRAINT "CustomShiftType_organizationId_code_key" UNIQUE ("organizationId", "code");
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$`,

  // =====================
  // StaffingRule table updates
  // =====================
  // Add description column
  `ALTER TABLE "StaffingRule" ADD COLUMN IF NOT EXISTS "description" TEXT`,

  // Add role column
  `DO $$ BEGIN
    ALTER TABLE "StaffingRule" ADD COLUMN "role" "UserRole";
  EXCEPTION
    WHEN duplicate_column THEN null;
  END $$`,

  // Add priority column
  `ALTER TABLE "StaffingRule" ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 0`,

  // Add crewId column
  `ALTER TABLE "StaffingRule" ADD COLUMN IF NOT EXISTS "crewId" TEXT`,

  // Add foreign key for crewId
  `DO $$ BEGIN
    ALTER TABLE "StaffingRule" ADD CONSTRAINT "StaffingRule_crewId_fkey"
    FOREIGN KEY ("crewId") REFERENCES "Crew"("id") ON DELETE SET NULL;
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$`,

  // =====================
  // RotationPattern table updates
  // =====================
  // Add alternatesShifts column
  `ALTER TABLE "RotationPattern" ADD COLUMN IF NOT EXISTS "alternatesShifts" BOOLEAN NOT NULL DEFAULT false`,

  // =====================
  // User table updates
  // =====================
  // Add positionType column (required by dashboard and staffing rules)
  `DO $$ BEGIN
    ALTER TABLE "User" ADD COLUMN "positionType" "PositionType" NOT NULL DEFAULT 'OTHER';
  EXCEPTION
    WHEN duplicate_column THEN null;
  END $$`,

  // =====================
  // User table indexes
  // =====================
  `CREATE INDEX IF NOT EXISTS "User_organizationId_idx" ON "User"("organizationId")`,
  `CREATE INDEX IF NOT EXISTS "User_crewId_idx" ON "User"("crewId")`,

  // =====================
  // StaffingRule table updates (positionType)
  // =====================
  // Add positionType column for position-specific staffing rules
  `DO $$ BEGIN
    ALTER TABLE "StaffingRule" ADD COLUMN "positionType" "PositionType";
  EXCEPTION
    WHEN duplicate_column THEN null;
  END $$`,

  // =====================
  // ShiftSwapStatus enum and ShiftSwapRequest table
  // =====================
  `DO $$ BEGIN CREATE TYPE "ShiftSwapStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$`,

  `CREATE TABLE IF NOT EXISTS "ShiftSwapRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATE NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
    "status" "ShiftSwapStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requesterId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "targetUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "approvedById" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
    "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS "ShiftSwapRequest_organizationId_status_idx" ON "ShiftSwapRequest"("organizationId", "status")`,
  `CREATE INDEX IF NOT EXISTS "ShiftSwapRequest_requesterId_idx" ON "ShiftSwapRequest"("requesterId")`,
  `CREATE INDEX IF NOT EXISTS "ShiftSwapRequest_targetUserId_idx" ON "ShiftSwapRequest"("targetUserId")`,

  // =====================
  // AuditLog table
  // =====================
  `CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
    "targetId" TEXT,
    "targetType" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId")`,
]

export async function GET(request: NextRequest) {
  const migrateKey = request.nextUrl.searchParams.get("key")
  const expectedKey = process.env.SETUP_KEY

  // Require a key for security
  if (!expectedKey) {
    return NextResponse.json({ error: "Migration key not configured" }, { status: 500 })
  }

  if (migrateKey !== expectedKey) {
    return NextResponse.json({ error: "Invalid migration key" }, { status: 401 })
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin privileges required" }, { status: 403 })
  }

  try {
    // Test connection
    await prisma.$queryRaw`SELECT 1`

    // Execute each migration statement
    const results: { statement: number; status: string; error?: string }[] = []

    for (let i = 0; i < migrationStatements.length; i++) {
      try {
        await prisma.$executeRawUnsafe(migrationStatements[i])
        results.push({ statement: i + 1, status: "OK" })
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        results.push({ statement: i + 1, status: "ERROR", error: errMsg })
      }
    }

    // Count successes and failures
    const successes = results.filter(r => r.status === "OK").length
    const failures = results.filter(r => r.status === "ERROR").length

    return NextResponse.json({
      success: failures === 0,
      message: `Migration completed: ${successes} succeeded, ${failures} failed`,
      totalStatements: migrationStatements.length,
      results,
    })

  } catch (error: unknown) {
    console.error("Migration error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    return NextResponse.json({
      error: "Migration failed",
      details: errorMessage,
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // Also support POST for running migrations
  return GET(request)
}
