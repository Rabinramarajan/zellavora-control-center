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
 * Whose sessions a viewer may see and revoke:
 * - `platform`: the platform super admin (users.is_platform_admin) sees every organization.
 * - `all`: the organization owner sees everyone in their organization.
 * - `users`: anyone else granted `sessions:view` sees themselves, everyone below them in the
 *   reporting-manager chain, and the members of teams they belong to (team leads).
 */
export type SessionScope =
  { kind: 'platform' } | { kind: 'all' } | { kind: 'users'; userIds: ReadonlySet<string> };

/** For callers that are already authorized organization-wide, e.g. user administration. */
export const ORG_WIDE_SESSION_SCOPE: SessionScope = { kind: 'all' };

/** Guards against reporting-manager cycles in bad data. */
const MAX_REPORTING_DEPTH = 20;

/** Live, ended by sign-out / revocation, or past its expiry. */
export const sessionState = (s: { isActive: boolean; expiresAt: Date }, now = new Date()) =>
  !s.isActive
    ? ('signed_out' as const)
    : s.expiresAt <= now
      ? ('expired' as const)
      : ('active' as const);

const inScope = (scope: SessionScope, userId: string) =>
  scope.kind !== 'users' || scope.userIds.has(userId);

/** Organization filter for queries: none for the platform super admin. */
const orgFilter = (scope: SessionScope, organizationId: string): string | null =>
  scope.kind === 'platform' ? null : organizationId;

/** View and control of live sign-in sessions, limited to the viewer's scope. */
export class SessionsService {
  constructor(private readonly repo = new SessionsRepository()) {}

  async resolveScope(
    organizationId: string,
    actorId: string,
    isOwner: boolean
  ): Promise<SessionScope> {
    if (await this.repo.isPlatformAdmin(actorId)) return { kind: 'platform' };
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
      ? (await this.repo.findUserIds(orgFilter(scope, organizationId), query.q)).map((u) => u.id)
      : undefined;
    if (scope.kind === 'users') {
      userIds = (userIds ?? [...scope.userIds]).filter((id) => scope.userIds.has(id));
    }
    const { data, total } = await this.repo.list(orgFilter(scope, organizationId), query, userIds);
    const [users, orgs] = await Promise.all([
      this.repo.findUsers([...new Set(data.map((s) => s.userId))]),
      this.repo.findOrganizations([...new Set(data.map((s) => s.organizationId))]),
    ]);
    const byId = new Map(users.map((u) => [u.id, u]));
    const orgName = new Map(orgs.map((o) => [o.id, o.name]));

    return {
      data: data.map((s) => {
        const user = byId.get(s.userId);
        return {
          id: s.id,
          userId: s.userId,
          userName: user?.fullName ?? 'Unknown user',
          userEmail: user?.email ?? null,
          userAvatarUrl: user?.avatarUrl ?? null,
          organizationId: s.organizationId,
          organizationName: orgName.get(s.organizationId) ?? null,
          ipAddress: s.ipAddress,
          userAgent: s.userAgent,
          ...describeUserAgent(s.userAgent),
          createdAt: s.createdAt.toISOString(),
          lastActivityAt: s.lastActivityAt.toISOString(),
          expiresAt: s.expiresAt.toISOString(),
          status: sessionState(s),
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
    return this.repo.stats(
      orgFilter(scope, organizationId),
      scope.kind === 'users' ? [...scope.userIds] : undefined
    );
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
    const session = await this.repo.findLive(id, orgFilter(scope, organizationId));
    // Out-of-scope sessions look missing so their existence is not disclosed.
    if (!session || !inScope(scope, session.userId)) {
      throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
    }
    await this.repo.revoke(id);
    await AuditService.log({
      // Logged in the session's own organization so its audit trail shows the revocation.
      organizationId: session.organizationId,
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
      orgFilter(scope, organizationId),
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
