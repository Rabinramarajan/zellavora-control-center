import { prisma } from '../../infrastructure/prisma';
import type { TxClient } from '../../infrastructure/prisma';
import type { DashboardScope } from './dashboard.scope';

export interface DashboardTrendPoint {
  date: string;
  count: number;
}

export interface DashboardActivityRow {
  id: string;
  actorId: string | null;
  action: string;
  resource: string | null;
  severity: string;
  createdAt: Date;
  actor?: { email: string | null } | null;
}

export interface ActivityFilters {
  action?: string;
  severity?: string;
}

export interface DistributionSlice {
  plan: string;
  count: number;
}

const ACTIVITY_SELECT = {
  id: true,
  actorId: true,
  action: true,
  resource: true,
  severity: true,
  createdAt: true,
  actor: { select: { email: true } },
} as const;

export interface DashboardRepository {
  countOrganizations(scope: DashboardScope, tx?: TxClient): Promise<number>;
  countMembers(scope: DashboardScope, tx?: TxClient): Promise<number>;
  countActiveSessions(scope: DashboardScope, tx?: TxClient): Promise<number>;
  countPendingInvitations(scope: DashboardScope, tx?: TxClient): Promise<number>;
  countProjects(scope: DashboardScope, tx?: TxClient): Promise<number>;
  countDailySheets(scope: DashboardScope, tx?: TxClient): Promise<number>;
  countMediaFiles(scope: DashboardScope, tx?: TxClient): Promise<number>;
  countPortfolioProjects(scope: DashboardScope, tx?: TxClient): Promise<number>;
  countAuditEventsSince(scope: DashboardScope, since: Date, tx?: TxClient): Promise<number>;
  countCriticalAlertsSince(scope: DashboardScope, since: Date, tx?: TxClient): Promise<number>;
  orgSignupsSince(scope: DashboardScope, since: Date, tx?: TxClient): Promise<DashboardTrendPoint[]>;
  memberSignupsSince(
    scope: DashboardScope,
    since: Date,
    tx?: TxClient
  ): Promise<DashboardTrendPoint[]>;
  projectsCreatedSince(
    scope: DashboardScope,
    since: Date,
    tx?: TxClient
  ): Promise<DashboardTrendPoint[]>;
  sheetsLoggedSince(
    scope: DashboardScope,
    since: Date,
    tx?: TxClient
  ): Promise<DashboardTrendPoint[]>;
  auditTrendSince(scope: DashboardScope, since: Date, tx?: TxClient): Promise<DashboardTrendPoint[]>;
  recentAuditEvents(
    scope: DashboardScope,
    limit: number,
    tx?: TxClient
  ): Promise<DashboardActivityRow[]>;
  recentAuditEventsPaginated(
    scope: DashboardScope,
    since: Date,
    filters: ActivityFilters,
    page: number,
    pageSize: number,
    tx?: TxClient
  ): Promise<DashboardActivityRow[]>;
  countAuditEvents(
    scope: DashboardScope,
    since: Date,
    filters: ActivityFilters,
    tx?: TxClient
  ): Promise<number>;
  planDistribution(scope: DashboardScope, tx?: TxClient): Promise<DistributionSlice[]>;
  contentDistribution(scope: DashboardScope, tx?: TxClient): Promise<DistributionSlice[]>;
}

export class PrismaDashboardRepository implements DashboardRepository {
  /**
   * Audit rows belonging to the scope. Individual accounts all share the default
   * organization, so an organization filter alone would still expose their peers;
   * their feed is narrowed to events they themselves produced.
   */
  private auditWhere(scope: DashboardScope): Record<string, unknown> {
    return scope.kind === 'individual'
      ? { actorId: scope.userId }
      : { organizationId: scope.organizationId };
  }

  /** Ownership predicate for content tables, empty for organization scope. */
  private ownedBy(scope: DashboardScope, column: 'createdBy' | 'userId'): Record<string, string> {
    return scope.kind === 'individual' ? { [column]: scope.userId } : {};
  }

  async countOrganizations(scope: DashboardScope, tx?: TxClient): Promise<number> {
    const db = tx ?? prisma;
    return db.organization.count({ where: { id: scope.organizationId, isDeleted: false } });
  }

  async countMembers(scope: DashboardScope, tx?: TxClient): Promise<number> {
    const db = tx ?? prisma;
    return db.user.count({ where: { tenantId: scope.organizationId, isDeleted: false } });
  }

