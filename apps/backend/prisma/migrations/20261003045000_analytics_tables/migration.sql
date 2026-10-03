-- Analytics storage: the models existed in schema.prisma without a migration creating them.
DO $$ BEGIN
  CREATE TYPE "AnalyticsEventType" AS ENUM ('pageview', 'event');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "analytics_events" (
  "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "visitor_id"      VARCHAR(64) NOT NULL,
  "user_id"         UUID,
  "session_id"      UUID,
  "event_type"      "AnalyticsEventType" NOT NULL DEFAULT 'pageview',
  "event_name"      TEXT,
  "page_path"       TEXT,
  "page_title"      TEXT,
  "referrer"        TEXT,
  "device_type"     TEXT,
  "browser"         TEXT,
  "os"              TEXT,
  "country"         TEXT,
  "city"            TEXT,
  "properties"      JSONB,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "analytics_events_organization_id_created_at_idx"
  ON "analytics_events" ("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "analytics_events_organization_id_visitor_id_idx"
  ON "analytics_events" ("organization_id", "visitor_id");
CREATE INDEX IF NOT EXISTS "analytics_events_organization_id_event_type_idx"
  ON "analytics_events" ("organization_id", "event_type");
CREATE INDEX IF NOT EXISTS "analytics_events_session_id_idx"
  ON "analytics_events" ("session_id");

CREATE TABLE IF NOT EXISTS "analytics_sessions" (
  "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "visitor_id"      VARCHAR(64) NOT NULL,
  "user_id"         UUID,
  "started_at"      TIMESTAMPTZ NOT NULL,
  "ended_at"        TIMESTAMPTZ,
  "duration"        INTEGER,
  "page_views"      INTEGER NOT NULL DEFAULT 1,
  "events"          INTEGER NOT NULL DEFAULT 0,
  "entry_page"      TEXT,
  "exit_page"       TEXT,
  "referrer"        TEXT,
  "device_type"     TEXT,
  "browser"         TEXT,
  "os"              TEXT,
  "country"         TEXT,
  "city"            TEXT,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "analytics_sessions_organization_id_started_at_idx"
  ON "analytics_sessions" ("organization_id", "started_at");
CREATE INDEX IF NOT EXISTS "analytics_sessions_organization_id_visitor_id_idx"
  ON "analytics_sessions" ("organization_id", "visitor_id");
