-- Sign-offs: a managed list of qualifications, and per-role requirements
-- saying how many DISTINCT holders of each are needed on a shift.
--
-- Additive: new tables only, nothing altered or dropped.

CREATE TABLE IF NOT EXISTS "Qualification" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "Qualification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Qualification_organizationId_code_key" ON "Qualification"("organizationId", "code");
CREATE INDEX IF NOT EXISTS "Qualification_organizationId_sortOrder_idx" ON "Qualification"("organizationId", "sortOrder");

CREATE TABLE IF NOT EXISTS "CoverageRequirement" (
    "id" TEXT NOT NULL,
    "countDay" INTEGER NOT NULL DEFAULT 1,
    "countNight" INTEGER NOT NULL DEFAULT 1,
    "coverageRoleId" TEXT NOT NULL,
    "qualificationId" TEXT NOT NULL,

    CONSTRAINT "CoverageRequirement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CoverageRequirement_coverageRoleId_qualificationId_key" ON "CoverageRequirement"("coverageRoleId", "qualificationId");
CREATE INDEX IF NOT EXISTS "CoverageRequirement_coverageRoleId_idx" ON "CoverageRequirement"("coverageRoleId");
CREATE INDEX IF NOT EXISTS "CoverageRequirement_qualificationId_idx" ON "CoverageRequirement"("qualificationId");

DO $$ BEGIN
  ALTER TABLE "Qualification" ADD CONSTRAINT "Qualification_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CoverageRequirement" ADD CONSTRAINT "CoverageRequirement_coverageRoleId_fkey"
    FOREIGN KEY ("coverageRoleId") REFERENCES "CoverageRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CoverageRequirement" ADD CONSTRAINT "CoverageRequirement_qualificationId_fkey"
    FOREIGN KEY ("qualificationId") REFERENCES "Qualification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
