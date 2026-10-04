-- AlterTable
ALTER TABLE "analytics_events" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "analytics_sessions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "blog_posts" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "email_settings" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "cms_pages" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "type" TEXT NOT NULL DEFAULT 'STANDARD',
    "template" VARCHAR(60),
    "parent_id" UUID,
    "meta_title" VARCHAR(70),
    "meta_description" VARCHAR(160),
    "seo" JSONB,
    "sections" JSONB,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "published_at" TIMESTAMPTZ,
    "scheduled_at" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cms_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_page_revisions" (
    "id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "sections" JSONB,
    "saved_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cms_page_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cms_pages_organization_id_is_deleted_status_idx" ON "cms_pages"("organization_id", "is_deleted", "status");

-- CreateIndex
CREATE INDEX "cms_pages_organization_id_type_idx" ON "cms_pages"("organization_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "cms_pages_organization_id_slug_key" ON "cms_pages"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "cms_page_revisions_page_id_version_idx" ON "cms_page_revisions"("page_id", "version");

-- AddForeignKey
ALTER TABLE "cms_page_revisions" ADD CONSTRAINT "cms_page_revisions_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "cms_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