  async countActiveSessions(scope: DashboardScope, tx?: TxClient): Promise<number> {
    const db = tx ?? prisma;
    return db.session.count({
      where:
        scope.kind === 'individual'
          ? { userId: scope.userId, isActive: true }
          : { organizationId: scope.organizationId, isActive: true },
    });
  }

  async countPendingInvitations(scope: DashboardScope, tx?: TxClient): Promise<number> {
    const db = tx ?? prisma;
    return db.invitation.count({
      where: {
        organizationId: scope.organizationId,
        status: 'pending',
        isDeleted: false,
        expiresAt: { gt: new Date() },
      },
    });
  }

  async countProjects(scope: DashboardScope, tx?: TxClient): Promise<number> {
    const db = tx ?? prisma;
    return db.project.count({
      where: {
        organizationId: scope.organizationId,
        deletedAt: null,
        ...this.ownedBy(scope, 'createdBy'),
      },
    });
  }

  async countDailySheets(scope: DashboardScope, tx?: TxClient): Promise<number> {
    const db = tx ?? prisma;
    return db.dailySheet.count({
      where: {
        organizationId: scope.organizationId,
        deletedAt: null,
        ...this.ownedBy(scope, 'userId'),
      },
    });
  }

  async countMediaFiles(scope: DashboardScope, tx?: TxClient): Promise<number> {
    const db = tx ?? prisma;
    return db.mediaFile.count({
      where: {
        organizationId: scope.organizationId,
        ...this.ownedBy(scope, 'createdBy'),
      },
    });
  }

  async countPortfolioProjects(scope: DashboardScope, tx?: TxClient): Promise<number> {
    const db = tx ?? prisma;
    return db.portfolioProject.count({
      where: {
        organizationId: scope.organizationId,
        deletedAt: null,
        ...this.ownedBy(scope, 'createdBy'),
      },
    });
  }

  async countAuditEventsSince(scope: DashboardScope, since: Date, tx?: TxClient): Promise<number> {
    const db = tx ?? prisma;
    return db.auditLog.count({
      where: { ...this.auditWhere(scope), createdAt: { gte: since } },
    });
  }

  async countCriticalAlertsSince(
    scope: DashboardScope,
    since: Date,
    tx?: TxClient
  ): Promise<number> {
    const db = tx ?? prisma;
    return db.auditLog.count({
      where: {
        ...this.auditWhere(scope),
        severity: { in: ['error', 'critical'] },
        createdAt: { gte: since },
      },
    });
  }

  async orgSignupsSince(
    scope: DashboardScope,
    since: Date,
    tx?: TxClient
  ): Promise<DashboardTrendPoint[]> {
    const db = tx ?? prisma;
    const rows = await db.organization.groupBy({
      by: ['createdAt'],
      _count: { _all: true },
      where: { id: scope.organizationId, createdAt: { gte: since }, isDeleted: false },
    });
    return this.toDailyBuckets(
      rows.map((r) => ({ date: r.createdAt, count: r._count._all })),
      since
    );
  }

  async memberSignupsSince(
    scope: DashboardScope,
    since: Date,
    tx?: TxClient
  ): Promise<DashboardTrendPoint[]> {
    const db = tx ?? prisma;
    const rows = await db.user.groupBy({
      by: ['createdAt'],
      _count: { _all: true },
      where: { tenantId: scope.organizationId, createdAt: { gte: since }, isDeleted: false },
    });
    return this.toDailyBuckets(
      rows.map((r) => ({ date: r.createdAt, count: r._count._all })),
      since
    );
  }

  async projectsCreatedSince(
    scope: DashboardScope,
    since: Date,
    tx?: TxClient
  ): Promise<DashboardTrendPoint[]> {
    const db = tx ?? prisma;
    const rows = await db.project.groupBy({
      by: ['createdAt'],
      _count: { _all: true },
      where: {
        organizationId: scope.organizationId,
        createdAt: { gte: since },
        deletedAt: null,
        ...this.ownedBy(scope, 'createdBy'),
      },
    });
    return this.toDailyBuckets(
      rows.map((r) => ({ date: r.createdAt, count: r._count._all })),
      since
    );
  }

