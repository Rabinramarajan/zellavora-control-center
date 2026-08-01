import { prisma } from '../../infrastructure/prisma';
import type { TxClient } from '../../infrastructure/prisma';

export interface DashboardTrendPoint {
  date: string;
  count: number;
}

export interface DashboardRepository {
  countOrganizations(tx?: TxClient): Promise<number>;
  countMembers(tx?: TxClient): Promise<number>;
  countActiveSessions(tx?: TxClient): Promise<number>;
  countPendingInvitations(tx?: TxClient): Promise<number>;
  countAuditEventsSince(since: Date, tx?: TxClient): Promise<number>;
  countCriticalAlertsSince(since: Date, tx?: TxClient): Promise<number>;
  orgSignupsSince(since: Date, tx?: TxClient): Promise<DashboardTrendPoint[]>;
  memberSignupsSince(since: Date, tx?: TxClient): Promise<DashboardTrendPoint[]>;
  auditTrendSince(since: Date, tx?: TxClient): Promise<DashboardTrendPoint[]>;
  recentAuditEvents(limit: number, tx?: TxClient): Promise<Array<{ id: string; actorId: string | null; action: string; resource: string | null; severity: string; createdAt: Date; email?: string | null }>>;
  recentAuditEventsPaginated(
    where: {
      createdAt?: { gte: Date };
      action?: string;
      severity?: string;
    },
    page: number,
    pageSize: number,
    tx?: TxClient
  ): Promise<Array<{ id: string; actorId: string | null; action: string; resource: string | null; severity: string; createdAt: Date; email?: string | null }>>;
  countAuditEvents(
    where: {
      createdAt?: { gte: Date };
      action?: string;
      severity?: string;
    },
    tx?: TxClient
  ): Promise<number>;
  planDistribution(tx?: TxClient): Promise<Array<{ plan: string; count: number }>>;
}

export class PrismaDashboardRepository implements DashboardRepository {
  async countOrganizations(tx?: TxClient): Promise<number> {
    const db = tx ?? prisma;
    return db.organization.count({ where: { isDeleted: false } });
  }

  async countMembers(tx?: TxClient): Promise<number> {
    const db = tx ?? prisma;
    return db.user.count({ where: { isDeleted: false } });
  }

  async countActiveSessions(tx?: TxClient): Promise<number> {
    const db = tx ?? prisma;
    return db.session.count({ where: { isActive: true } });
  }

  async countPendingInvitations(tx?: TxClient): Promise<number> {
    const db = tx ?? prisma;
    return db.invitation.count({
      where: { status: 'pending', isDeleted: false, expiresAt: { gt: new Date() } },
    });
  }

  async countAuditEventsSince(since: Date, tx?: TxClient): Promise<number> {
    const db = tx ?? prisma;
    return db.auditLog.count({ where: { createdAt: { gte: since } } });
  }

  async countCriticalAlertsSince(since: Date, tx?: TxClient): Promise<number> {
    const db = tx ?? prisma;
    return db.auditLog.count({
      where: { severity: { in: ['error', 'critical'] }, createdAt: { gte: since } },
    });
  }

  async orgSignupsSince(since: Date, tx?: TxClient): Promise<DashboardTrendPoint[]> {
    const db = tx ?? prisma;
    const rows = await db.organization.groupBy({
      by: ['createdAt'],
      _count: { _all: true },
      where: { createdAt: { gte: since }, isDeleted: false },
    });
    return this.toDailyBuckets(rows.map((r) => ({ date: r.createdAt, count: r._count._all })), since);
  }

  async memberSignupsSince(since: Date, tx?: TxClient): Promise<DashboardTrendPoint[]> {
    const db = tx ?? prisma;
    const rows = await db.user.groupBy({
      by: ['createdAt'],
      _count: { _all: true },
      where: { createdAt: { gte: since }, isDeleted: false },
    });
    return this.toDailyBuckets(rows.map((r) => ({ date: r.createdAt, count: r._count._all })), since);
  }

  async auditTrendSince(since: Date, tx?: TxClient): Promise<DashboardTrendPoint[]> {
    const db = tx ?? prisma;
    const rows = await db.auditLog.groupBy({
      by: ['createdAt'],
      _count: { _all: true },
      where: { createdAt: { gte: since } },
    });
    return this.toDailyBuckets(rows.map((r) => ({ date: r.createdAt, count: r._count._all })), since);
  }

  async recentAuditEvents(
    limit: number,
    tx?: TxClient
  ): Promise<Array<{ id: string; actorId: string | null; action: string; resource: string | null; severity: string; createdAt: Date; email?: string | null }>> {
    const db = tx ?? prisma;
    return db.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        actorId: true,
        action: true,
        resource: true,
        severity: true,
        createdAt: true,
        actor: { select: { email: true } },
      },
    });
  }

  async planDistribution(tx?: TxClient): Promise<Array<{ plan: string; count: number }>> {
    const db = tx ?? prisma;
    const rows = await db.organization.groupBy({
      by: ['plan'],
      _count: { _all: true },
      where: { isDeleted: false },
    });
    return rows.map((r) => ({ plan: r.plan, count: r._count._all }));
  }

  async recentAuditEventsPaginated(
    where: {
      createdAt?: { gte: Date };
      action?: string;
      severity?: string;
    },
    page: number,
    pageSize: number,
    tx?: TxClient
  ): Promise<Array<{ id: string; actorId: string | null; action: string; resource: string | null; severity: string; createdAt: Date; email?: string | null }>> {
    const db = tx ?? prisma;
    return db.auditLog.findMany({
      where,
      take: pageSize,
      skip: (page - 1) * pageSize,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        actorId: true,
        action: true,
        resource: true,
        severity: true,
        createdAt: true,
        actor: { select: { email: true } },
      },
    });
  }

  async countAuditEvents(
    where: {
      createdAt?: { gte: Date };
      action?: string;
      severity?: string;
    },
    tx?: TxClient
  ): Promise<number> {
    const db = tx ?? prisma;
    return db.auditLog.count({ where });
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
