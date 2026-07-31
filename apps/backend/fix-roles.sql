-- Add missing columns to roles table
ALTER TABLE "roles"
ADD COLUMN IF NOT EXISTS "name" VARCHAR,
ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ;