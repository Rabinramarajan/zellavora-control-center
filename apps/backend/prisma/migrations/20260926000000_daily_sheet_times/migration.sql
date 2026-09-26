-- Daily sheets record the entry type (work, leave, holiday), the worked span
-- and billability, and a day may now
-- hold several entries (one per project or task).

-- AlterTable
ALTER TABLE "daily_sheets"
  ADD COLUMN "entry_type" VARCHAR(16) NOT NULL DEFAULT 'work',
  ADD COLUMN "start_time" VARCHAR(5),
  ADD COLUMN "end_time" VARCHAR(5),
  ADD COLUMN "break_minutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "is_billable" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "submitted_at" TIMESTAMPTZ;

-- DropIndex
DROP INDEX IF EXISTS "daily_sheets_user_id_sheet_date_organization_id_key";

-- CreateIndex
CREATE INDEX "daily_sheets_organization_id_sheet_date_idx" ON "daily_sheets"("organization_id", "sheet_date");
