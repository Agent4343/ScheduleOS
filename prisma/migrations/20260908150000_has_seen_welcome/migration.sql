-- Remembers whether the welcome walkthrough has played for this person.
-- Per user rather than per browser, so it does not replay on their phone.
-- Production already has this column, hence the guard.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hasSeenWelcome" BOOLEAN NOT NULL DEFAULT false;
