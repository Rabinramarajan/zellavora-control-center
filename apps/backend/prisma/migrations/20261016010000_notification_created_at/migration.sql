-- Notifications had no creation time, so a member's feed could not be ordered. Existing rows take
-- the time they were sent, or the migration time when they never were.
ALTER TABLE "notifications" ADD COLUMN "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now();
UPDATE "notifications" SET "created_at" = "sent_at" WHERE "sent_at" IS NOT NULL;
CREATE INDEX "notifications_recipient_id_created_at_idx" ON "notifications"("recipient_id", "created_at" DESC);
