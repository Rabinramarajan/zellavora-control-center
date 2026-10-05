import { LRUCache } from 'lru-cache';
import Redis from 'ioredis';
import {
  PrismaDashboardRepository,
  type ActivityFilters,
  type DashboardActivityRow,
  type DashboardRepository,
  type DashboardTrendPoint,
  type DistributionSlice,
} from './dashboard.repository';
import { scopeCacheKey, type DashboardScope } from './dashboard.scope';

export interface DashboardKpi {
  key: string;
  label: string;
  value: number;
  hint: string;
  /** Which trend series backs this card's sparkline, if any. */
  series: 'primary' | 'secondary' | 'activity' | null;
}

export interface DashboardTrends {
  /** Organization scope: organizations. Individual scope: own projects. */
  primary: DashboardTrendPoint[];
  /** Organization scope: members. Individual scope: own daily sheets. */
  secondary: DashboardTrendPoint[];
  activity: DashboardTrendPoint[];
}

export interface DashboardPanel {
  title: string;
  subtitle: string;
  chip: string;
  totalLabel: string;
  emptyTitle: string;
  emptyHint: string;
}

export interface DashboardOverview {
  generatedAt: string;
  scope: DashboardScope['kind'];
  kpis: DashboardKpi[];
  trendLegend: { primary: string; secondary: string };
  trends: DashboardTrends;
  activity: ActivityFeedItem[];
  panel: DashboardPanel;
  planDistribution: DistributionSlice[];
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

const toFeedItem = (e: DashboardActivityRow): ActivityFeedItem => ({
  id: e.id,
  actorId: e.actorId,
  actorEmail: e.actor?.email ?? null,
  action: e.action,
  resource: e.resource,
  severity: e.severity,
  createdAt: e.createdAt.toISOString(),
});

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

  private cacheKey(range: string, scope: DashboardScope): string {
    return `${OVERVIEW_CACHE_PREFIX}${scopeCacheKey(scope)}:${range}`;
  }

  async getOverview(range: string, scope: DashboardScope): Promise<DashboardOverview> {
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

    const overview =
      scope.kind === 'individual'
        ? await this.computeIndividual(range, scope)
        : await this.computeOrganization(range, scope);

    this.l1.set(key, overview);
    if (this.redis) {
      await this.redis.set(key, JSON.stringify(overview), 'EX', L2_TTL_SEC);
    }
    return overview;
  }

