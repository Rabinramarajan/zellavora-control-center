/**
 * requestContext — populates AsyncLocalStorage so the audit service and
 * @Audited decorator can resolve actor/tenant/ip/request metadata without
 * threading `req` through every service call.
 *
 * Place this BEFORE any route that writes audit entries. `authenticate` fills
 * req.userId/tenantId/ipAddress/requestId — this middleware runs in the same
 * chain and captures whatever is available (it is idempotent and cheap).
 */
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { runWithRequestContext } from '../infrastructure/request-context';
import type { AuthRequest } from './auth';

export const requestContext = (req: Request, res: Response, next: NextFunction): void => {
  const authReq = req as AuthRequest;
  const requestId = authReq.requestId ?? (req.headers['x-request-id'] as string) ?? crypto.randomUUID();

  // Echo the request id so clients can correlate failures.
  res.setHeader('x-request-id', requestId);

  runWithRequestContext(
    {
      actorId: authReq.userId ?? null,
      organizationId: authReq.tenantId ?? null,
      ipAddress:
        authReq.ipAddress ??
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
        req.ip ??
        '',
      userAgent: authReq.userAgent ?? (req.headers['user-agent'] as string) ?? '',
      requestId,
    },
    () => next()
  );
};
