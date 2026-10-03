import { prisma } from '../../infrastructure/prisma';
import type { TxClient } from '../../infrastructure/prisma';

export interface AnalyticsTrendPoint {
  date: string;
  count: number;
}

export interface AnalyticsTopItem {
  name: string;
  count: number;
  percentage: number;
}

export interface AnalyticsDeviceBreakdown {
  desktop: number;
  mobile: number;
  tablet: number;
}

export interface AnalyticsRepository {
  countPageViews(since: Date, tx?: TxClient): Promise<number>;
  countUniqueVisitors(since: Date, tx?: TxClient): Promise<number>;
  calculateEngagementRate(since: Date, tx?: TxClient): Promise<number>;
  countProjectViews(since: Date, tx?: TxClient): Promise<number>;
  countBlogViews(since: Date, tx?: TxClient): Promise<number>;
  pageViewsTrend(since: Date, tx?: TxClient): Promise<AnalyticsTrendPoint[]>;
  uniqueVisitorsTrend(since: Date, tx?: TxClient): Promise<AnalyticsTrendPoint[]>;
  engagementTrend(since: Date, tx?: TxClient): Promise<AnalyticsTrendPoint[]>;
  topPages(since: Date, limit: number, tx?: TxClient): Promise<AnalyticsTopItem[]>;
  topReferrers(since: Date, limit: number, tx?: TxClient): Promise<AnalyticsTopItem[]>;
  topCountries(since: Date, limit: number, tx?: TxClient): Promise<AnalyticsTopItem[]>;
  topCities(since: Date, limit: number, tx?: TxClient): Promise<AnalyticsTopItem[]>;
  deviceBreakdown(since: Date, tx?: TxClient): Promise<AnalyticsDeviceBreakdown>;
  topBrowsers(since: Date, limit: number, tx?: TxClient): Promise<AnalyticsTopItem[]>;
  topOS(since: Date, limit: number, tx?: TxClient): Promise<AnalyticsTopItem[]>;
}

export class PrismaAnalyticsRepository implements AnalyticsRepository {
  async countPageViews(since: Date, tx?: TxClient): Promise<number> {
    const db = tx ?? prisma;
    return db.analyticsEvent.count({
      where: { eventType: 'pageview', createdAt: { gte: since } },
    });
  }

  async countUniqueVisitors(since: Date, tx?: TxClient): Promise<number> {
    const db = tx ?? prisma;
    const result = await db.analyticsEvent.groupBy({
      by: ['visitorId'],
      where: { eventType: 'pageview', createdAt: { gte: since } },
      _count: { visitorId: true },
    });
    return result.length;
  }

  async calculateEngagementRate(since: Date, tx?: TxClient): Promise<number> {
    const db = tx ?? prisma;
    const [totalSessions, engagedSessions] = await Promise.all([
      db.analyticsSession.count({
        where: { startedAt: { gte: since } },
      }),
      db.analyticsSession.count({
        where: {
          startedAt: { gte: since },
          OR: [
            { pageViews: { gt: 1 } },
            { duration: { gt: 30000 } },
            { events: { gt: 2 } },
          ],
        },
      }),
    ]);
    return totalSessions > 0 ? (engagedSessions / totalSessions) * 100 : 0;
  }

  async countProjectViews(since: Date, tx?: TxClient): Promise<number> {
    const db = tx ?? prisma;
    return db.analyticsEvent.count({
      where: {
        eventType: 'pageview',
        createdAt: { gte: since },
        pagePath: { startsWith: '/projects' },
      },
    });
  }

  async countBlogViews(since: Date, tx?: TxClient): Promise<number> {
    const db = tx ?? prisma;
    return db.analyticsEvent.count({
      where: {
        eventType: 'pageview',
        createdAt: { gte: since },
        pagePath: { startsWith: '/blog' },
      },
    });
  }

  async pageViewsTrend(since: Date, tx?: TxClient): Promise<AnalyticsTrendPoint[]> {
    const db = tx ?? prisma;
    const rows = await db.analyticsEvent.groupBy({
      by: ['createdAt'],
      _count: { _all: true },
      where: { eventType: 'pageview', createdAt: { gte: since } },
    });
    return this.toDailyBuckets(
      rows.map((r) => ({ date: r.createdAt, count: r._count._all })),
      since
    );
  }

