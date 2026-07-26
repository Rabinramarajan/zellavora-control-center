import jwt from 'npm:jsonwebtoken@9.0.2';
import { getSupabaseAdmin } from './db.ts';
import { AppError } from './errors.ts';

export interface AccessTokenClaims {
  sub: string;            // userId
  tid: string;            // tenantId (organization)
  role: string;           // 'owner' | 'admin' | 'member'
  sid: string;            // sessionId
  jti: string;            // unique token id
  email: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

const ISSUER = 'zellavora-auth';
const AUDIENCE = 'zellavora-app';

export function getAuthToken(req: Request): string | null {
  const auth = req.headers.get('authorization');
  if (!auth) return null;
  const parts = auth.split(' ');
  return parts.length === 2 && /^Bearer$/i.test(parts[0]) ? parts[1] : null;
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  const secret = Deno.env.get('JWT_SECRET') ?? 'dev-secret-change-in-production';
  let claims: any;
  try {
    claims = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
  } catch (e: any) {
    const msg = e?.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    throw new AppError(msg, 401, 'INVALID_TOKEN');
  }

  if (!claims.jti) throw new AppError('Missing jti', 401, 'INVALID_TOKEN');

  const adminClient = getSupabaseAdmin();
  const { data: revoked } = await adminClient
    .from('revoked_tokens')
    .select('jti')
    .eq('jti', claims.jti)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (revoked) throw new AppError('Token revoked', 401, 'TOKEN_REVOKED');

  return claims as AccessTokenClaims;
}

export async function authenticate(req: Request): Promise<AccessTokenClaims> {
  const token = getAuthToken(req);
  if (!token) throw new AppError('No token provided', 401, 'NO_TOKEN');
  return await verifyAccessToken(token);
}

export const requireRole = (claims: AccessTokenClaims, ...roles: string[]) => {
  if (!claims.role || !roles.includes(claims.role)) {
    throw new AppError('Insufficient role', 403, 'FORBIDDEN_ROLE');
  }
};

export class PermissionService {
  static async loadForUser(userId: string, orgId: string): Promise<Set<string>> {
    const adminClient = getSupabaseAdmin();
    const { data, error } = await adminClient
      .from('v_user_effective_permissions')
      .select('permission_code')
      .eq('user_id', userId)
      .eq('organization_id', orgId);

    if (error) throw new AppError('Failed to load permissions', 500, 'PERM_LOAD_FAILED');
    return new Set((data ?? []).map((r: { permission_code: string }) => r.permission_code));
  }

  static has(set: Set<string>, code: string): boolean {
    if (set.has(code)) return true;
    const action = code.split(':')[1];
    return !!action && set.has(`*:${action}`);
  }
}

export async function requirePermission(claims: AccessTokenClaims, ...codes: string[]) {
  const permissions = await PermissionService.loadForUser(claims.sub, claims.tid);
  const ok = codes.some((c) => PermissionService.has(permissions, c));
  if (!ok) throw new AppError('Insufficient permission', 403, 'FORBIDDEN_PERMISSION');
}
