-- Role-based coverage: position groups, coverage roles, duty-code mapping.
-- Purely additive. Column names chosen not to collide with columns that
-- already exist in production from an uncommitted schema (sortOrder etc.).

-- CreateEnum
CREATE TYPE "CoverageShift" AS ENUM ('DAY', 'NIGHT');

-- CreateTable
CREATE TABLE "CoverageRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "minDay" INTEGER NOT NULL DEFAULT 1,
    "targetDay" INTEGER NOT NULL DEFAULT 1,
    "minNight" INTEGER NOT NULL DEFAULT 0,
    "targetNight" INTEGER NOT NULL DEFAULT 0,
    "requiredQualification" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "CoverageRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "defaultCoverageRoleId" TEXT,

    CONSTRAINT "PositionGroup_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "positionGroupId" TEXT,
ADD COLUMN     "qualifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "rosterOrder" INTEGER;

-- AlterTable
ALTER TABLE "CustomShiftType" ADD COLUMN     "coverageRoleId" TEXT,
ADD COLUMN     "coverageShift" "CoverageShift",
ADD COLUMN     "isBackfill" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "CoverageRole_organizationId_name_key" ON "CoverageRole"("organizationId", "name");

-- CreateIndex
CREATE INDEX "CoverageRole_organizationId_sortOrder_idx" ON "CoverageRole"("organizationId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PositionGroup_organizationId_name_key" ON "PositionGroup"("organizationId", "name");

-- CreateIndex
CREATE INDEX "PositionGroup_organizationId_sortOrder_idx" ON "PositionGroup"("organizationId", "sortOrder");

-- CreateIndex
CREATE INDEX "User_positionGroupId_idx" ON "User"("positionGroupId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_positionGroupId_fkey" FOREIGN KEY ("positionGroupId") REFERENCES "PositionGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomShiftType" ADD CONSTRAINT "CustomShiftType_coverageRoleId_fkey" FOREIGN KEY ("coverageRoleId") REFERENCES "CoverageRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionGroup" ADD CONSTRAINT "PositionGroup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionGroup" ADD CONSTRAINT "PositionGroup_defaultCoverageRoleId_fkey" FOREIGN KEY ("defaultCoverageRoleId") REFERENCES "CoverageRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageRole" ADD CONSTRAINT "CoverageRole_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
