-- Employment end date and personal/family details shown on the read-only User Details screen.
ALTER TABLE "users"
  ADD COLUMN "end_date" DATE,
  ADD COLUMN "date_of_birth" DATE,
  ADD COLUMN "father_name" TEXT,
  ADD COLUMN "mother_name" TEXT,
  ADD COLUMN "marital_status" TEXT,
  ADD COLUMN "spouse_name" TEXT,
  ADD COLUMN "spouse_date_of_birth" DATE;
