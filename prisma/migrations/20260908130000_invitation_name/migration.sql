-- Invitations can carry the person's name, so the account they create lands on
-- the roster reading correctly rather than as an email address.
-- Production already has this column, hence the guard.
ALTER TABLE "Invitation" ADD COLUMN IF NOT EXISTS "name" TEXT;
