-- Backfill identity fields for accounts created before User Request provisioning,
-- so User Search / User Details have an employee code, begin date and username.

-- Begin date: the day the account was created.
UPDATE "users"
SET "joining_date" = "created_at"::date
WHERE "joining_date" IS NULL;

-- Employee code: EMP + zero-padded user number (matches the USR000236 style), skipping any clash.
UPDATE "users" u
SET "employee_code" = 'EMP' || lpad(u."user_no"::text, 5, '0')
WHERE u."employee_code" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "users" o WHERE o."employee_code" = 'EMP' || lpad(u."user_no"::text, 5, '0')
  );

-- Username: the email local part, lower-cased, skipping any clash.
UPDATE "users" u
SET "username" = lower(split_part(u."email", '@', 1))
WHERE u."username" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "users" o
    WHERE o."id" <> u."id" AND lower(o."username") = lower(split_part(u."email", '@', 1))
  )
  AND (
    SELECT count(*) FROM "users" d
    WHERE d."username" IS NULL
      AND lower(split_part(d."email", '@', 1)) = lower(split_part(u."email", '@', 1))
  ) = 1;
