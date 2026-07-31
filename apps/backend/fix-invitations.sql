-- Add missing columns to invitations table
ALTER TABLE "invitations"
ADD COLUMN IF NOT EXISTS "organization_id" UUID REFERENCES "organizations"("id") ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS "role" VARCHAR DEFAULT 'employee',
ADD COLUMN IF NOT EXISTS "department_id" UUID,
ADD COLUMN IF NOT EXISTS "invited_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS "status" VARCHAR DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "used_at" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "used" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "created_by" UUID,
ADD COLUMN IF NOT EXISTS "updated_by" UUID,
ADD COLUMN IF NOT EXISTS "deleted_by" UUID,
ADD COLUMN IF NOT EXISTS "version" INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ;

-- Update existing rows to have expires_at
UPDATE "invitations" SET "expires_at" = "created_at" + INTERVAL '365 days' WHERE "expires_at" IS NULL;

-- Now make expires_at NOT NULL
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "invitations_organization_id_idx" ON "invitations"("organization_id");