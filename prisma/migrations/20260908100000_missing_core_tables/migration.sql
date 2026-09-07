-- Create the four tables the production database never got.
--
-- Production was baselined with `prisma migrate resolve --applied 0_init`,
-- which records 0_init as done without running it. The database had been
-- shaped by an earlier fork of the app, so most tables already existed — but
-- ShiftCheckIn, ShiftSwap, Announcement and AuditLog did not, and the code
-- that uses them (attendance, shift swaps, announcements, the audit log)
-- fails at runtime without them.
--
-- Everything here is guarded (IF NOT EXISTS / DO blocks), so it is safe to
-- run against a database where some of it is already present.

-- Enums -----------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "SwapStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'APPROVED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AnnouncementPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ShiftCheckIn ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ShiftCheckIn" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "checkInTime" TIMESTAMP(3) NOT NULL,
    "checkOutTime" TIMESTAMP(3),
    "autoCheckedOut" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "scannedById" TEXT,

    CONSTRAINT "ShiftCheckIn_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShiftCheckIn_userId_date_key" ON "ShiftCheckIn"("userId", "date");
CREATE INDEX IF NOT EXISTS "ShiftCheckIn_userId_idx" ON "ShiftCheckIn"("userId");
CREATE INDEX IF NOT EXISTS "ShiftCheckIn_date_idx" ON "ShiftCheckIn"("date");

-- ShiftSwap -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ShiftSwap" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
    "reason" TEXT,
    "status" "SwapStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "requesterId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "ShiftSwap_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ShiftSwap_organizationId_idx" ON "ShiftSwap"("organizationId");
CREATE INDEX IF NOT EXISTS "ShiftSwap_requesterId_idx" ON "ShiftSwap"("requesterId");
CREATE INDEX IF NOT EXISTS "ShiftSwap_targetId_idx" ON "ShiftSwap"("targetId");
CREATE INDEX IF NOT EXISTS "ShiftSwap_status_idx" ON "ShiftSwap"("status");

-- Announcement ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "priority" "AnnouncementPriority" NOT NULL DEFAULT 'NORMAL',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Announcement_organizationId_idx" ON "Announcement"("organizationId");
CREATE INDEX IF NOT EXISTS "Announcement_organizationId_pinned_idx" ON "Announcement"("organizationId", "pinned");

-- AuditLog --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");
CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");

-- Foreign keys ----------------------------------------------------------
-- Added separately and guarded, because the tables above may already exist
-- without them on a partially-migrated database.
DO $$ BEGIN
  ALTER TABLE "ShiftCheckIn" ADD CONSTRAINT "ShiftCheckIn_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ShiftCheckIn" ADD CONSTRAINT "ShiftCheckIn_scannedById_fkey"
    FOREIGN KEY ("scannedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ShiftSwap" ADD CONSTRAINT "ShiftSwap_requesterId_fkey"
    FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ShiftSwap" ADD CONSTRAINT "ShiftSwap_targetId_fkey"
    FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ShiftSwap" ADD CONSTRAINT "ShiftSwap_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
