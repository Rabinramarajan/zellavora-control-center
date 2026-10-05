import { INDIVIDUAL_ROLE_NAME } from '../auth/individual-role';
import type { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/error';

/**
 * Who the dashboard is being computed for.
 *
 * INDIVIDUAL accounts all share the default organization (see
 * AuthService.joinDefaultOrganization), so the tenant id alone does not
 * isolate them from one another — their aggregations must additionally be
 * narrowed to their own user id.
 */
export type DashboardScope =
  | { kind: 'organization'; organizationId: string }
  | { kind: 'individual'; organizationId: string; userId: string };

/**
 * Derive the scope from verified JWT claims only. A client-supplied tenant id
 * or role is never consulted, so a caller cannot widen their own view.
 */
export function resolveScope(req: AuthRequest): DashboardScope {
  const { userId, tenantId, role } = req;
  if (!userId || !tenantId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  return role === INDIVIDUAL_ROLE_NAME
    ? { kind: 'individual', organizationId: tenantId, userId }
    : { kind: 'organization', organizationId: tenantId };
}

/** Stable cache discriminator — distinct per tenant and, for individuals, per user. */
export function scopeCacheKey(scope: DashboardScope): string {
  return scope.kind === 'individual'
    ? `ind:${scope.organizationId}:${scope.userId}`
    : `org:${scope.organizationId}`;
}
