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

/**
 * Whose sessions a viewer may see and revoke. The organization owner (super admin) sees
 * everyone; anyone else granted `sessions:view` sees themselves, everyone below them in the
 * reporting-manager chain, and the members of teams they belong to (team leads).
 */
export type SessionScope = { kind: 'all' } | { kind: 'users'; userIds: ReadonlySet<string> };

/** For callers that are already authorized organization-wide, e.g. user administration. */
export const ORG_WIDE_SESSION_SCOPE: SessionScope = { kind: 'all' };

/** Guards against reporting-manager cycles in bad data. */
const MAX_REPORTING_DEPTH = 20;

const inScope = (scope: SessionScope, userId: string) =>
  scope.kind === 'all' || scope.userIds.has(userId);

/** View and control of live sign-in sessions, limited to the viewer's scope. */
export class SessionsService {
  constructor(private readonly repo = new SessionsRepository()) {}

  async resolveScope(
    organizationId: string,
    actorId: string,
    isOwner: boolean
  ): Promise<SessionScope> {
    if (isOwner) return { kind: 'all' };
    const people = new Set<string>([actorId]);
    let frontier = [actorId];
    for (let depth = 0; depth < MAX_REPORTING_DEPTH && frontier.length; depth++) {
      const reports = await this.repo.directReports(organizationId, frontier);
      frontier = reports.map((u) => u.id).filter((id) => !people.has(id));
      frontier.forEach((id) => people.add(id));
    }
    for (const { id } of await this.repo.teammates(organizationId, actorId)) people.add(id);
    return { kind: 'users', userIds: people };
  }

  async list(
    organizationId: string,
    query: SessionListQuery,
    scope: SessionScope,
    currentSessionId?: string
  ) {
    let userIds = query.q
      ? (await this.repo.findUserIds(organizationId, query.q)).map((u) => u.id)
      : undefined;
    if (scope.kind === 'users') {
      userIds = (userIds ?? [...scope.userIds]).filter((id) => scope.userIds.has(id));
    }
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

  stats(organizationId: string, scope: SessionScope) {
    return this.repo.stats(organizationId, scope.kind === 'all' ? undefined : [...scope.userIds]);
  }

  async revoke(
    organizationId: string,
    id: string,
    actorId: string,
    scope: SessionScope,
    currentSessionId?: string
  ) {
    if (id === currentSessionId) {
      throw new AppError('Use sign out to end your current session.', 400, 'CURRENT_SESSION');
    }
    const session = await this.repo.findLive(id, organizationId);
    // Out-of-scope sessions look missing so their existence is not disclosed.
    if (!session || !inScope(scope, session.userId)) {
      throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
    }
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
    scope: SessionScope,
    currentSessionId?: string
  ) {
    if (!inScope(scope, userId)) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
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
