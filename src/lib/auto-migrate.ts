import { PrismaClient } from '@prisma/client'

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
  `ALTER TABLE "Schedule" ADD COLUMN IF NOT EXISTS "customShiftCode" TEXT`,
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

  `DO $$ BEGIN
    ALTER TABLE "CustomShiftType" ADD CONSTRAINT "CustomShiftType_organizationId_code_key" UNIQUE ("organizationId", "code");
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$`,

  // =====================
  // StaffingRule table updates
  // =====================
  `ALTER TABLE "StaffingRule" ADD COLUMN IF NOT EXISTS "description" TEXT`,

  `DO $$ BEGIN
    ALTER TABLE "StaffingRule" ADD COLUMN "role" "UserRole";
  EXCEPTION
    WHEN duplicate_column THEN null;
  END $$`,

  `ALTER TABLE "StaffingRule" ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "StaffingRule" ADD COLUMN IF NOT EXISTS "crewId" TEXT`,

  `DO $$ BEGIN
    ALTER TABLE "StaffingRule" ADD CONSTRAINT "StaffingRule_crewId_fkey"
    FOREIGN KEY ("crewId") REFERENCES "Crew"("id") ON DELETE SET NULL;
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$`,

  // =====================
  // RotationPattern table updates
  // =====================
  `ALTER TABLE "RotationPattern" ADD COLUMN IF NOT EXISTS "alternatesShifts" BOOLEAN NOT NULL DEFAULT false`,

  // =====================
  // User table updates
  // =====================
  `DO $$ BEGIN
    ALTER TABLE "User" ADD COLUMN "positionType" "PositionType" NOT NULL DEFAULT 'OTHER';
  EXCEPTION
    WHEN duplicate_column THEN null;
  END $$`,

  `CREATE INDEX IF NOT EXISTS "User_organizationId_idx" ON "User"("organizationId")`,
  `CREATE INDEX IF NOT EXISTS "User_crewId_idx" ON "User"("crewId")`,

  // =====================
  // StaffingRule positionType column
  // =====================
  `DO $$ BEGIN
    ALTER TABLE "StaffingRule" ADD COLUMN "positionType" "PositionType";
  EXCEPTION
    WHEN duplicate_column THEN null;
  END $$`,
]

let migrationRan = false

export async function runAutoMigrations(): Promise<void> {
  // Only run once per process
  if (migrationRan) {
    return
  }

  const prisma = new PrismaClient()

  try {
    // Test connection first
    await prisma.$queryRaw`SELECT 1`

    // Check if Organization table exists (indicates database is set up)
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `
    const tableNames = tables.map((t: { tablename: string }) => t.tablename)

    if (!tableNames.includes('Organization')) {
      // Database not set up yet, skip migrations
      console.log('[auto-migrate] Database not initialized, skipping migrations')
      return
    }

    console.log('[auto-migrate] Running automatic database migrations...')

    let successCount = 0
    let errorCount = 0

    for (const statement of migrationStatements) {
      try {
        await prisma.$executeRawUnsafe(statement)
        successCount++
      } catch (err) {
        // Log errors but continue - some may fail due to already existing objects
        errorCount++
        const errMsg = err instanceof Error ? err.message : String(err)
        // Only log actual errors, not expected duplicates
        if (!errMsg.includes('duplicate') && !errMsg.includes('already exists')) {
          console.error('[auto-migrate] Migration error:', errMsg)
        }
      }
    }

    console.log(`[auto-migrate] Completed: ${successCount} succeeded, ${errorCount} skipped/failed`)
    migrationRan = true

  } catch (error) {
    console.error('[auto-migrate] Failed to run migrations:', error)
  } finally {
    await prisma.$disconnect()
  }
}
