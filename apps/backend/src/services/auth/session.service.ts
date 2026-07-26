/**
 * SessionService — server-side session lifecycle.
 *
 * A "session" is a row in the `sessions` table. It tracks:
 *   - which user is logged in
 *   - in which tenant (organization)
 *   - from which device (ip, user agent, fingerprint)
 *   - last activity timestamp (for sliding-window idle timeout)
 *   - absolute expiry (cap on session age)
 *   - revoked_at (for explicit logout)
 *   - refresh_token_hash + family (for rotation + reuse detection)
 */
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../../config/supabase';
import { AppError } from '../../middleware/error';
import { TokenService } from './token.service';

export interface CreateSessionInput {
  userId: string;
  organizationId: string;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint?: string;
  rememberMe?: boolean;
}

export interface SessionRow {
  id: string;
  user_id: string;
  organization_id: string;
  session_token: string;
  refresh_token_hash: string | null;
  refresh_token_family: string | null;
  ip_address: string;
  user_agent: string;
  device_fingerprint: string | null;
  created_at: string;
  last_activity_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export class SessionService {
  /** Create a new session and return its id. */
  static async create(input: CreateSessionInput): Promise<{ sessionId: string }> {
    const sessionId = uuidv4();
    const sessionToken = `sess_${crypto.randomUUID().replace(/-/g, '')}`;
    const expiresAt = new Date(
      Date.now() + (input.rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000
    );

    const { error } = await supabaseAdmin.from('sessions').insert({
      id: sessionId,
      user_id: input.userId,
      organization_id: input.organizationId,
      session_token: sessionToken,
      ip_address: input.ipAddress,
      user_agent: input.userAgent,
      device_fingerprint: input.deviceFingerprint ?? null,
      expires_at: expiresAt.toISOString(),
    });

    if (error) {
      throw new AppError('Failed to create session', 500, 'SESSION_CREATE_FAILED');
    }
    return { sessionId };
  }

  /** Look up a session by id; verifies it is active and not expired. */
  static async getActive(sessionId: string): Promise<SessionRow> {
    const { data, error } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error || !data) {
      throw new AppError('Session not found or expired', 401, 'SESSION_INVALID');
    }
    return data as SessionRow;
  }

  /**
   * Look up by refresh-token hash. Used during refresh-token rotation.
   * Throws on token-reuse (theft detection): if the token is found but the
   * session is already revoked, OR if the session's current hash doesn't
   * match, we kill the whole family.
   */
  static async findByRefreshTokenHash(hash: string): Promise<SessionRow> {
    const { data, error } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('refresh_token_hash', hash)
      .maybeSingle();

    if (error) throw new AppError('Session lookup failed', 500, 'SESSION_LOOKUP_FAILED');
    if (!data) throw new AppError('Refresh token not recognised', 401, 'REFRESH_TOKEN_UNKNOWN');

    if (data.revoked_at) {
      // Reuse of a revoked token = treat as theft. Burn the family.
      await supabaseAdmin
        .from('sessions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('refresh_token_family', data.refresh_token_family)
        .is('revoked_at', null);
      throw new AppError('Refresh token reuse detected', 401, 'REFRESH_TOKEN_REUSE');
    }

    return data as SessionRow;
  }

  /** Update last_activity_at; called on each authenticated request. */
  static async touch(sessionId: string): Promise<void> {
    await supabaseAdmin
      .from('sessions')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', sessionId);
  }

  /** Revoke a single session. */
  static async revoke(sessionId: string): Promise<void> {
    await TokenService.revokeSession(sessionId);
  }

  /** List all active sessions for a user (used in the "Active sessions" UI). */
  static async listForUser(userId: string): Promise<SessionRow[]> {
    const { data, error } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('last_activity_at', { ascending: false });

    if (error) throw new AppError('Failed to list sessions', 500, 'SESSION_LIST_FAILED');
    return (data ?? []) as SessionRow[];
  }
}
