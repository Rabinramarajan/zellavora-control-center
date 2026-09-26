-- Daily sheets name their project as free text, so a freelancer can log work
-- against a client project that is not set up as a managed Project.

-- AlterTable
ALTER TABLE "daily_sheets" ADD COLUMN "project_name" VARCHAR(200);

-- Carry existing links over as text, so older sheets keep their label.
UPDATE "daily_sheets" AS d
SET "project_name" = p."name"
FROM "projects" AS p
WHERE d."project_id" = p."id" AND d."project_name" IS NULL;
