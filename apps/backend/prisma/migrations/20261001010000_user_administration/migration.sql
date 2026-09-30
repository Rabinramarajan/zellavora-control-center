-- Account status for administratively disabled accounts
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'DISABLED';

-- Human-readable user number (USR000236); SERIAL backfills existing rows.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "user_no" SERIAL;
CREATE UNIQUE INDEX IF NOT EXISTS "users_user_no_key" ON "users"("user_no");

-- Employee, contact and organization profile
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "middle_name" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "employment_type" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "joining_date" DATE;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "work_location" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cost_center" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "assigned_officer_id" UUID;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "access_scope" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "alternate_email" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "alternate_mobile" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "address_line1" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "address_line2" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "postal_code" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lock_reason" TEXT;

CREATE TABLE "user_status_history" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "reason" TEXT,
    "actor_id" UUID,
    "actor_name" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_status_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "user_status_history_user_id_created_at_idx" ON "user_status_history"("user_id", "created_at");
ALTER TABLE "user_status_history" ADD CONSTRAINT "user_status_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "user_notes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID,
    "note_type" TEXT NOT NULL DEFAULT 'GENERAL',
    "visibility" TEXT NOT NULL DEFAULT 'INTERNAL',
    "body" TEXT NOT NULL,
    "attachment_url" TEXT,
    "author_id" UUID,
    "author_name" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_notes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "user_notes_user_id_created_at_idx" ON "user_notes"("user_id", "created_at");
ALTER TABLE "user_notes" ADD CONSTRAINT "user_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "user_email_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID,
    "type" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "delivery_status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "sent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_email_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "user_email_logs_user_id_created_at_idx" ON "user_email_logs"("user_id", "created_at");
ALTER TABLE "user_email_logs" ADD CONSTRAINT "user_email_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Who granted each role / group membership, and when
ALTER TABLE "user_role_assignments" ADD COLUMN IF NOT EXISTS "assigned_by" UUID;
ALTER TABLE "user_role_assignments" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "user_groups" ADD COLUMN IF NOT EXISTS "assigned_by" UUID;
