import { LRUCache } from 'lru-cache';
import Redis from 'ioredis';
import {
  PrismaDashboardRepository,
  type DashboardRepository,
  type DashboardTrendPoint,
} from './dashboard.repository';

export interface DashboardOverview {
  generatedAt: string;
  kpis: {
    organizations: number;
    members: number;
    activeSessions: number;
    pendingInvitations: number;
    auditEvents24h: number;
    criticalAlerts24h: number;
  };
  trends: {
    organizations: DashboardTrendPoint[];
    members: DashboardTrendPoint[];
    activity: DashboardTrendPoint[];
  };
  activity: Array<{
    id: string;
    actorId: string | null;
    actorEmail: string | null;
    action: string;
    resource: string | null;
    severity: string;
    createdAt: string;
  }>;
  planDistribution: Array<{ plan: string; count: number }>;
}

export interface ActivityFeedItem {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  resource: string | null;
  severity: string;
  createdAt: string;
}

export interface ActivityFeedPage {
  items: ActivityFeedItem[];
  total: number;
  page: number;
  pageSize: number;
}

const L1_TTL_MS = 30_000;
const L2_TTL_SEC = 120;
const OVERVIEW_CACHE_PREFIX = 'dashboard:overview:';

export class DashboardService {
  private readonly repo: DashboardRepository;
  private readonly l1: LRUCache<string, DashboardOverview>;
  private readonly redis: Redis | null;

  constructor(repo?: DashboardRepository, redis: Redis | null = null) {
    this.repo = repo ?? new PrismaDashboardRepository();
    this.redis = redis;
    this.l1 = new LRUCache<string, DashboardOverview>({
      max: 100,
      ttl: L1_TTL_MS,
    });
  }

  private static rangeDays(range: string): number {
    return range === '7' ? 7 : range === '90' ? 90 : 30;
  }

  private static rangeStart(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  private cacheKey(range: string, scope: string): string {
    return `${OVERVIEW_CACHE_PREFIX}${scope}:${range}`;
  }

  async getOverview(range: string, scope: string): Promise<DashboardOverview> {
    const key = this.cacheKey(range, scope);

    const l1Hit = this.l1.get(key);
    if (l1Hit) return l1Hit;

    if (this.redis) {
      const raw = await this.redis.get(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as DashboardOverview;
          this.l1.set(key, parsed);
          return parsed;
        } catch {
          // corrupt payload — treat as miss
        }
      }
    }

    const overview = await this.compute(range);
    this.l1.set(key, overview);
    if (this.redis) {
      await this.redis.set(key, JSON.stringify(overview), 'EX', L2_TTL_SEC);
    }
    return overview;
  }

  private async compute(range: string): Promise<DashboardOverview> {
    const days = DashboardService.rangeDays(range);
    const since = DashboardService.rangeStart(days);
    const now = new Date();

    const [
      organizations,
      members,
      activeSessions,
      pendingInvitations,
      auditEvents24h,
      criticalAlerts24h,
      orgTrend,
      memberTrend,
      auditTrend,
      recent,
      planDistribution,
    ] = await Promise.all([
      this.repo.countOrganizations(),
      this.repo.countMembers(),
      this.repo.countActiveSessions(),
      this.repo.countPendingInvitations(),
      this.repo.countAuditEventsSince(DashboardService.rangeStart(1)),
      this.repo.countCriticalAlertsSince(DashboardService.rangeStart(1)),
      this.repo.orgSignupsSince(since),
      this.repo.memberSignupsSince(since),
      this.repo.auditTrendSince(since),
      this.repo.recentAuditEvents(12),
      this.repo.planDistribution(),
    ]);

    return {
      generatedAt: now.toISOString(),
      kpis: {
        organizations,
        members,
        activeSessions,
        pendingInvitations,
        auditEvents24h,
        criticalAlerts24h,
      },
      trends: {
        organizations: orgTrend,
        members: memberTrend,
        activity: auditTrend,
      },
      activity: recent.map((e) => ({
        id: e.id,
        actorId: e.actorId,
        actorEmail: e.email ?? null,
        action: e.action,
        resource: e.resource,
        severity: e.severity,
        createdAt: e.createdAt.toISOString(),
      })),
      planDistribution,
    };
  }

  async getActivityFeed(
    range: string,
    page: number,
    pageSize: number,
    filters?: { action?: string; severity?: string }
  ): Promise<ActivityFeedPage> {
    const days = DashboardService.rangeDays(range);
    const since = DashboardService.rangeStart(days);

    const where = {
      createdAt: { gte: since },
      ...(filters?.action ? { action: filters.action } : {}),
      ...(filters?.severity ? { severity: filters.severity } : {}),
    };

    const [rows, total] = await Promise.all([
      (this.repo as PrismaDashboardRepository).recentAuditEventsPaginated(where, page, pageSize),
      (this.repo as PrismaDashboardRepository).countAuditEvents(where),
    ]);

    return {
      items: rows.map((e) => ({
        id: e.id,
        actorId: e.actorId,
        actorEmail: e.email ?? null,
        action: e.action,
        resource: e.resource,
        severity: e.severity,
        createdAt: e.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  /** Force re-computation (used after mutations). */
  async invalidate(range: string, scope: string): Promise<void> {
    const key = this.cacheKey(range, scope);
    this.l1.delete(key);
    if (this.redis) {
      await this.redis.del(key);
    }
  }
}
