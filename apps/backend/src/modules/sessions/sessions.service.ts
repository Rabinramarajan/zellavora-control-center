import { AppError } from '../../middleware/error';
import { AuditService } from '../../infrastructure/audit';
import { SessionsRepository } from './sessions.repository';
import { SessionListQuery } from './sessions.dto';

const BROWSERS: Array<[RegExp, string]> = [
  [/Edg\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Chrome\//, 'Chrome'],
  [/Firefox\//, 'Firefox'],
  [/Safari\//, 'Safari'],
];
const PLATFORMS: Array<[RegExp, string]> = [
  [/Windows/, 'Windows'],
  [/iPhone|iPad/, 'iOS'],
  [/Android/, 'Android'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Linux/, 'Linux'],
];

const match = (ua: string, table: Array<[RegExp, string]>): string | null =>
  table.find(([re]) => re.test(ua))?.[1] ?? null;

export const describeUserAgent = (ua: string | null) => ({
  browser: ua ? match(ua, BROWSERS) : null,
  platform: ua ? match(ua, PLATFORMS) : null,
  isMobile: ua ? /Mobile|Android|iPhone|iPad/.test(ua) : false,
});

/** Organization-wide view and control of live sign-in sessions. */
export class SessionsService {
  constructor(private readonly repo = new SessionsRepository()) {}

  async list(organizationId: string, query: SessionListQuery, currentSessionId?: string) {
    const userIds = query.q
      ? (await this.repo.findUserIds(organizationId, query.q)).map((u) => u.id)
      : undefined;
    const { data, total } = await this.repo.list(organizationId, query, userIds);
    const users = await this.repo.findUsers([...new Set(data.map((s) => s.userId))]);
    const byId = new Map(users.map((u) => [u.id, u]));

    return {
      data: data.map((s) => {
        const user = byId.get(s.userId);
        return {
          id: s.id,
          userId: s.userId,
          userName: user?.fullName ?? 'Unknown user',
          userEmail: user?.email ?? null,
          userAvatarUrl: user?.avatarUrl ?? null,
          ipAddress: s.ipAddress,
          userAgent: s.userAgent,
          ...describeUserAgent(s.userAgent),
          createdAt: s.createdAt.toISOString(),
          lastActivityAt: s.lastActivityAt.toISOString(),
          expiresAt: s.expiresAt.toISOString(),
          isCurrent: s.id === currentSessionId,
        };
      }),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  stats(organizationId: string) {
    return this.repo.stats(organizationId);
  }

  async revoke(organizationId: string, id: string, actorId: string, currentSessionId?: string) {
    if (id === currentSessionId) {
      throw new AppError('Use sign out to end your current session.', 400, 'CURRENT_SESSION');
    }
    const session = await this.repo.findLive(id, organizationId);
    if (!session) throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
    await this.repo.revoke(id);
    await AuditService.log({
      organizationId,
      actorId,
      action: 'session.revoked',
      resource: 'session',
      resourceId: id,
      severity: 'warning',
      metadata: { userId: session.userId, ipAddress: session.ipAddress },
    });
    return { success: true };
  }

  async revokeAllForUser(
    organizationId: string,
    userId: string,
    actorId: string,
    currentSessionId?: string
  ) {
    const { count } = await this.repo.revokeAllForUser(
      organizationId,
      userId,
      userId === actorId ? currentSessionId : undefined
    );
    await AuditService.log({
      organizationId,
      actorId,
      action: 'session.revoked_all',
      resource: 'user',
      resourceId: userId,
      severity: 'warning',
      metadata: { revoked: count },
    });
    return { revoked: count };
  }
}
