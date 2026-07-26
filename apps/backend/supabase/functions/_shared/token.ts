import jwt from 'npm:jsonwebtoken@9.0.2';
import crypto from 'node:crypto';
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

export interface RefreshTokenClaims {
  sub: string;            // userId
  sid: string;            // sessionId
  fam: string;            // family id
  jti: string;
  type: 'refresh';
  iat: number;
  exp: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  sessionId: string;
  family: string;
}

const ISSUER = 'zellavora-auth';
const AUDIENCE = 'zellavora-app';

export class TokenService {
  static async issue(opts: {
    userId: string;
    tenantId: string;
    role: string;
    email: string;
    sessionId: string;
    family?: string;
    rememberMe?: boolean;
  }): Promise<TokenPair> {
    const family = opts.family ?? crypto.randomUUID();
    const jti = crypto.randomUUID();
    const accessJti = crypto.randomUUID();

    const jwtSecret = Deno.env.get('JWT_SECRET') ?? 'dev-secret-change-in-production';
    const jwtExpiry = Deno.env.get('JWT_EXPIRY') ?? '15m';
    const refreshTokenSecret = Deno.env.get('REFRESH_TOKEN_SECRET') ?? 'dev-refresh-secret';
    const refreshTokenExpiry = Deno.env.get('REFRESH_TOKEN_EXPIRY') ?? '7d';

    const accessToken = jwt.sign(
      {
        sub: opts.userId,
        tid: opts.tenantId,
        role: opts.role,
        sid: opts.sessionId,
        email: opts.email,
        iss: ISSUER,
        aud: AUDIENCE,
      },
      jwtSecret,
      {
        expiresIn: jwtExpiry as any,
        jwtid: accessJti,
        algorithm: 'HS256',
      }
    );

    const refreshExpiry = opts.rememberMe ? '30d' : refreshTokenExpiry;
    const refreshToken = jwt.sign(
      {
        sub: opts.userId,
        sid: opts.sessionId,
        fam: family,
        type: 'refresh',
      },
      refreshTokenSecret,
      {
        expiresIn: refreshExpiry as any,
        jwtid: jti,
        algorithm: 'HS256',
      }
    );

    const accessTokenExpiresAt = (jwt.decode(accessToken) as any).exp!;
    const refreshTokenExpiresAt = (jwt.decode(refreshToken) as any).exp!;

    const admin = getSupabaseAdmin();
    await admin
      .from('sessions')
      .update({
        refresh_token_hash: this.hashRefresh(refreshToken),
        refresh_token_family: family,
        rotated_at: new Date().toISOString(),
      })
      .eq('id', opts.sessionId);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: new Date(accessTokenExpiresAt * 1000),
      refreshTokenExpiresAt: new Date(refreshTokenExpiresAt * 1000),
      sessionId: opts.sessionId,
      family,
    };
  }

  static verifyRefresh(token: string): RefreshTokenClaims {
    const refreshTokenSecret = Deno.env.get('REFRESH_TOKEN_SECRET') ?? 'dev-refresh-secret';
    try {
      const claims = jwt.verify(token, refreshTokenSecret, {
        algorithms: ['HS256'],
      }) as any;
      if (claims.type !== 'refresh') throw new Error('wrong type');
      return claims as RefreshTokenClaims;
    } catch (e: any) {
      const msg = e?.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
      throw new AppError(msg, 401, 'INVALID_REFRESH_TOKEN');
    }
  }

  static hashRefresh(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  static async revokeSession(sessionId: string): Promise<void> {
    const admin = getSupabaseAdmin();
    await admin
      .from('sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', sessionId);
  }

  static async revokeAllForUser(userId: string): Promise<void> {
    const admin = getSupabaseAdmin();
    await admin
      .from('sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('revoked_at', null);
  }
}
