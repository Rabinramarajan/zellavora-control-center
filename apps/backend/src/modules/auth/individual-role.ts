/**
 * The role an INDIVIDUAL account holds in the default organization (zellavora-inc).
 *
 * Only personal-workspace permissions: the sidebar and every requirePermission()
 * gate derive what the person can reach from this list, so IAM, the approval
 * queue, operations and system configuration stay out of reach without any
 * registration-type special-casing.
 */
export const INDIVIDUAL_ROLE_NAME = 'Individual';

export const INDIVIDUAL_PERMISSIONS = [
  'dashboard:read',
  'portfolio:read',
  'projects:read',
  'projects:create',
  'projects:write',
  'projects:delete',
  'blog:read',
  'blog:manage',
  'media:read',
  'media:upload',
  'media:delete',
  'cms:read',
  'cms:manage',
  'themes:read',
  'themes:manage',
  'analytics:read',
  'analytics:export',
  'timesheet:read',
  'notifications:read',
] as const;
