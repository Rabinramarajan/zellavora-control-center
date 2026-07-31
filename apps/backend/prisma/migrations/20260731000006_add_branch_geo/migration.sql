-- Add optional geo coordinates to branches table
ALTER TABLE "branches"
ADD COLUMN IF NOT EXISTS "latitude" VARCHAR,
ADD COLUMN IF NOT EXISTS "longitude" VARCHAR;
