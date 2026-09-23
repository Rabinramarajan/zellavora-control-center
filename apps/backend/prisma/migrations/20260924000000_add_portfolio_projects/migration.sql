-- CreateTable
CREATE TABLE "portfolio_projects" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "content" TEXT,
    "category" VARCHAR(100),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "cover_image_url" TEXT,
    "thumbnail_url" TEXT,
    "github_url" TEXT,
    "live_demo_url" TEXT,
    "website_url" TEXT,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMPTZ,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "portfolio_projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portfolio_projects_status_idx" ON "portfolio_projects"("status");

-- CreateIndex
CREATE INDEX "portfolio_projects_created_at_idx" ON "portfolio_projects"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_projects_organization_id_slug_key" ON "portfolio_projects"("organization_id", "slug");

-- AddForeignKey
ALTER TABLE "portfolio_projects" ADD CONSTRAINT "portfolio_projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

