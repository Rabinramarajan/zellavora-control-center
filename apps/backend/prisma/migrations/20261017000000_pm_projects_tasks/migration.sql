-- CreateEnum
CREATE TYPE "PmProjectStatus" AS ENUM ('PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PmVisibility" AS ENUM ('PRIVATE', 'TEAM', 'ORG');

-- CreateEnum
CREATE TYPE "PmMemberRole" AS ENUM ('PM_LEAD', 'CONTRIBUTOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "PmPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "PmMilestoneStatus" AS ENUM ('OPEN', 'DONE');

-- CreateEnum
CREATE TYPE "PmRecurrence" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "pm_projects" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "key" VARCHAR(10) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "status" "PmProjectStatus" NOT NULL DEFAULT 'PLANNED',
    "visibility" "PmVisibility" NOT NULL DEFAULT 'PRIVATE',
    "owner_id" UUID NOT NULL,
    "team_id" UUID,
    "start_date" DATE,
    "due_date" DATE,
    "budget_hours" DECIMAL(9,2),
    "columns" JSONB NOT NULL,
    "task_counter" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "pm_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pm_project_members" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "PmMemberRole" NOT NULL DEFAULT 'CONTRIBUTOR',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pm_project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pm_milestones" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "due_date" DATE,
    "status" "PmMilestoneStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pm_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pm_tasks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "parent_id" UUID,
    "milestone_id" UUID,
    "number" INTEGER NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(40) NOT NULL,
    "priority" "PmPriority" NOT NULL DEFAULT 'MEDIUM',
    "assignee_id" UUID,
    "reporter_id" UUID NOT NULL,
    "due_date" DATE,
    "estimate_hours" DECIMAL(7,2),
    "position" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "completed_at" TIMESTAMPTZ(6),
    "recurrence" "PmRecurrence" NOT NULL DEFAULT 'NONE',
    "recurrence_spawned_at" TIMESTAMPTZ(6),
    "recurrence_parent_id" UUID,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "pm_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pm_task_dependencies" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "depends_on_task_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pm_task_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pm_task_comments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "edited_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "pm_task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pm_task_activity" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "actor_id" UUID,
    "type" VARCHAR(40) NOT NULL,
    "data" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pm_task_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pm_templates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "definition" JSONB NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "pm_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pm_projects_organization_id_status_idx" ON "pm_projects"("organization_id", "status");

-- CreateIndex
CREATE INDEX "pm_projects_organization_id_owner_id_idx" ON "pm_projects"("organization_id", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "pm_projects_organization_id_key_key" ON "pm_projects"("organization_id", "key");

-- CreateIndex
CREATE INDEX "pm_project_members_user_id_idx" ON "pm_project_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "pm_project_members_project_id_user_id_key" ON "pm_project_members"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "pm_milestones_project_id_idx" ON "pm_milestones"("project_id");

-- CreateIndex
CREATE INDEX "pm_tasks_organization_id_assignee_id_is_deleted_idx" ON "pm_tasks"("organization_id", "assignee_id", "is_deleted");

-- CreateIndex
CREATE INDEX "pm_tasks_project_id_status_position_idx" ON "pm_tasks"("project_id", "status", "position");

-- CreateIndex
CREATE INDEX "pm_tasks_project_id_due_date_idx" ON "pm_tasks"("project_id", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "pm_tasks_project_id_number_key" ON "pm_tasks"("project_id", "number");

-- CreateIndex
CREATE INDEX "pm_task_dependencies_depends_on_task_id_idx" ON "pm_task_dependencies"("depends_on_task_id");

-- CreateIndex
CREATE UNIQUE INDEX "pm_task_dependencies_task_id_depends_on_task_id_key" ON "pm_task_dependencies"("task_id", "depends_on_task_id");

-- CreateIndex
CREATE INDEX "pm_task_comments_task_id_created_at_idx" ON "pm_task_comments"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "pm_task_activity_task_id_created_at_idx" ON "pm_task_activity"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "pm_templates_organization_id_is_deleted_idx" ON "pm_templates"("organization_id", "is_deleted");

-- AddForeignKey
ALTER TABLE "pm_projects" ADD CONSTRAINT "pm_projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pm_project_members" ADD CONSTRAINT "pm_project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "pm_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pm_milestones" ADD CONSTRAINT "pm_milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "pm_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pm_tasks" ADD CONSTRAINT "pm_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "pm_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pm_tasks" ADD CONSTRAINT "pm_tasks_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "pm_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pm_tasks" ADD CONSTRAINT "pm_tasks_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "pm_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pm_task_dependencies" ADD CONSTRAINT "pm_task_dependencies_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "pm_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pm_task_dependencies" ADD CONSTRAINT "pm_task_dependencies_depends_on_task_id_fkey" FOREIGN KEY ("depends_on_task_id") REFERENCES "pm_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pm_task_comments" ADD CONSTRAINT "pm_task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "pm_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pm_task_activity" ADD CONSTRAINT "pm_task_activity_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "pm_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Permissions. Deliberately not `projects:*`: those codes already guard the portfolio showcase and
-- technologies, so reusing them would hand portfolio editors control of delivery projects.
INSERT INTO "permissions" ("id", "name", "key", "resource", "action", "description")
VALUES
  (gen_random_uuid(), 'read:pm-projects',          'pm:projects:read',           'pm:projects', 'read',           'View delivery projects you can access'),
  (gen_random_uuid(), 'write:pm-projects',         'pm:projects:write',          'pm:projects', 'write',          'Create and edit delivery projects'),
  (gen_random_uuid(), 'members:pm-projects',       'pm:projects:manage-members', 'pm:projects', 'manage-members', 'Add and remove project members'),
  (gen_random_uuid(), 'report:pm-projects',        'pm:projects:report',         'pm:projects', 'report',         'View project progress and reports'),
  (gen_random_uuid(), 'read:pm-tasks',             'pm:tasks:read',              'pm:tasks',    'read',           'View tasks in projects you can access'),
  (gen_random_uuid(), 'write:pm-tasks',            'pm:tasks:write',             'pm:tasks',    'write',          'Create and edit tasks'),
  (gen_random_uuid(), 'comment:pm-tasks',          'pm:tasks:comment',           'pm:tasks',    'comment',        'Comment on tasks'),
  (gen_random_uuid(), 'manage:pm-templates',       'pm:templates:manage',        'pm:templates','manage',         'Create and edit project templates')
ON CONFLICT DO NOTHING;

-- Every member role can see projects and work on tasks they belong to; project roles still limit writes.
INSERT INTO "role_permissions" ("id", "organization_id", "role_id", "permission_id", "effect")
SELECT gen_random_uuid(), rp."organization_id", rp."role_id", np."id", 'allow'
FROM "role_permissions" rp
JOIN "permissions" op ON op."id" = rp."permission_id" AND rp."effect" = 'allow'
JOIN "permissions" np ON np."key" IN ('pm:projects:read', 'pm:tasks:read', 'pm:tasks:write', 'pm:tasks:comment')
WHERE op."key" = 'portfolio:read'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- Roles that administer settings also create projects, manage members, read reports and own templates.
INSERT INTO "role_permissions" ("id", "organization_id", "role_id", "permission_id", "effect")
SELECT gen_random_uuid(), rp."organization_id", rp."role_id", np."id", 'allow'
FROM "role_permissions" rp
JOIN "permissions" op ON op."id" = rp."permission_id" AND rp."effect" = 'allow'
JOIN "permissions" np ON np."key" IN ('pm:projects:write', 'pm:projects:manage-members', 'pm:projects:report', 'pm:templates:manage')
WHERE op."key" = 'settings:manage'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
