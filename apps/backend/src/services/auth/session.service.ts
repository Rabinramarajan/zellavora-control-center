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
import { prisma } from '../../infrastructure/prisma';
import { AppError } from '../../middleware/error';
import { TokenService } from './token.service';

export interface CreateSessionInput {
  userId: string;
  organizationId: string;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint?: string;
  rememberMe?: boolean;
  /** Org cap on session age in days; never lengthens the built-in lifetimes. */
  maxLifetimeDays?: number;
  /** Org cap on live sessions per user (0 = unlimited); the oldest are revoked. */
  maxConcurrentSessions?: number;
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
    const lifetimeDays = Math.min(input.rememberMe ? 30 : 7, input.maxLifetimeDays ?? Infinity);
    const expiresAt = new Date(Date.now() + lifetimeDays * 24 * 60 * 60 * 1000);

    if (input.maxConcurrentSessions && input.maxConcurrentSessions > 0) {
      // Make room for the new session by revoking the least recently used ones.
      const live = await prisma.session.findMany({
        where: { userId: input.userId, isActive: true, expiresAt: { gt: new Date() } },
        orderBy: { lastActivityAt: 'desc' },
        select: { id: true },
      });
      const excess = live.slice(input.maxConcurrentSessions - 1).map((s) => s.id);
      if (excess.length) {
        await prisma.session.updateMany({
          where: { id: { in: excess } },
          data: { isActive: false },
        });
      }
    }

    await prisma.session.create({
      data: {
        id: sessionId,
        userId: input.userId,
        organizationId: input.organizationId,
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null,
        expiresAt,
        lastActivityAt: new Date(),
        isActive: true,
      },
    });

    return { sessionId };
  }

  /**
   * Look up by refresh-token hash. Used during refresh-token rotation.
   * Throws on token-reuse (theft detection): if the token is found but the
   * session is already inactive, treat it as reuse.
   */
  static async findByRefreshTokenHash(hash: string): Promise<SessionRow> {
    const session = await prisma.session.findFirst({ where: { refreshToken: hash } });
    if (!session) throw new AppError('Refresh token not recognised', 401, 'REFRESH_TOKEN_UNKNOWN');

    if (!session.isActive) {
      // Reuse of an inactive session's token = treat as theft. Burn the session.
      await prisma.session.update({
        where: { id: session.id },
        data: { isActive: false, lastActivityAt: new Date() },
      });
      throw new AppError('Refresh token reuse detected', 401, 'REFRESH_TOKEN_REUSE');
    }

    return {
      id: session.id,
      user_id: session.userId,
      organization_id: session.organizationId,
      session_token: '',
      refresh_token_hash: hash,
      refresh_token_family: null,
      ip_address: session.ipAddress ?? '',
      user_agent: session.userAgent ?? '',
      device_fingerprint: null,
      created_at: session.createdAt.toISOString(),
      last_activity_at: session.lastActivityAt.toISOString(),
      expires_at: session.expiresAt.toISOString(),
      revoked_at: null,
    };
  }

  /**
   * Update last_activity_at when the session is still live. Returns false for a
   * revoked, expired or foreign session — one query on every authenticated request.
   */
  static async touchIfActive(sessionId: string, userId: string, idleMinutes = 0): Promise<boolean> {
    const now = new Date();
    const idleCutoff = idleMinutes > 0 ? new Date(now.getTime() - idleMinutes * 60 * 1000) : null;
    const { count } = await prisma.session.updateMany({
      where: {
        id: sessionId,
        userId,
        isActive: true,
        expiresAt: { gt: now },
        ...(idleCutoff ? { lastActivityAt: { gte: idleCutoff } } : {}),
      },
      data: { lastActivityAt: now },
    });
    if (count === 1) return true;
    if (idleCutoff) {
      // Deactivate an idled-out session so its refresh token can't revive it.
      await prisma.session.updateMany({
        where: { id: sessionId, userId, isActive: true, lastActivityAt: { lt: idleCutoff } },
        data: { isActive: false },
      });
    }
    return false;
  }

  /** Revoke a session owned by `userId`. Returns false when no such live session exists. */
  static async revokeOwned(sessionId: string, userId: string): Promise<boolean> {
    const { count } = await prisma.session.updateMany({
      where: { id: sessionId, userId, isActive: true },
      data: { isActive: false, lastActivityAt: new Date() },
    });
    return count === 1;
  }

  /** Revoke every live session for a user except `keepSessionId`. */
  static async revokeAllExcept(userId: string, keepSessionId: string): Promise<number> {
    const { count } = await prisma.session.updateMany({
      where: { userId, isActive: true, id: { not: keepSessionId } },
      data: { isActive: false, lastActivityAt: new Date() },
    });
    return count;
  }

  /** Revoke a single session. */
  static async revoke(sessionId: string): Promise<void> {
    await TokenService.revokeSession(sessionId);
  }

  /** List all active sessions for a user (used in the "Active sessions" UI). */
  static async listForUser(userId: string): Promise<SessionRow[]> {
    const rows = await prisma.session.findMany({
      where: { userId, isActive: true, expiresAt: { gt: new Date() } },
      orderBy: { lastActivityAt: 'desc' },
    });
    return rows.map((s) => ({
      id: s.id,
      user_id: s.userId,
      organization_id: s.organizationId,
      session_token: '',
      refresh_token_hash: s.refreshToken,
      refresh_token_family: null,
      ip_address: s.ipAddress ?? '',
      user_agent: s.userAgent ?? '',
      device_fingerprint: null,
      created_at: s.createdAt.toISOString(),
      last_activity_at: s.lastActivityAt.toISOString(),
      expires_at: s.expiresAt.toISOString(),
      revoked_at: null,
    }));
  }
}
