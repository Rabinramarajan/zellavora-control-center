-- CreateTable
CREATE TABLE "pm_task_attachments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(127) NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "data" BYTEA NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "pm_task_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pm_time_entries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "hours" DECIMAL(5,2) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "pm_time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pm_task_attachments_task_id_is_deleted_idx" ON "pm_task_attachments"("task_id", "is_deleted");

-- CreateIndex
CREATE INDEX "pm_time_entries_task_id_is_deleted_idx" ON "pm_time_entries"("task_id", "is_deleted");

-- CreateIndex
CREATE INDEX "pm_time_entries_project_id_work_date_idx" ON "pm_time_entries"("project_id", "work_date");

-- CreateIndex
CREATE INDEX "pm_time_entries_organization_id_user_id_work_date_idx" ON "pm_time_entries"("organization_id", "user_id", "work_date");

-- AddForeignKey
ALTER TABLE "pm_task_attachments" ADD CONSTRAINT "pm_task_attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "pm_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pm_time_entries" ADD CONSTRAINT "pm_time_entries_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "pm_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

