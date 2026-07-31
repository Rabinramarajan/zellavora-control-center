-- Change organization_members.role from enum to varchar
ALTER TABLE "organization_members" ALTER COLUMN "role" TYPE VARCHAR USING "role"::text;