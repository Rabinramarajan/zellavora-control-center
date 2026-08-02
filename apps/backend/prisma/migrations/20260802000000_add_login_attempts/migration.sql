-- CreateTable
CREATE TABLE "login_attempts" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "client_code" VARCHAR(16),
    "ip_address" INET,
    "user_agent" TEXT,
    "success" BOOLEAN NOT NULL,
    "failure_reason" VARCHAR(50),
    "attempted_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_login_attempts_email_time" ON "login_attempts"("email", "attempted_at" DESC);

-- CreateIndex
CREATE INDEX "idx_login_attempts_ip_time" ON "login_attempts"("ip_address", "attempted_at" DESC);

-- CreateIndex
CREATE INDEX "idx_login_attempts_time" ON "login_attempts"("attempted_at" DESC);
