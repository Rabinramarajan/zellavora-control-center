-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "invoice_profiles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "legal_name" VARCHAR(200) NOT NULL,
    "address_lines" TEXT NOT NULL,
    "pan" VARCHAR(10),
    "gstin" VARCHAR(15),
    "email" VARCHAR(200),
    "phone" VARCHAR(30),
    "bank_account_name" VARCHAR(200) NOT NULL,
    "bank_name" VARCHAR(200) NOT NULL,
    "bank_branch" VARCHAR(200),
    "bank_account_number_enc" TEXT NOT NULL,
    "ifsc" VARCHAR(11) NOT NULL,
    "payment_terms_days" INTEGER NOT NULL DEFAULT 7,
    "default_terms" TEXT,
    "footer_note" TEXT,
    "created_by" UUID NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "invoice_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_clients" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "address_lines" TEXT NOT NULL,
    "gstin" VARCHAR(15),
    "attn_name" VARCHAR(200),
    "attn_designation" VARCHAR(200),
    "email" VARCHAR(200),
    "created_by" UUID NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "invoice_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_sequences" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "fy_label" VARCHAR(8) NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "invoice_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "monthly_sheet_id" UUID,
    "invoice_number" VARCHAR(32),
    "fy_label" VARCHAR(8),
    "sequence_no" INTEGER,
    "invoice_date" DATE NOT NULL,
    "due_date" DATE,
    "period_label" VARCHAR(200),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "advance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(12,2) NOT NULL,
    "amount_in_words" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "seller_snapshot" JSONB,
    "client_snapshot" JSONB,
    "bank_snapshot" JSONB,
    "terms" TEXT,
    "footer_note" TEXT,
    "issued_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancel_reason" TEXT,
    "created_by" UUID NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "sl_no" INTEGER NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "note" VARCHAR(500),
    "qty" DECIMAL(10,2) NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoice_profiles_organization_id_user_id_key" ON "invoice_profiles"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "invoice_clients_organization_id_user_id_idx" ON "invoice_clients"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_sequences_organization_id_user_id_fy_label_key" ON "invoice_sequences"("organization_id", "user_id", "fy_label");

-- CreateIndex
CREATE INDEX "invoices_organization_id_user_id_invoice_date_idx" ON "invoices"("organization_id", "user_id", "invoice_date" DESC);

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_organization_id_user_id_invoice_number_key" ON "invoices"("organization_id", "user_id", "invoice_number");

-- CreateIndex
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items"("invoice_id");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "invoice_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A month may be invoiced again only after its earlier invoice is cancelled
-- or the draft deleted.
CREATE UNIQUE INDEX "invoices_monthly_sheet_live_key" ON "invoices"("monthly_sheet_id")
  WHERE "monthly_sheet_id" IS NOT NULL AND "deleted_at" IS NULL AND "status" <> 'CANCELLED';
