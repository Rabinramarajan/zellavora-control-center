-- Freelancer sheet sign-off becomes a mode. Organizations keep today's
-- reviewer-based flow; members may override it for themselves.
CREATE TYPE "ApprovalMode" AS ENUM ('NONE', 'SELF', 'EXTERNAL');

ALTER TABLE "organizations"
  ADD COLUMN "approval_mode" "ApprovalMode" NOT NULL DEFAULT 'EXTERNAL';

ALTER TABLE "organization_members" ADD COLUMN "approval_mode" "ApprovalMode";

-- Individual accounts have nobody to review them, so submitting finalizes.
UPDATE "organization_members" m
SET "approval_mode" = 'NONE'
FROM "users" u
WHERE u."id" = m."user_id" AND u."registration_type" = 'INDIVIDUAL';
