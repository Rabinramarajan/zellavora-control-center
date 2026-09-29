-- CreateTable
CREATE TABLE "media_files" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "folder" VARCHAR(255) NOT NULL DEFAULT '',
    "name" VARCHAR(255) NOT NULL,
    "pathname" VARCHAR(512) NOT NULL,
    "mime_type" VARCHAR(127) NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "media_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_files_organization_id_created_at_idx" ON "media_files"("organization_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "media_files_organization_id_pathname_key" ON "media_files"("organization_id", "pathname");

-- AddForeignKey
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

