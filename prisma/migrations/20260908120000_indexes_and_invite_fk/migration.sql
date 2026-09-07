-- Two fixes found in review.
--
-- 1. TimeOffRequest had no indexes at all, yet every query filters on userId
--    or status: the time-off list, the dashboard's pending count, and the
--    staffing-impact check. Each was a sequential scan.
--
-- 2. Invitation.createdById defaulted to ON DELETE RESTRICT, so anyone who
--    had ever sent an invitation could not delete their account — it failed
--    with a foreign key error surfaced as a generic 500. An invitation from a
--    deleted user is not usable, so it goes with them.

CREATE INDEX IF NOT EXISTS "TimeOffRequest_userId_idx" ON "TimeOffRequest"("userId");
CREATE INDEX IF NOT EXISTS "TimeOffRequest_status_idx" ON "TimeOffRequest"("status");
CREATE INDEX IF NOT EXISTS "TimeOffRequest_userId_startDate_idx" ON "TimeOffRequest"("userId", "startDate");

ALTER TABLE "Invitation" DROP CONSTRAINT IF EXISTS "Invitation_createdById_fkey";
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
