-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED', 'PENDING', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "EntityStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "GroupType" AS ENUM ('SECURITY', 'ORG', 'DISTRIBUTION', 'PROJECT', 'DYNAMIC');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ResourceType" AS ENUM ('API', 'FEATURE', 'DATA', 'MENU', 'REPORT', 'INTEGRATION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "RoleScope" AS ENUM ('GLOBAL', 'ORG', 'RESOURCE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "department" TEXT,
ADD COLUMN IF NOT EXISTS "job_title" TEXT,
ADD COLUMN IF NOT EXISTS "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "scope" "RoleScope" NOT NULL DEFAULT 'ORG',
ADD COLUMN IF NOT EXISTS "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "permissions" ADD COLUMN IF NOT EXISTS "key" TEXT,
ADD COLUMN IF NOT EXISTS "resource" TEXT,
ADD COLUMN IF NOT EXISTS "action" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "permissions_key_key" ON "permissions"("key");

-- CreateTable
CREATE TABLE IF NOT EXISTS "groups" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "type" "GroupType" NOT NULL DEFAULT 'SECURITY',
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "parent_id" UUID,
    "owner_id" UUID,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_groups" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "group_roles" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "group_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "resources" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" "ResourceType" NOT NULL DEFAULT 'FEATURE',
    "category" TEXT,
    "description" TEXT,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "parent_id" UUID,
    "owner_id" UUID,
    "metadata" JSONB,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "resource_actions" (
    "id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "permission_id" UUID,
    CONSTRAINT "resource_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "groups_name_key" ON "groups"("name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "groups_slug_key" ON "groups"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "groups_parent_id_idx" ON "groups"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_groups_user_id_group_id_key" ON "user_groups"("user_id", "group_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_groups_group_id_idx" ON "user_groups"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "group_roles_group_id_role_id_key" ON "group_roles"("group_id", "role_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "group_roles_role_id_idx" ON "group_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "resources_key_key" ON "resources"("key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "resources_parent_id_idx" ON "resources"("parent_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "resources_type_idx" ON "resources"("type");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "resource_actions_resource_id_action_key" ON "resource_actions"("resource_id", "action");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "resource_actions_permission_id_idx" ON "resource_actions"("permission_id");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "groups" ADD CONSTRAINT "groups_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "group_roles" ADD CONSTRAINT "group_roles_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "group_roles" ADD CONSTRAINT "group_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "resources" ADD CONSTRAINT "resources_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "resource_actions" ADD CONSTRAINT "resource_actions_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "resource_actions" ADD CONSTRAINT "resource_actions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill permission keys for existing permissions (name -> resource:action heuristics).
UPDATE "permissions" SET
  "key" = lower(regexp_replace("name", '[^a-zA-Z0-9]+', ':', 'g')),
  "resource" = split_part(lower(regexp_replace("name", '[^a-zA-Z0-9]+', ':', 'g')), ':', 1),
  "action" = split_part(lower(regexp_replace("name", '[^a-zA-Z0-9]+', ':', 'g')), ':', 2)
WHERE "key" IS NULL AND "name" IS NOT NULL;

-- Ensure uniqueness on key for the backfill (append suffix on collisions).
UPDATE "permissions" p
SET "key" = p."key" || '-' || p."id"
WHERE EXISTS (
  SELECT 1 FROM "permissions" p2
  WHERE p2."key" = p."key" AND p2."id" < p."id"
) AND p."key" IS NOT NULL;
