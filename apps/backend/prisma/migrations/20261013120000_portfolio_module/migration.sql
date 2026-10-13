-- Portfolio module: owner-scoped profile, hero, about and collection tables.
-- Replaces the Supabase-only tables that routes/portfolio.ts used to query.

-- CreateTable
CREATE TABLE "portfolio_profiles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "display_name" VARCHAR(120),
    "headline" VARCHAR(160),
    "location" VARCHAR(120),
    "email" VARCHAR(254),
    "phone" VARCHAR(30),
    "website" VARCHAR(500),
    "github" VARCHAR(500),
    "linkedin" VARCHAR(500),
    "twitter" VARCHAR(500),
    "avatar_url" VARCHAR(1000),
    "resume_url" VARCHAR(1000),
    "hero_greeting" VARCHAR(80),
    "hero_title" VARCHAR(160),
    "hero_subtitle" VARCHAR(400),
    "hero_primary_cta_label" VARCHAR(40),
    "hero_primary_cta_url" VARCHAR(500),
    "hero_secondary_cta_label" VARCHAR(40),
    "hero_secondary_cta_url" VARCHAR(500),
    "hero_image_url" VARCHAR(1000),
    "about_body" TEXT,
    "about_image_url" VARCHAR(1000),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "portfolio_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_skills" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "category" VARCHAR(60),
    "level" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "portfolio_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_experiences" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(160) NOT NULL,
    "company" VARCHAR(160) NOT NULL,
    "location" VARCHAR(120),
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "portfolio_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_education" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "institution" VARCHAR(160) NOT NULL,
    "degree" VARCHAR(160) NOT NULL,
    "field" VARCHAR(160),
    "grade" VARCHAR(60),
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "portfolio_education_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_services" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(1000),
    "icon" VARCHAR(40),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "portfolio_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_testimonials" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "author_name" VARCHAR(120) NOT NULL,
    "author_role" VARCHAR(160),
    "company" VARCHAR(160),
    "quote" TEXT NOT NULL,
    "avatar_url" VARCHAR(1000),
    "rating" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "portfolio_testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portfolio_profiles_is_public_updated_at_idx" ON "portfolio_profiles"("is_public", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_profiles_organization_id_user_id_key" ON "portfolio_profiles"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "portfolio_skills_organization_id_user_id_deleted_at_sort_or_idx" ON "portfolio_skills"("organization_id", "user_id", "deleted_at", "sort_order");

-- CreateIndex
CREATE INDEX "portfolio_experiences_organization_id_user_id_deleted_at_so_idx" ON "portfolio_experiences"("organization_id", "user_id", "deleted_at", "sort_order");

-- CreateIndex
CREATE INDEX "portfolio_education_organization_id_user_id_deleted_at_sort_idx" ON "portfolio_education"("organization_id", "user_id", "deleted_at", "sort_order");

-- CreateIndex
CREATE INDEX "portfolio_services_organization_id_user_id_deleted_at_sort__idx" ON "portfolio_services"("organization_id", "user_id", "deleted_at", "sort_order");

-- CreateIndex
CREATE INDEX "portfolio_testimonials_organization_id_user_id_deleted_at_s_idx" ON "portfolio_testimonials"("organization_id", "user_id", "deleted_at", "sort_order");

-- AddForeignKey
ALTER TABLE "portfolio_profiles" ADD CONSTRAINT "portfolio_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_skills" ADD CONSTRAINT "portfolio_skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_experiences" ADD CONSTRAINT "portfolio_experiences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_education" ADD CONSTRAINT "portfolio_education_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_services" ADD CONSTRAINT "portfolio_services_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_testimonials" ADD CONSTRAINT "portfolio_testimonials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Introduce portfolio:manage (writes). Existing grants of portfolio:read keep
-- read access; every role that can read the portfolio also gets write access,
-- so current personal accounts keep editing their own portfolio after deploy.
INSERT INTO "permissions" ("id", "name", "key", "resource", "action", "description", "created_at")
VALUES (gen_random_uuid(), 'manage:portfolio', 'portfolio:manage', 'portfolio', 'manage',
        'Create, edit and delete portfolio sections', now())
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("id", "organization_id", "role_id", "permission_id", "effect")
SELECT gen_random_uuid(), rp."organization_id", rp."role_id", manage."id", 'allow'
FROM "role_permissions" rp
JOIN "permissions" read_perm ON read_perm."id" = rp."permission_id" AND read_perm."key" = 'portfolio:read'
JOIN "permissions" manage ON manage."key" = 'portfolio:manage'
WHERE rp."effect" = 'allow'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
