-- Keep the audit log true.
--
-- AuditLog.userId was ON DELETE CASCADE, so deleting a user erased every
-- entry recording what they had done — an audit trail anyone could clear by
-- deleting their own account. Now the entry survives: userId becomes nullable
-- and is set to NULL, while a snapshot of who they were is kept on the row so
-- it still names them.

ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "actorName" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "actorEmail" TEXT;

-- Fill in the snapshot for entries written before this change
UPDATE "AuditLog" a
SET "actorName" = u."name", "actorEmail" = u."email"
FROM "User" u
WHERE a."userId" = u."id" AND a."actorEmail" IS NULL;

ALTER TABLE "AuditLog" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_userId_fkey";
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
