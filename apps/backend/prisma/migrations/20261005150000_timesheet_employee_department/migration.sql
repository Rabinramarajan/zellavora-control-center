-- Employee and department are editable per sheet; null falls back to the user profile.
ALTER TABLE "timesheets" ADD COLUMN "employee_name" VARCHAR(120);
ALTER TABLE "timesheets" ADD COLUMN "department" VARCHAR(120);