  async uniqueVisitorsTrend(since: Date, tx?: TxClient): Promise<AnalyticsTrendPoint[]> {
    const db = tx ?? prisma;
    const rows = await db.$queryRaw<Array<{ date: Date; count: bigint }>>`
      SELECT DATE("createdAt") as date, COUNT(DISTINCT "visitorId")::bigint as count
      FROM "AnalyticsEvent"
      WHERE "eventType" = 'pageview' AND "createdAt" >= ${since}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;
    return this.toDailyBuckets(
      rows.map((r) => ({ date: r.date, count: Number(r.count) })),
      since
    );
  }

  async engagementTrend(since: Date, tx?: TxClient): Promise<AnalyticsTrendPoint[]> {
    const db = tx ?? prisma;
    const rows = await db.analyticsSession.groupBy({
      by: ['startedAt'],
      _count: { _all: true },
      _avg: { duration: true, pageViews: true },
      where: { startedAt: { gte: since } },
    });
    return this.toDailyBuckets(
      rows.map((r) => ({
        date: r.startedAt,
        count: Math.round(
          (r._avg.duration ?? 0) / 1000 + (r._avg.pageViews ?? 0) * 30
        ),
      })),
      since
    );
  }

  async topPages(since: Date, limit: number, tx?: TxClient): Promise<AnalyticsTopItem[]> {
    const db = tx ?? prisma;
    const rows = await db.analyticsEvent.groupBy({
      by: ['pagePath'],
      _count: { _all: true },
      where: { eventType: 'pageview', createdAt: { gte: since } },
      orderBy: { _count: { _all: 'desc' } },
      take: limit,
    });
    const total = rows.reduce((sum, r) => sum + r._count._all, 0);
    return rows.map((r) => ({
      name: r.pagePath,
      count: r._count._all,
      percentage: total > 0 ? Math.round((r._count._all / total) * 100) : 0,
    }));
  }

  async topReferrers(since: Date, limit: number, tx?: TxClient): Promise<AnalyticsTopItem[]> {
    const db = tx ?? prisma;
    const rows = await db.analyticsEvent.groupBy({
      by: ['referrer'],
      _count: { _all: true },
      where: {
        eventType: 'pageview',
        createdAt: { gte: since },
        referrer: { not: null, not: '' },
      },
      orderBy: { _count: { _all: 'desc' } },
      take: limit,
    });
    const total = rows.reduce((sum, r) => sum + r._count._all, 0);
    return rows.map((r) => ({
      name: this.simplifyReferrer(r.referrer ?? 'Direct'),
      count: r._count._all,
      percentage: total > 0 ? Math.round((r._count._all / total) * 100) : 0,
    }));
  }

  async topCountries(since: Date, limit: number, tx?: TxClient): Promise<AnalyticsTopItem[]> {
    const db = tx ?? prisma;
    const rows = await db.analyticsEvent.groupBy({
      by: ['country'],
      _count: { _all: true },
      where: {
        eventType: 'pageview',
        createdAt: { gte: since },
        country: { not: null, not: '' },
      },
      orderBy: { _count: { _all: 'desc' } },
      take: limit,
    });
    const total = rows.reduce((sum, r) => sum + r._count._all, 0);
    return rows.map((r) => ({
      name: r.country ?? 'Unknown',
      count: r._count._all,
      percentage: total > 0 ? Math.round((r._count._all / total) * 100) : 0,
    }));
  }

  async topCities(since: Date, limit: number, tx?: TxClient): Promise<AnalyticsTopItem[]> {
    const db = tx ?? prisma;
    const rows = await db.analyticsEvent.groupBy({
      by: ['city', 'country'],
      _count: { _all: true },
      where: {
        eventType: 'pageview',
        createdAt: { gte: since },
        city: { not: null, not: '' },
      },
      orderBy: { _count: { _all: 'desc' } },
      take: limit,
    });
    const total = rows.reduce((sum, r) => sum + r._count._all, 0);
    return rows.map((r) => ({
      name: `${r.city}, ${r.country}`,
      count: r._count._all,
      percentage: total > 0 ? Math.round((r._count._all / total) * 100) : 0,
    }));
  }

  async deviceBreakdown(since: Date, tx?: TxClient): Promise<AnalyticsDeviceBreakdown> {
    const db = tx ?? prisma;
    const [desktop, mobile, tablet] = await Promise.all([
      db.analyticsEvent.count({
        where: { eventType: 'pageview', createdAt: { gte: since }, deviceType: 'desktop' },
      }),
      db.analyticsEvent.count({
        where: { eventType: 'pageview', createdAt: { gte: since }, deviceType: 'mobile' },
      }),
      db.analyticsEvent.count({
        where: { eventType: 'pageview', createdAt: { gte: since }, deviceType: 'tablet' },
      }),
    ]);
    return { desktop, mobile, tablet };
  }

  async topBrowsers(since: Date, limit: number, tx?: TxClient): Promise<AnalyticsTopItem[]> {
    const db = tx ?? prisma;
    const rows = await db.analyticsEvent.groupBy({
      by: ['browser'],
      _count: { _all: true },
      where: {
        eventType: 'pageview',
        createdAt: { gte: since },
        browser: { not: null, not: '' },
      },
      orderBy: { _count: { _all: 'desc' } },
      take: limit,
    });
    const total = rows.reduce((sum, r) => sum + r._count._all, 0);
    return rows.map((r) => ({
      name: r.browser ?? 'Unknown',
      count: r._count._all,
      percentage: total > 0 ? Math.round((r._count._all / total) * 100) : 0,
    }));
  }

  async topOS(since: Date, limit: number, tx?: TxClient): Promise<AnalyticsTopItem[]> {
    const db = tx ?? prisma;
    const rows = await db.analyticsEvent.groupBy({
      by: ['os'],
      _count: { _all: true },
      where: {
        eventType: 'pageview',
        createdAt: { gte: since },
        os: { not: null, not: '' },
      },
      orderBy: { _count: { _all: 'desc' } },
      take: limit,
    });
    const total = rows.reduce((sum, r) => sum + r._count._all, 0);
    return rows.map((r) => ({
      name: r.os ?? 'Unknown',
      count: r._count._all,
      percentage: total > 0 ? Math.round((r._count._all / total) * 100) : 0,
    }));
  }

  private simplifyReferrer(referrer: string): string {
    try {
      const url = new URL(referrer);
      const hostname = url.hostname.replace('www.', '');
      if (hostname.includes('google')) return 'Google';
      if (hostname.includes('facebook')) return 'Facebook';
      if (hostname.includes('twitter') || hostname.includes('x.com')) return 'X (Twitter)';
      if (hostname.includes('linkedin')) return 'LinkedIn';
      if (hostname.includes('github')) return 'GitHub';
      if (hostname.includes('youtube')) return 'YouTube';
      if (hostname.includes('instagram')) return 'Instagram';
      return hostname;
    } catch {
      return 'Direct';
    }
  }

  /** Collapse raw timestamps into zero-filled daily buckets over the window. */
  private toDailyBuckets(
    points: Array<{ date: Date; count: number }>,
    since: Date
  ): AnalyticsTrendPoint[] {
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