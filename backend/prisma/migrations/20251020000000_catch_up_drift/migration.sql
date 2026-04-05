-- AlterTable (already applied to DB, catching up migration history)
ALTER TABLE "Membership" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT 'User';

-- AlterTable (already applied to DB, catching up migration history)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatar" TEXT;