  async sheetsLoggedSince(
    scope: DashboardScope,
    since: Date,
    tx?: TxClient
  ): Promise<DashboardTrendPoint[]> {
    const db = tx ?? prisma;
    const rows = await db.dailySheet.groupBy({
      by: ['createdAt'],
      _count: { _all: true },
      where: {
        organizationId: scope.organizationId,
        createdAt: { gte: since },
        deletedAt: null,
        ...this.ownedBy(scope, 'userId'),
      },
    });
    return this.toDailyBuckets(
      rows.map((r) => ({ date: r.createdAt, count: r._count._all })),
      since
    );
  }

  async auditTrendSince(
    scope: DashboardScope,
    since: Date,
    tx?: TxClient
  ): Promise<DashboardTrendPoint[]> {
    const db = tx ?? prisma;
    const rows = await db.auditLog.groupBy({
      by: ['createdAt'],
      _count: { _all: true },
      where: { ...this.auditWhere(scope), createdAt: { gte: since } },
    });
    return this.toDailyBuckets(
      rows.map((r) => ({ date: r.createdAt, count: r._count._all })),
      since
    );
  }

  async recentAuditEvents(
    scope: DashboardScope,
    limit: number,
    tx?: TxClient
  ): Promise<DashboardActivityRow[]> {
    const db = tx ?? prisma;
    return db.auditLog.findMany({
      where: this.auditWhere(scope),
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: ACTIVITY_SELECT,
    });
  }

  async planDistribution(scope: DashboardScope, tx?: TxClient): Promise<DistributionSlice[]> {
    const db = tx ?? prisma;
    const rows = await db.organization.groupBy({
      by: ['plan'],
      _count: { _all: true },
      where: { id: scope.organizationId, isDeleted: false },
    });
    return rows.map((r) => ({ plan: r.plan, count: r._count._all }));
  }

  /** Breakdown of the caller's own content, shown in place of the plan mix. */
  async contentDistribution(scope: DashboardScope, tx?: TxClient): Promise<DistributionSlice[]> {
    const [projects, sheets, media, portfolio] = await Promise.all([
      this.countProjects(scope, tx),
      this.countDailySheets(scope, tx),
      this.countMediaFiles(scope, tx),
      this.countPortfolioProjects(scope, tx),
    ]);
    return [
      { plan: 'Projects', count: projects },
      { plan: 'Sheets', count: sheets },
      { plan: 'Media', count: media },
      { plan: 'Portfolio', count: portfolio },
    ].filter((slice) => slice.count > 0);
  }

  async recentAuditEventsPaginated(
    scope: DashboardScope,
    since: Date,
    filters: ActivityFilters,
    page: number,
    pageSize: number,
    tx?: TxClient
  ): Promise<DashboardActivityRow[]> {
    const db = tx ?? prisma;
    return db.auditLog.findMany({
      where: this.activityWhere(scope, since, filters),
      take: pageSize,
      skip: (page - 1) * pageSize,
      orderBy: { createdAt: 'desc' },
      select: ACTIVITY_SELECT,
    });
  }

  async countAuditEvents(
    scope: DashboardScope,
    since: Date,
    filters: ActivityFilters,
    tx?: TxClient
  ): Promise<number> {
    const db = tx ?? prisma;
    return db.auditLog.count({ where: this.activityWhere(scope, since, filters) });
  }

  /** Scope is spread last so a caller-supplied filter can never widen it. */
  private activityWhere(
    scope: DashboardScope,
    since: Date,
    filters: ActivityFilters
  ): Record<string, unknown> {
    return {
      createdAt: { gte: since },
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.severity ? { severity: filters.severity } : {}),
      ...this.auditWhere(scope),
    };
  }

  /** Collapse raw timestamps into zero-filled daily buckets over the window. */
  private toDailyBuckets(
    points: Array<{ date: Date; count: number }>,
    since: Date
  ): DashboardTrendPoint[] {
    const buckets = new Map<string, number>();
    const days: string[] = [];

    const cursor = new Date(since);
    cursor.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    while (cursor <= today) {
      const key = cursor.toISOString().slice(0, 10);
      buckets.set(key, 0);
      days.push(key);
      cursor.setDate(cursor.getDate() + 1);
    }

    for (const p of points) {
      const key = p.date.toISOString().slice(0, 10);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + p.count);
    }

    return days.map((date) => ({ date, count: buckets.get(date) ?? 0 }));
  }
}
