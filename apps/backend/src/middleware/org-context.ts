import type { AuthRequest } from './auth';
import { AppError } from './error';

export interface OrgContext {
  organizationId: string;
  actorId: string;
}

/** The caller's organization and user id; every org-scoped admin endpoint starts here. */
export const orgContextOf = (req: AuthRequest): OrgContext => {
  if (!req.userId || !req.tenantId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  return { organizationId: req.tenantId, actorId: req.userId };
};
