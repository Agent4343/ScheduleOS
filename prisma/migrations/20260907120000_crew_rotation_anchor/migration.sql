-- AlterTable
ALTER TABLE "Crew" ADD COLUMN     "anchorPhase" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "anchorStartingShift" "ShiftType",
ADD COLUMN     "rotationAnchorDate" DATE;
