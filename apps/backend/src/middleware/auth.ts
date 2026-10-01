/**
 * Auth Middleware — JWT verification, tenant binding, role + permission gates.
 *
 * Layered:
 *   authenticate        — verifies access token, attaches claims to req
 *   requirePermission(…) — permission check (granular, takes wildcards)
 *   loadPermissions     — populates req.permissions for downstream use
 *
 * Tokens carry tenantId in `tid`; we never trust a client-provided tenant id
 * for the actual data fetch (the X-Tenant-ID header is for cross-checking).
 */
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { TokenService, type AccessTokenClaims, SessionService } from '../services/auth';
import { SecurityPolicyService } from '../modules/security-policy/security-policy.service';
import { AppError } from './error';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  tenantId?: string;
  role?: string;
  sessionId?: string;
  token?: string;
  tokenClaims?: AccessTokenClaims;
  permissions?: Set<string>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

const extractToken = (req: Request): string | null => {
  const auth = req.headers['authorization'];
  if (!auth) return null;
  const parts = auth.split(' ');
  return parts.length === 2 && /^Bearer$/i.test(parts[0]) ? parts[1] : null;
};

const attachMetadata = (req: AuthRequest): void => {
  req.ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? '';
  req.userAgent = (req.headers['user-agent'] as string) ?? '';
  req.requestId = (req.headers['x-request-id'] as string) ?? crypto.randomUUID();
};

/** Verify the access token. Throws 401 on bad/expired/revoked. */
export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);
    if (!token) throw new AppError('No token provided', 401, 'NO_TOKEN');

    const claims = await TokenService.verifyAccess(token);

    req.userId = claims.sub;
    req.userEmail = claims.email;
    req.tenantId = claims.tid;
    req.role = claims.role;
    req.sessionId = claims.sid;
    req.token = token;
    req.tokenClaims = claims;

    attachMetadata(req);

    // Access tokens outlive a logout by up to their TTL unless the session is
    // checked here; this is what makes logout / revoke / password reset immediate.
    const { login } = await SecurityPolicyService.forOrganization(claims.tid);
    if (!(await SessionService.touchIfActive(claims.sid, claims.sub, login.sessionIdleMinutes))) {
      throw new AppError('Session expired or revoked', 401, 'SESSION_REVOKED');
    }

    next();
  } catch (e) {
    next(e);
  }
};

/**
 * Granular permission check. The middleware loads the user's effective permission
 * set on first hit and caches it on the request. Use this in front of any
 * endpoint that maps to a permission code.
 */
export const requirePermission =
  (...codes: string[]) =>
  async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.userId || !req.tenantId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }
      const { PermissionService } = await import('../services/auth');
      // Lazy-load on first hit
      if (!req.permissions) {
        req.permissions = await PermissionService.loadForUser(req.userId, req.tenantId);
      }
      const ok = codes.some((c) => PermissionService.has(req.permissions!, c));
      if (!ok) throw new AppError('Insufficient permission', 403, 'FORBIDDEN_PERMISSION');
      next();
    } catch (e) {
      next(e);
    }
  };

/** Backward-compatible alias so existing routes don't break. */
export const authenticateToken = authenticate;
/** `authGuard` alias so the foundation naming matches module prompts. */
export const authGuard = authenticate;
