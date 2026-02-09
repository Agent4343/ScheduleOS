-- Add schedule staffing requirement fields to CertificationType
ALTER TABLE "CertificationType" ADD COLUMN "requireOnSchedule" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CertificationType" ADD COLUMN "minPerDayShift" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CertificationType" ADD COLUMN "minPerNightShift" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CertificationType" ADD COLUMN "expiryWarningDays" INTEGER NOT NULL DEFAULT 180;
