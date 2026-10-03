import { LRUCache } from 'lru-cache';
import Redis from 'ioredis';
import { config } from '../../config/env';
import {
  PrismaAnalyticsRepository,
  type AnalyticsRepository,
  type AnalyticsOverview,
  type AnalyticsTopItem,
  type AnalyticsDeviceBreakdown,
  type AnalyticsTrendPoint,
} from './analytics.repository';

export interface AnalyticsOverview {
  generatedAt: string;
  kpis: {
    pageViews: number;
    uniqueVisitors: number;
    engagementRate: number;
    projectViews: number;
    blogViews: number;
  };
  trends: {
    pageViews: AnalyticsTrendPoint[];
    uniqueVisitors: AnalyticsTrendPoint[];
    engagement: AnalyticsTrendPoint[];
  };
  topPages: AnalyticsTopItem[];
  topReferrers: AnalyticsTopItem[];
  topCountries: AnalyticsTopItem[];
  topCities: AnalyticsTopItem[];
  deviceBreakdown: AnalyticsDeviceBreakdown;
  topBrowsers: AnalyticsTopItem[];
  topOS: AnalyticsTopItem[];
}

const L1_TTL_MS = 30_000;
const L2_TTL_SEC = 120;
const OVERVIEW_CACHE_PREFIX = 'analytics:overview:';

export class AnalyticsService {
  private readonly repo: AnalyticsRepository;
  private readonly l1: LRUCache<string, AnalyticsOverview>;
  private readonly redis: Redis | null;

  constructor(repo?: AnalyticsRepository, redis: Redis | null = null) {
    this.repo = repo ?? new PrismaAnalyticsRepository();
    this.redis = redis;
    this.l1 = new LRUCache<string, AnalyticsOverview>({
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

  private cacheKey(range: string): string {
    return `${OVERVIEW_CACHE_PREFIX}${range}`;
  }

  async getOverview(range: string): Promise<AnalyticsOverview> {
    const key = this.cacheKey(range);

    const l1Hit = this.l1.get(key);
    if (l1Hit) return l1Hit;

    if (this.redis) {
      const raw = await this.redis.get(key);
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

    const overview = await this.compute(range);
    this.l1.set(key, overview);
    if (this.redis) {
      await this.redis.set(key, JSON.stringify(overview), 'EX', L2_TTL_SEC);
    }
    return overview;
  }

  private async compute(range: string): Promise<AnalyticsOverview> {
    const days = AnalyticsService.rangeDays(range);
    const since = AnalyticsService.rangeStart(days);
    const now = new Date();

    const [
      pageViews,
      uniqueVisitors,
      engagementRate,
      projectViews,
      blogViews,
      pageViewsTrend,
      uniqueVisitorsTrend,
      engagementTrend,
      topPages,
      topReferrers,
      topCountries,
      topCities,
      deviceBreakdown,
      topBrowsers,
      topOS,
    ] = await Promise.all([
      this.repo.countPageViews(since),
      this.repo.countUniqueVisitors(since),
      this.repo.calculateEngagementRate(since),
      this.repo.countProjectViews(since),
      this.repo.countBlogViews(since),
      this.repo.pageViewsTrend(since),
      this.repo.uniqueVisitorsTrend(since),
      this.repo.engagementTrend(since),
      this.repo.topPages(since, 10),
      this.repo.topReferrers(since, 10),
      this.repo.topCountries(since, 10),
      this.repo.topCities(since, 10),
      this.repo.deviceBreakdown(since),
      this.repo.topBrowsers(since, 10),
      this.repo.topOS(since, 10),
    ]);

    return {
      generatedAt: now.toISOString(),
      kpis: {
        pageViews,
        uniqueVisitors,
        engagementRate: Math.round(engagementRate * 10) / 10,
        projectViews,
        blogViews,
      },
      trends: {
        pageViews: pageViewsTrend,
        uniqueVisitors: uniqueVisitorsTrend,
        engagement: engagementTrend,
      },
      topPages,
      topReferrers,
      topCountries,
      topCities,
      deviceBreakdown,
      topBrowsers,
      topOS,
    };
  }

  async getTopPages(range: string, limit: number): Promise<AnalyticsTopItem[]> {
    const days = AnalyticsService.rangeDays(range);
    const since = AnalyticsService.rangeStart(days);
    return this.repo.topPages(since, limit);
  }

  async getTopReferrers(range: string, limit: number): Promise<AnalyticsTopItem[]> {
    const days = AnalyticsService.rangeDays(range);
    const since = AnalyticsService.rangeStart(days);
    return this.repo.topReferrers(since, limit);
  }

  async getTopCountries(range: string, limit: number): Promise<AnalyticsTopItem[]> {
    const days = AnalyticsService.rangeDays(range);
    const since = AnalyticsService.rangeStart(days);
    return this.repo.topCountries(since, limit);
  }

  async getTopCities(range: string, limit: number): Promise<AnalyticsTopItem[]> {
    const days = AnalyticsService.rangeDays(range);
    const since = AnalyticsService.rangeStart(days);
    return this.repo.topCities(since, limit);
  }

  async getDeviceBreakdown(range: string): Promise<AnalyticsDeviceBreakdown> {
    const days = AnalyticsService.rangeDays(range);
    const since = AnalyticsService.rangeStart(days);
    return this.repo.deviceBreakdown(since);
  }

  async getTopBrowsers(range: string, limit: number): Promise<AnalyticsTopItem[]> {
    const days = AnalyticsService.rangeDays(range);
    const since = AnalyticsService.rangeStart(days);
    return this.repo.topBrowsers(since, limit);
  }

  async getTopOS(range: string, limit: number): Promise<AnalyticsTopItem[]> {
    const days = AnalyticsService.rangeDays(range);
    const since = AnalyticsService.rangeStart(days);
    return this.repo.topOS(since, limit);
  }

  /** Force re-computation (used after mutations). */
  async invalidate(range: string): Promise<void> {
    const key = this.cacheKey(range);
    this.l1.delete(key);
    if (this.redis) {
      await this.redis.del(key);
    }
  }
}