-- Platform-level super admin: may oversee data across every organization (e.g. sessions).
-- Organization owners stay limited to their own organization.
ALTER TABLE "users" ADD COLUMN "is_platform_admin" BOOLEAN NOT NULL DEFAULT false;

-- The seeded platform super admin account.
UPDATE "users" SET "is_platform_admin" = true WHERE "email" = 'admin@zellavora.com';
