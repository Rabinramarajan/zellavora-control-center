-- MFA replay protection counter
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_last_used_counter" INTEGER;

-- Invitation prefill + link to the pending user account
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "first_name" TEXT;
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "last_name" TEXT;
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "user_id" UUID;

-- Short-lived server-side auth state (replaces per-instance in-memory maps,
-- which break across serverless instances)
CREATE TABLE "auth_challenges" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID,
    "method" TEXT,
    "payload" TEXT,
    "remember_me" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "consumed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_challenges_token_hash_key" ON "auth_challenges"("token_hash");
CREATE INDEX "auth_challenges_user_id_purpose_idx" ON "auth_challenges"("user_id", "purpose");
CREATE INDEX "auth_challenges_expires_at_idx" ON "auth_challenges"("expires_at");
