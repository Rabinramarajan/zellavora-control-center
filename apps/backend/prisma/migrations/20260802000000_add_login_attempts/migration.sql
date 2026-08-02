-- CreateTable
CREATE TABLE IF NOT EXISTS "login_attempts" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "client_code" VARCHAR(16),
    "ip_address" INET,
    "user_agent" TEXT,
    "success" BOOLEAN NOT NULL,
    "failure_reason" VARCHAR(50),
    "attempted_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_login_attempts_email_time" ON "login_attempts"("email", "attempted_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_login_attempts_ip_time" ON "login_attempts"("ip_address", "attempted_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_login_attempts_time" ON "login_attempts"("attempted_at" DESC);

-- Supabase convention: the service_role (used by supabaseAdmin server-side)
-- needs explicit table privileges. Without these, every rate-limit query fails
-- with permission denied and login 500s (the SELECT error surfaces with an
-- empty message, masking the real cause).
GRANT SELECT, INSERT, UPDATE, DELETE ON "login_attempts" TO "service_role";
