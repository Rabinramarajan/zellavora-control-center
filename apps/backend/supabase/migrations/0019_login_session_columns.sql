-- Login session tracking columns on users.
--
-- The login flow (src/routes/auth.ts) selects and writes these columns, but no
-- earlier migration ever created them. PostgREST rejects the whole SELECT with
-- 42703 ("column does not exist"), the route treats that error as "user not
-- found", and every login returns 401 INVALID_CREDENTIALS regardless of the
-- password. Adding the columns is what makes login work.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS current_login_datetime  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_datetime     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS successful_login_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS key_token               TEXT,
  ADD COLUMN IF NOT EXISTS msg                     TEXT,
  ADD COLUMN IF NOT EXISTS status_value            VARCHAR(50),
  ADD COLUMN IF NOT EXISTS status_description      TEXT,
  ADD COLUMN IF NOT EXISTS version                 INTEGER NOT NULL DEFAULT 1;
