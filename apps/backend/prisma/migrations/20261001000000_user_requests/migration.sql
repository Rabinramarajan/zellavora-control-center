-- Organization / employee attributes set by user-request provisioning
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "employee_code" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "user_type" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "branch_id" UUID;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reporting_manager_id" UUID;
CREATE UNIQUE INDEX IF NOT EXISTS "users_employee_code_key" ON "users"("employee_code");

-- Reference numbers are allocated from a sequence so concurrent creates never collide.
CREATE SEQUENCE IF NOT EXISTS "user_request_ref_seq";

CREATE TABLE "user_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "ref_no" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "source" TEXT NOT NULL DEFAULT 'ADMIN_PORTAL',
    "target_user_id" UUID,
    "requested_by_id" UUID,
    "subject_name" TEXT,
    "subject_email" TEXT,
    "employee_code" TEXT,
    "branch_id" UUID,
    "department_id" UUID,
    "team_id" UUID,
    "group_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "role_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "justification" TEXT NOT NULL,
    "effective_from" TIMESTAMPTZ,
    "effective_until" TIMESTAMPTZ,
    "attachment_url" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "snapshot" JSONB,
    "current_step" INTEGER,
    "submitted_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "failure_reason" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_requests_ref_no_key" ON "user_requests"("ref_no");
CREATE INDEX "user_requests_organization_id_status_idx" ON "user_requests"("organization_id", "status");
CREATE INDEX "user_requests_organization_id_created_at_idx" ON "user_requests"("organization_id", "created_at" DESC);
CREATE INDEX "user_requests_target_user_id_idx" ON "user_requests"("target_user_id");
CREATE INDEX "user_requests_requested_by_id_idx" ON "user_requests"("requested_by_id");

ALTER TABLE "user_requests" ADD CONSTRAINT "user_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_requests" ADD CONSTRAINT "user_requests_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_requests" ADD CONSTRAINT "user_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "user_request_approvals" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "step_name" TEXT NOT NULL,
    "approver_id" UUID,
    "approver_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "assigned_at" TIMESTAMPTZ,
    "actioned_at" TIMESTAMPTZ,
    "actioned_by_id" UUID,
    "actioned_by_name" TEXT,
    "comments" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_request_approvals_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "user_request_approvals_request_id_idx" ON "user_request_approvals"("request_id");
ALTER TABLE "user_request_approvals" ADD CONSTRAINT "user_request_approvals_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "user_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "user_request_events" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "actor_id" UUID,
    "actor_name" TEXT,
    "comments" TEXT,
    "correlation_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_request_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "user_request_events_request_id_created_at_idx" ON "user_request_events"("request_id", "created_at");
ALTER TABLE "user_request_events" ADD CONSTRAINT "user_request_events_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "user_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "user_request_notes" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "note_type" TEXT NOT NULL DEFAULT 'GENERAL',
    "visibility" TEXT NOT NULL DEFAULT 'INTERNAL',
    "body" TEXT NOT NULL,
    "attachment_url" TEXT,
    "author_id" UUID,
    "author_name" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_request_notes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "user_request_notes_request_id_created_at_idx" ON "user_request_notes"("request_id", "created_at");
ALTER TABLE "user_request_notes" ADD CONSTRAINT "user_request_notes_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "user_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "user_request_emails" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "template" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body_text" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "delivery_status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "sent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_request_emails_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "user_request_emails_request_id_idx" ON "user_request_emails"("request_id");
ALTER TABLE "user_request_emails" ADD CONSTRAINT "user_request_emails_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "user_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
