/**
 * TokenService — JWT issuance, verification, and revocation.
 *
 * Token model:
 *   - Access token:  HS256, 15 min, carries userId/tenantId/role/sessionId/jti
 *   - Refresh token: HS256, 7 days (or 30 if rememberMe), jti + sessionId
 *
 * Refresh tokens are NOT stored as JWT-only — we keep a SHA-256 hash of every
 * issued refresh token in `sessions.refresh_token_hash`. On rotation:
 *   1. Look up the presented token's hash
 *   2. If not found or already rotated: revoke the whole family (theft detection)
 *   3. Otherwise: mark used, issue new pair with same family
 *
 * Server-side denylist (`revoked_tokens`) only holds ACCESS tokens, because
 * refresh tokens are validated by the sessions table directly.
 */
import crypto from 'crypto';
import jwt, { type JwtPayload, type Secret, type SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '@/config/env';
import { supabaseAdmin } from '@/config/supabase';
import { AppError } from '@/middleware/error';

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
  /** Issue a fresh access+refresh pair bound to a (user, tenant, session) triple. */
  static async issue(opts: {
    userId: string;
    tenantId: string;
    role: string;
    email: string;
    sessionId: string;
    family?: string;
    rememberMe?: boolean;
  }): Promise<TokenPair> {
    const family = opts.family ?? uuidv4();
    const jti = uuidv4();
    const accessJti = uuidv4();

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
      config.jwtSecret as Secret,
      {
        expiresIn: config.jwtExpiry as SignOptions['expiresIn'],
        jwtid: accessJti,
        algorithm: 'HS256',
      }
    );

    const refreshExpiry = opts.rememberMe ? '30d' : (config.refreshTokenExpiry as SignOptions['expiresIn']);
    const refreshToken = jwt.sign(
      {
        sub: opts.userId,
        sid: opts.sessionId,
        fam: family,
        type: 'refresh',
      },
      config.refreshTokenSecret as Secret,
      {
        expiresIn: refreshExpiry,
        jwtid: jti,
        algorithm: 'HS256',
      }
    );

    const accessTokenExpiresAt = this.decode(accessToken).exp!;
    const refreshTokenExpiresAt = this.decodeRefresh(refreshToken).exp!;

    // Persist the refresh-token hash so rotation/reuse-detection works.
    await supabaseAdmin
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

  /** Verify access token; throws on bad signature/exp/revocation. */
  static async verifyAccess(token: string): Promise<AccessTokenClaims> {
    let claims: JwtPayload;
    try {
      claims = jwt.verify(token, config.jwtSecret as Secret, {
        algorithms: ['HS256'],
        issuer: ISSUER,
        audience: AUDIENCE,
      }) as JwtPayload;
    } catch (e: any) {
      throw new AppError(this.mapJwtError(e), 401, 'INVALID_TOKEN');
    }

    if (!claims.jti) throw new AppError('Missing jti', 401, 'INVALID_TOKEN');

    // Server-side denylist check (in case of emergency revoke)
    const { data: revoked } = await supabaseAdmin
      .from('revoked_tokens')
      .select('jti')
      .eq('jti', claims.jti)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (revoked) throw new AppError('Token revoked', 401, 'TOKEN_REVOKED');

    return claims as unknown as AccessTokenClaims;
  }

  /** Verify refresh token; returns decoded claims. */
  static verifyRefresh(token: string): RefreshTokenClaims {
    try {
      const claims = jwt.verify(token, config.refreshTokenSecret as Secret, {
        algorithms: ['HS256'],
      }) as JwtPayload;
      if (claims.type !== 'refresh') throw new Error('wrong type');
      return claims as unknown as RefreshTokenClaims;
    } catch (e: any) {
      throw new AppError(this.mapJwtError(e), 401, 'INVALID_REFRESH_TOKEN');
    }
  }

  /** SHA-256 hash of a refresh token. Stored in sessions.refresh_token_hash. */
  static hashRefresh(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /** Revoke an access token by jti (until it would have expired anyway). */
  static async revokeAccess(jti: string, userId: string, reason: string, expiresAt: Date): Promise<void> {
    await supabaseAdmin.from('revoked_tokens').upsert({
      jti,
      user_id: userId,
      reason,
      expires_at: expiresAt.toISOString(),
    });
  }

  /** Revoke an entire session row (logout / kill switch). */
  static async revokeSession(sessionId: string): Promise<void> {
    await supabaseAdmin
      .from('sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', sessionId);
  }

  /** Revoke EVERY session for a user (logout-everywhere / "I think I'm compromised"). */
  static async revokeAllForUser(userId: string): Promise<void> {
    await supabaseAdmin
      .from('sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('revoked_at', null);
  }

  private static decode(token: string): JwtPayload {
    return jwt.decode(token) as JwtPayload;
  }

  private static decodeRefresh(token: string): JwtPayload {
    return jwt.decode(token) as JwtPayload;
  }

  private static mapJwtError(e: any): string {
    if (e?.name === 'TokenExpiredError') return 'Token expired';
    if (e?.name === 'JsonWebTokenError') return 'Invalid token';
    if (e?.name === 'NotBeforeError') return 'Token not yet valid';
    return 'Token verification failed';
  }
}
