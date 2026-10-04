-- System-wide outbound email (SMTP) configuration.
-- Single-row table: `scope` is unique and always 'SYSTEM', so the application
-- can upsert without racing on an id it does not know yet.
CREATE TABLE IF NOT EXISTS "email_settings" (
  "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
  "scope"            TEXT         NOT NULL DEFAULT 'SYSTEM',
  "provider"         TEXT         NOT NULL DEFAULT 'console',

  "smtp_host"        TEXT,
  "smtp_port"        INTEGER,
  "smtp_secure"      BOOLEAN      NOT NULL DEFAULT false,
  "smtp_user"        TEXT,
  -- AES-256-GCM ciphertext, never stored or returned in plaintext.
  "smtp_password"    TEXT,

  "from_email"       TEXT,
  "from_name"        TEXT,

  "last_tested_at"   TIMESTAMPTZ,
  "last_test_status" TEXT,
  "last_test_error"  TEXT,

  "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by"       UUID,

  CONSTRAINT "email_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_settings_scope_key" ON "email_settings"("scope");
