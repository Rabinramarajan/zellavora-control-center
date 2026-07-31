-- Add missing columns to branches table
ALTER TABLE "branches"
ADD COLUMN IF NOT EXISTS "is_head_office" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "country" VARCHAR,
ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ;