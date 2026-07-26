/**
 * Auth Middleware — JWT verification, tenant binding, role + permission gates.
 *
 * Layered:
 *   authenticate        — verifies access token, attaches claims to req
 *   requireRole(...)    — role check (coarse)
 *   requirePermission(…) — permission check (granular, takes wildcards)
 *   loadPermissions     — populates req.permissions for downstream use
 *   assertSameTenant    — rejects requests whose X-Tenant-ID doesn't match the JWT
 *
 * Tokens carry tenantId in `tid`; we never trust a client-provided tenant id
 * for the actual data fetch (the X-Tenant-ID header is for cross-checking).
 */
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { TokenService, type AccessTokenClaims, SessionService, TenantService } from '../services/auth';
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

    // Touch the session for sliding-window idle tracking
    SessionService.touch(claims.sid).catch(() => {/* best-effort */});

    next();
  } catch (e) {
    next(e);
  }
};

/** Block requests whose X-Tenant-ID doesn't match the JWT's tenant. */
export const assertSameTenant = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void => {
  const headerTenant = (req.headers['x-tenant-id'] as string)?.toLowerCase();
  if (headerTenant && req.tenantId && headerTenant !== req.tenantId.toLowerCase()) {
    return next(new AppError('Tenant context mismatch', 403, 'TENANT_MISMATCH'));
  }
  next();
};

/** Coarse role check. Roles are org-relative so this is checked after authenticate. */
export const requireRole =
  (...roles: string[]) =>
  (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.role || !roles.includes(req.role)) {
      return next(new AppError('Insufficient role', 403, 'FORBIDDEN_ROLE'));
    }
    next();
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

/**
 * Backward-compatible: keep the old `authenticateToken` / `authorize` exports
 * so existing routes don't break. They delegate to the new functions above.
 */
export const authenticateToken = authenticate;
export const authorize = requireRole;
