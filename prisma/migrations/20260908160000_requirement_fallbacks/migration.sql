-- Stand-ins for a sign-off requirement.
--
-- The control room always needs two people. Normally they are onshore control
-- room operators; when those are off, someone trained on the offshore control
-- room can stand in. That is not an equal — it is a fallback, used only once
-- everyone holding the real sign-off is accounted for, and worth flagging.

CREATE TABLE IF NOT EXISTS "CoverageRequirementFallback" (
    "id" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "requirementId" TEXT NOT NULL,
    "qualificationId" TEXT NOT NULL,

    CONSTRAINT "CoverageRequirementFallback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CoverageRequirementFallback_requirementId_qualificationId_key"
  ON "CoverageRequirementFallback"("requirementId", "qualificationId");
CREATE INDEX IF NOT EXISTS "CoverageRequirementFallback_requirementId_idx" ON "CoverageRequirementFallback"("requirementId");
CREATE INDEX IF NOT EXISTS "CoverageRequirementFallback_qualificationId_idx" ON "CoverageRequirementFallback"("qualificationId");

DO $$ BEGIN
  ALTER TABLE "CoverageRequirementFallback" ADD CONSTRAINT "CoverageRequirementFallback_requirementId_fkey"
    FOREIGN KEY ("requirementId") REFERENCES "CoverageRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CoverageRequirementFallback" ADD CONSTRAINT "CoverageRequirementFallback_qualificationId_fkey"
    FOREIGN KEY ("qualificationId") REFERENCES "Qualification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