  private async computeOrganization(
    range: string,
    scope: DashboardScope
  ): Promise<DashboardOverview> {
    const since = DashboardService.rangeStart(DashboardService.rangeDays(range));
    const last24h = DashboardService.rangeStart(1);

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
      this.repo.countOrganizations(scope),
      this.repo.countMembers(scope),
      this.repo.countActiveSessions(scope),
      this.repo.countPendingInvitations(scope),
      this.repo.countAuditEventsSince(scope, last24h),
      this.repo.countCriticalAlertsSince(scope, last24h),
      this.repo.orgSignupsSince(scope, since),
      this.repo.memberSignupsSince(scope, since),
      this.repo.auditTrendSince(scope, since),
      this.repo.recentAuditEvents(scope, 12),
      this.repo.planDistribution(scope),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      scope: 'organization',
      kpis: [
        {
          key: 'organizations',
          label: 'Organizations',
          value: organizations,
          hint: 'Active tenants',
          series: 'primary',
        },
        {
          key: 'members',
          label: 'Members',
          value: members,
          hint: 'Active accounts',
          series: 'secondary',
        },
        {
          key: 'activeSessions',
          label: 'Active Sessions',
          value: activeSessions,
          hint: 'Live sessions',
          series: null,
        },
        {
          key: 'pendingInvitations',
          label: 'Pending Invites',
          value: pendingInvitations,
          hint: 'Awaiting acceptance',
          series: null,
        },
        {
          key: 'auditEvents24h',
          label: 'Audit Events',
          value: auditEvents24h,
          hint: 'Last 24 hours',
          series: 'activity',
        },
        {
          key: 'criticalAlerts24h',
          label: 'Critical Alerts',
          value: criticalAlerts24h,
          hint: 'Last 24 hours',
          series: null,
        },
      ],
      trendLegend: { primary: 'Organizations', secondary: 'Members' },
      trends: { primary: orgTrend, secondary: memberTrend, activity: auditTrend },
      activity: recent.map(toFeedItem),
      panel: {
        title: 'Plan Distribution',
        subtitle: 'Organization subscription plans.',
        chip: 'Organizations',
        totalLabel: 'Total Organizations',
        emptyTitle: 'No plans',
        emptyHint: 'No organization plans recorded.',
      },
      planDistribution,
    };
  }

  private async computeIndividual(
    range: string,
    scope: DashboardScope
  ): Promise<DashboardOverview> {
    const since = DashboardService.rangeStart(DashboardService.rangeDays(range));
    const last24h = DashboardService.rangeStart(1);

    const [
      projects,
      sheets,
      mediaFiles,
      activeSessions,
      auditEvents24h,
      criticalAlerts24h,
      projectTrend,
      sheetTrend,
      auditTrend,
      recent,
      contentDistribution,
    ] = await Promise.all([
      this.repo.countProjects(scope),
      this.repo.countDailySheets(scope),
      this.repo.countMediaFiles(scope),
      this.repo.countActiveSessions(scope),
      this.repo.countAuditEventsSince(scope, last24h),
      this.repo.countCriticalAlertsSince(scope, last24h),
      this.repo.projectsCreatedSince(scope, since),
      this.repo.sheetsLoggedSince(scope, since),
      this.repo.auditTrendSince(scope, since),
      this.repo.recentAuditEvents(scope, 12),
      this.repo.contentDistribution(scope),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      scope: 'individual',
      kpis: [
        {
          key: 'projects',
          label: 'My Projects',
          value: projects,
          hint: 'Created by you',
          series: 'primary',
        },
        {
          key: 'sheets',
          label: 'My Sheets',
          value: sheets,
          hint: 'Daily sheets logged',
          series: 'secondary',
        },
        {
          key: 'mediaFiles',
          label: 'My Media',
          value: mediaFiles,
          hint: 'Files you uploaded',
          series: null,
        },
        {
          key: 'activeSessions',
          label: 'Active Sessions',
          value: activeSessions,
          hint: 'Your signed-in devices',
          series: null,
        },
        {
          key: 'auditEvents24h',
          label: 'My Activity',
          value: auditEvents24h,
          hint: 'Last 24 hours',
          series: 'activity',
        },
        {
          key: 'criticalAlerts24h',
          label: 'Critical Alerts',
          value: criticalAlerts24h,
          hint: 'Last 24 hours',
          series: null,
        },
      ],
      trendLegend: { primary: 'Projects', secondary: 'Sheets' },
      trends: { primary: projectTrend, secondary: sheetTrend, activity: auditTrend },
      activity: recent.map(toFeedItem),
      panel: {
        title: 'My Workspace',
        subtitle: 'How your content breaks down.',
        chip: 'Personal',
        totalLabel: 'Total Items',
        emptyTitle: 'Nothing here yet',
        emptyHint: 'Create a project or log a sheet to get started.',
      },
      planDistribution: contentDistribution,
    };
  }

  async getActivityFeed(
    range: string,
    page: number,
    pageSize: number,
    scope: DashboardScope,
    filters: ActivityFilters = {}
  ): Promise<ActivityFeedPage> {
    const since = DashboardService.rangeStart(DashboardService.rangeDays(range));

    const [rows, total] = await Promise.all([
      this.repo.recentAuditEventsPaginated(scope, since, filters, page, pageSize),
      this.repo.countAuditEvents(scope, since, filters),
    ]);

    return { items: rows.map(toFeedItem), total, page, pageSize };
  }

  /** Force re-computation (used after mutations). */
  async invalidate(range: string, scope: DashboardScope): Promise<void> {
    const key = this.cacheKey(range, scope);
    this.l1.delete(key);
    if (this.redis) {
      await this.redis.del(key);
    }
  }
}
