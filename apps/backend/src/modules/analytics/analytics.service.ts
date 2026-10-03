import { LRUCache } from 'lru-cache';
import Redis from 'ioredis';
import {
  PrismaAnalyticsRepository,
  type AnalyticsRepository,
  type AnalyticsTopItem,
  type AnalyticsDeviceBreakdown,
  type AnalyticsTotals,
  type Dimension,
  type Window,
} from './analytics.repository';
import type { TrackEventDto } from './analytics.dto';
import { describeUserAgent } from '../sessions/sessions.service';

export interface AnalyticsMetric {
  value: number;
  previous: number;
  /** Percent change from the previous period; null when there is nothing to compare with. */
  change: number | null;
}

export interface AnalyticsDailyPoint {
  date: string;
  pageViews: number;
  uniqueVisitors: number;
  sessions: number;
  /** Engaged sessions as a percentage of sessions that day. */
  engagementRate: number;
}

export interface AnalyticsOverview {
  generatedAt: string;
  range: { days: number; from: string; to: string };
  kpis: {
    pageViews: AnalyticsMetric;
    uniqueVisitors: AnalyticsMetric;
    sessions: AnalyticsMetric;
    engagementRate: AnalyticsMetric;
    avgSessionSeconds: AnalyticsMetric;
  };
  daily: AnalyticsDailyPoint[];
  topPages: AnalyticsTopItem[];
  topReferrers: AnalyticsTopItem[];
  topCountries: AnalyticsTopItem[];
  topCities: AnalyticsTopItem[];
  topBrowsers: AnalyticsTopItem[];
  topOS: AnalyticsTopItem[];
  deviceBreakdown: AnalyticsDeviceBreakdown;
}

export interface TrackContext {
  organizationId: string;
  userId: string | null;
  userAgent: string | null;
  country: string | null;
  city: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const L1_TTL_MS = 30_000;
const L2_TTL_SEC = 120;
const OVERVIEW_CACHE_PREFIX = 'analytics:overview:';
const TOP_LIMIT = 10;
/** Referrers are fetched wider than shown because several URLs collapse into one site. */
const REFERRER_FETCH = 50;

const KNOWN_REFERRERS: Array<[RegExp, string]> = [
  [/(^|\.)google\./, 'Google'],
  [/(^|\.)bing\.com$/, 'Bing'],
  [/(^|\.)duckduckgo\.com$/, 'DuckDuckGo'],
  [/(^|\.)(facebook\.com|fb\.com)$/, 'Facebook'],
  [/(^|\.)(twitter\.com|x\.com|t\.co)$/, 'X (Twitter)'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'LinkedIn'],
  [/(^|\.)github\.com$/, 'GitHub'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
  [/(^|\.)instagram\.com$/, 'Instagram'],
];

/** "https://www.google.co.in/search?q=x" → "Google"; unknown hosts keep their hostname. */
export const referrerSource = (referrer: string): string => {
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase();
    return KNOWN_REFERRERS.find(([re]) => re.test(host))?.[1] ?? host;
  } catch {
    return referrer;
  }
};

export const deviceTypeOf = (ua: string | null): 'desktop' | 'mobile' | 'tablet' => {
  if (!ua) return 'desktop';
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return 'tablet';
  if (/Mobile|iPhone|iPod|Android|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return 'mobile';
  return 'desktop';
};

export const percentChange = (value: number, previous: number): number | null =>
  previous === 0 ? null : Math.round(((value - previous) / previous) * 1000) / 10;

const metric = (value: number, previous: number): AnalyticsMetric => ({
  value,
  previous,
  change: percentChange(value, previous),
});

const rate = (part: number, whole: number): number =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;

const withShare = (
  rows: Array<{ name: string; count: number }>,
  total: number
): AnalyticsTopItem[] =>
  rows.map((r) => ({ ...r, percentage: total > 0 ? Math.round((r.count / total) * 100) : 0 }));

export class AnalyticsService {
  private readonly repo: AnalyticsRepository;
  private readonly l1: LRUCache<string, AnalyticsOverview>;
  private readonly redis: Redis | null;

  constructor(repo?: AnalyticsRepository, redis: Redis | null = null) {
    this.repo = repo ?? new PrismaAnalyticsRepository();
    this.redis = redis;
    this.l1 = new LRUCache<string, AnalyticsOverview>({ max: 200, ttl: L1_TTL_MS });
  }

  static rangeDays(range: string): number {
    return range === '7' ? 7 : range === '90' ? 90 : 30;
  }

  /**
   * The window covers whole UTC days ending today, so daily buckets line up with the
   * SQL `date_trunc('day', … AT TIME ZONE 'UTC')` grouping.
   */
  static window(organizationId: string, days: number, now = new Date()): Window {
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return { organizationId, from: new Date(to.getTime() - days * DAY_MS), to };
  }

  // ---------------------------------------------------------------------------
  // Reporting
  // ---------------------------------------------------------------------------

  async getOverview(organizationId: string, range: string): Promise<AnalyticsOverview> {
    // Tenant-scoped key: one organization must never be served another's cached numbers.
    const key = `${OVERVIEW_CACHE_PREFIX}${organizationId}:${range}`;

    const l1Hit = this.l1.get(key);
    if (l1Hit) return l1Hit;

    if (this.redis) {
      const raw = await this.redis.get(key).catch(() => null);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as AnalyticsOverview;
          this.l1.set(key, parsed);
          return parsed;
        } catch {
          // corrupt payload — treat as miss
        }
      }
    }

    const overview = await this.compute(organizationId, AnalyticsService.rangeDays(range));
    this.l1.set(key, overview);
    if (this.redis) {
      await this.redis.set(key, JSON.stringify(overview), 'EX', L2_TTL_SEC).catch(() => undefined);
    }
    return overview;
  }

