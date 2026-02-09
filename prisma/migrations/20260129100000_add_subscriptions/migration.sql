-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('TRIAL', 'STARTER', 'GROWTH', 'PRO', 'BUSINESS');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');

-- AlterTable: Add subscription fields to Organization
ALTER TABLE "Organization" ADD COLUMN "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'TRIAL';
ALTER TABLE "Organization" ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING';
ALTER TABLE "Organization" ADD COLUMN "workerLimit" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "Organization" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN "subscriptionEndsAt" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "Organization" ADD COLUMN "stripeSubscriptionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripeCustomerId_key" ON "Organization"("stripeCustomerId");
CREATE UNIQUE INDEX "Organization_stripeSubscriptionId_key" ON "Organization"("stripeSubscriptionId");

-- Update existing organizations to have 14-day trial
UPDATE "Organization" SET "trialEndsAt" = NOW() + INTERVAL '14 days' WHERE "trialEndsAt" IS NULL;
