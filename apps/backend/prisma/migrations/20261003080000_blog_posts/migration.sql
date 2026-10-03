-- Blog / Insights posts, scoped per organization.
CREATE TABLE IF NOT EXISTS "blog_posts" (
  "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "title"           VARCHAR(200) NOT NULL,
  "slug"            VARCHAR(200) NOT NULL,
  "excerpt"         VARCHAR(400),
  "content"         TEXT NOT NULL DEFAULT '',
  "category"        VARCHAR(60) NOT NULL,
  "tags"            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "cover_image_url" TEXT,
  "status"          TEXT NOT NULL DEFAULT 'DRAFT',
  "published_at"    TIMESTAMPTZ,
  "view_count"      INTEGER NOT NULL DEFAULT 0,
  "reading_minutes" INTEGER NOT NULL DEFAULT 1,
  "seo_title"       VARCHAR(70),
  "seo_description" VARCHAR(160),
  "author_id"       UUID,
  "is_deleted"      BOOLEAN NOT NULL DEFAULT false,
  "deleted_at"      TIMESTAMPTZ,
  "created_by"      UUID,
  "updated_by"      UUID,
  "version"         INTEGER NOT NULL DEFAULT 1,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "blog_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "blog_posts_organization_id_slug_key" ON "blog_posts" ("organization_id", "slug");
CREATE INDEX IF NOT EXISTS "blog_posts_organization_id_is_deleted_status_idx" ON "blog_posts" ("organization_id", "is_deleted", "status");
CREATE INDEX IF NOT EXISTS "blog_posts_organization_id_published_at_idx" ON "blog_posts" ("organization_id", "published_at");

INSERT INTO "permissions" ("id", "name", "key", "resource", "action", "description")
VALUES
  (gen_random_uuid(), 'read:blog',   'blog:read',   'blog', 'read',   'View blog posts and insights'),
  (gen_random_uuid(), 'manage:blog', 'blog:manage', 'blog', 'manage', 'Create, edit, publish and delete blog posts')
ON CONFLICT DO NOTHING;

-- Settings managers run the blog; dashboard viewers can read it.
INSERT INTO "role_permissions" ("id", "organization_id", "role_id", "permission_id", "effect")
SELECT gen_random_uuid(), rp."organization_id", rp."role_id", np."id", 'allow'
FROM "role_permissions" rp
JOIN "permissions" op ON op."id" = rp."permission_id" AND rp."effect" = 'allow'
JOIN "permissions" np ON
     (op."key" = 'settings:write' AND np."key" IN ('blog:read', 'blog:manage'))
  OR (op."key" = 'dashboard:read' AND np."key" = 'blog:read')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