  async getTop(
    organizationId: string,
    range: string,
    dimension: Dimension,
    limit: number
  ): Promise<AnalyticsTopItem[]> {
    const w = AnalyticsService.window(organizationId, AnalyticsService.rangeDays(range));
    const [totals, rows] = await Promise.all([
      this.repo.totals(w),
      dimension === 'referrer' ? this.referrers(w, limit) : this.repo.top(w, dimension, limit),
    ]);
    return withShare(rows, totals.pageViews);
  }

  async getDeviceBreakdown(organizationId: string, range: string) {
    return this.repo.devices(
      AnalyticsService.window(organizationId, AnalyticsService.rangeDays(range))
    );
  }

  private async compute(organizationId: string, days: number): Promise<AnalyticsOverview> {
    const current = AnalyticsService.window(organizationId, days);
    const previous: Window = {
      organizationId,
      from: new Date(current.from.getTime() - days * DAY_MS),
      to: current.from,
    };

    const [now, before, daily, pages, referrers, countries, cities, browsers, os, devices] =
      await Promise.all([
        this.repo.totals(current),
        this.repo.totals(previous),
        this.repo.daily(current),
        this.repo.top(current, 'page', TOP_LIMIT),
        this.referrers(current, TOP_LIMIT),
        this.repo.top(current, 'country', TOP_LIMIT),
        this.repo.top(current, 'city', TOP_LIMIT),
        this.repo.top(current, 'browser', TOP_LIMIT),
        this.repo.top(current, 'os', TOP_LIMIT),
        this.repo.devices(current),
      ]);

    const engagement = (t: AnalyticsTotals) => rate(t.engagedSessions, t.sessions);
    const share = (rows: Array<{ name: string; count: number }>) => withShare(rows, now.pageViews);

    return {
      generatedAt: new Date().toISOString(),
      range: {
        days,
        from: current.from.toISOString(),
        to: new Date(current.to.getTime() - 1).toISOString(),
      },
      kpis: {
        pageViews: metric(now.pageViews, before.pageViews),
        uniqueVisitors: metric(now.uniqueVisitors, before.uniqueVisitors),
        sessions: metric(now.sessions, before.sessions),
        engagementRate: metric(engagement(now), engagement(before)),
        avgSessionSeconds: metric(now.avgSessionSeconds, before.avgSessionSeconds),
      },
      daily: this.fillDays(current, daily),
      topPages: share(pages),
      topReferrers: share(referrers),
      topCountries: share(countries),
      topCities: share(cities),
      topBrowsers: share(browsers),
      topOS: share(os),
      deviceBreakdown: devices,
    };
  }

  /** Referrer URLs grouped by source site (all Google domains count as "Google"). */
  private async referrers(w: Window, limit: number) {
    const rows = await this.repo.top(w, 'referrer', REFERRER_FETCH);
    const bySource = new Map<string, number>();
    for (const r of rows) {
      const source = referrerSource(r.name);
      bySource.set(source, (bySource.get(source) ?? 0) + r.count);
    }
    return [...bySource.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, limit);
  }

  /** Zero-fills every day in the window so charts have a continuous axis. */
  private fillDays(
    w: Window,
    rows: Array<{
      date: string;
      pageViews: number;
      uniqueVisitors: number;
      sessions: number;
      engagedSessions: number;
    }>
  ): AnalyticsDailyPoint[] {
    const byDate = new Map(rows.map((r) => [r.date, r]));
    const out: AnalyticsDailyPoint[] = [];
    for (let t = w.from.getTime(); t < w.to.getTime(); t += DAY_MS) {
      const date = new Date(t).toISOString().slice(0, 10);
      const r = byDate.get(date);
      out.push({
        date,
        pageViews: r?.pageViews ?? 0,
        uniqueVisitors: r?.uniqueVisitors ?? 0,
        sessions: r?.sessions ?? 0,
        engagementRate: r ? rate(r.engagedSessions, r.sessions) : 0,
      });
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Ingestion
  // ---------------------------------------------------------------------------

  async track(dto: TrackEventDto, ctx: TrackContext, at = new Date()): Promise<void> {
    const ua = describeUserAgent(ctx.userAgent);
    const referrer = dto.referrer ? dto.referrer : null;
    await this.repo.record(
      {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        sessionId: dto.sessionId,
        visitorId: dto.visitorId,
        eventType: dto.eventType,
        eventName: dto.eventName ?? null,
        // Query strings can carry tokens or personal data; only the path is kept.
        pagePath: dto.path.split(/[?#]/)[0] || '/',
        pageTitle: dto.title ?? null,
        referrer: referrer && /^https?:\/\//i.test(referrer) ? referrer : null,
        deviceType: deviceTypeOf(ctx.userAgent),
        browser: ua.browser,
        os: ua.platform,
        country: ctx.country,
        city: ctx.city,
      },
      at
    );
  }
}
