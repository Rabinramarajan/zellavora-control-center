-- CreateTable
CREATE TABLE "ddl_lists" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,
    "phone_code" TEXT,
    "extra" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ddl_lists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ddl_lists_type_is_active_idx" ON "ddl_lists"("type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "ddl_lists_type_key_key" ON "ddl_lists"("type", "key");
