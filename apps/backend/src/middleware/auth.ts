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
import { prisma } from '../infrastructure/prisma';
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
  isPlatformAdmin?: boolean;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

/**
 * Marks a middleware as an access guard. The route-guard spec reads the mark to prove that every
 * route is behind authentication; a handler that merely looks like a guard does not count.
 */
export const GUARD_MARK = Symbol.for('zcc.access-guard');
export const markGuard = <T extends (...args: never[]) => unknown>(fn: T): T => {
  (fn as T & { [GUARD_MARK]?: boolean })[GUARD_MARK] = true;
  return fn;
};

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

markGuard(authenticate);

/**
 * Granular permission check. The middleware loads the user's effective permission
 * set on first hit and caches it on the request. Use this in front of any
 * endpoint that maps to a permission code.
 */
export const requirePermission = (...codes: string[]) =>
  markGuard(async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
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
  });

/**
 * Whether the caller is a platform operator (users.is_platform_admin). Tenant
 * wildcard grants such as the Owner's `*:*` never imply this, so platform-only
 * routes gate on this flag instead of a permission code. Checked against the
 * database on each call: it is cached on the request only.
 */
export const resolvePlatformAdmin = async (req: AuthRequest): Promise<boolean> => {
  if (req.isPlatformAdmin !== undefined) return req.isPlatformAdmin;
  if (!req.userId) return false;
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { isPlatformAdmin: true, isDeleted: true, status: true },
  });
  req.isPlatformAdmin =
    !!user && user.isPlatformAdmin && !user.isDeleted && user.status === 'ACTIVE';
  return req.isPlatformAdmin;
};

/** Platform-operator gate; tenant admins, whatever their permissions, get 403. */
export const requirePlatformAdmin = markGuard(
  async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      if (!(await resolvePlatformAdmin(req))) {
        throw new AppError('Platform administrator access required', 403, 'FORBIDDEN_PLATFORM');
      }
      next();
    } catch (e) {
      next(e);
    }
  }
);

/** Backward-compatible alias so existing routes don't break. */
export const authenticateToken = authenticate;
/** `authGuard` alias so the foundation naming matches module prompts. */
export const authGuard = authenticate;
