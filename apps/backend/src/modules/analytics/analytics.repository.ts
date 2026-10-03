import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma';

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

export interface AnalyticsTotals {
  pageViews: number;
  uniqueVisitors: number;
  sessions: number;
  engagedSessions: number;
  /** Average session length in seconds. */
  avgSessionSeconds: number;
}

export interface AnalyticsDailyRow {
  date: string;
  pageViews: number;
  uniqueVisitors: number;
  sessions: number;
  engagedSessions: number;
}

/** Breakdown dimensions; values are column names, never user input. */
export const DIMENSIONS = {
  page: 'page_path',
  referrer: 'referrer',
  country: 'country',
  city: 'city',
  browser: 'browser',
  os: 'os',
} as const;
export type Dimension = keyof typeof DIMENSIONS;

export interface Window {
  organizationId: string;
  from: Date;
  to: Date;
}

export interface NewEvent {
  organizationId: string;
  userId: string | null;
  sessionId: string;
  visitorId: string;
  eventType: 'pageview' | 'event';
  eventName: string | null;
  pagePath: string;
  pageTitle: string | null;
  referrer: string | null;
  deviceType: string;
  browser: string | null;
  os: string | null;
  country: string | null;
  city: string | null;
}

/** A session counts as engaged after a second page, 30 seconds, or a few interactions. */
const ENGAGED = Prisma.sql`(page_views > 1 OR duration > 30000 OR events > 2)`;

export interface AnalyticsRepository {
  totals(w: Window): Promise<AnalyticsTotals>;
  daily(w: Window): Promise<AnalyticsDailyRow[]>;
  top(
    w: Window,
    dimension: Dimension,
    limit: number
  ): Promise<Array<{ name: string; count: number }>>;
  devices(w: Window): Promise<AnalyticsDeviceBreakdown>;
  record(event: NewEvent, at: Date): Promise<void>;
}

const num = (v: bigint | number | null | undefined): number => Number(v ?? 0);

export class PrismaAnalyticsRepository implements AnalyticsRepository {
  async totals({ organizationId, from, to }: Window): Promise<AnalyticsTotals> {
    const [events, sessions] = await Promise.all([
      prisma.$queryRaw<Array<{ page_views: bigint; visitors: bigint }>>`
        SELECT COUNT(*) FILTER (WHERE event_type = 'pageview') AS page_views,
               COUNT(DISTINCT visitor_id) AS visitors
        FROM analytics_events
        WHERE organization_id = ${organizationId}::uuid
          AND created_at >= ${from} AND created_at < ${to}`,
      prisma.$queryRaw<Array<{ sessions: bigint; engaged: bigint; avg_ms: number | null }>>`
        SELECT COUNT(*) AS sessions,
               COUNT(*) FILTER (WHERE ${ENGAGED}) AS engaged,
               AVG(duration)::float AS avg_ms
        FROM analytics_sessions
        WHERE organization_id = ${organizationId}::uuid
          AND started_at >= ${from} AND started_at < ${to}`,
    ]);
    return {
      pageViews: num(events[0]?.page_views),
      uniqueVisitors: num(events[0]?.visitors),
      sessions: num(sessions[0]?.sessions),
      engagedSessions: num(sessions[0]?.engaged),
      avgSessionSeconds: Math.round((sessions[0]?.avg_ms ?? 0) / 1000),
    };
  }

  async daily({ organizationId, from, to }: Window): Promise<AnalyticsDailyRow[]> {
    const [events, sessions] = await Promise.all([
      prisma.$queryRaw<Array<{ day: string; page_views: bigint; visitors: bigint }>>`
        SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
               COUNT(*) FILTER (WHERE event_type = 'pageview') AS page_views,
               COUNT(DISTINCT visitor_id) AS visitors
        FROM analytics_events
        WHERE organization_id = ${organizationId}::uuid
          AND created_at >= ${from} AND created_at < ${to}
        GROUP BY 1`,
      prisma.$queryRaw<Array<{ day: string; sessions: bigint; engaged: bigint }>>`
        SELECT to_char(date_trunc('day', started_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
               COUNT(*) AS sessions,
               COUNT(*) FILTER (WHERE ${ENGAGED}) AS engaged
        FROM analytics_sessions
        WHERE organization_id = ${organizationId}::uuid
          AND started_at >= ${from} AND started_at < ${to}
        GROUP BY 1`,
    ]);
    const byDay = new Map<string, AnalyticsDailyRow>();
    const row = (day: string) => {
      let r = byDay.get(day);
      if (!r) {
        r = { date: day, pageViews: 0, uniqueVisitors: 0, sessions: 0, engagedSessions: 0 };
        byDay.set(day, r);
      }
      return r;
    };
    for (const e of events) {
      const r = row(e.day);
      r.pageViews = num(e.page_views);
      r.uniqueVisitors = num(e.visitors);
    }
    for (const s of sessions) {
      const r = row(s.day);
      r.sessions = num(s.sessions);
      r.engagedSessions = num(s.engaged);
    }
    return [...byDay.values()];
  }

  async top(
    { organizationId, from, to }: Window,
    dimension: Dimension,
    limit: number
  ): Promise<Array<{ name: string; count: number }>> {
    const column = Prisma.raw(DIMENSIONS[dimension]);
    // City is ambiguous on its own ("Springfield"), so it is reported with its country.
    const label =
      dimension === 'city' ? Prisma.sql`city || COALESCE(', ' || NULLIF(country, ''), '')` : column;
    const rows = await prisma.$queryRaw<Array<{ name: string; count: bigint }>>`
      SELECT ${label} AS name, COUNT(*) AS count
      FROM analytics_events
      WHERE organization_id = ${organizationId}::uuid
        AND event_type = 'pageview'
        AND created_at >= ${from} AND created_at < ${to}
        AND ${column} IS NOT NULL AND ${column} <> ''
      GROUP BY 1
      ORDER BY count DESC, name ASC
      LIMIT ${limit}`;
    return rows.map((r) => ({ name: r.name, count: num(r.count) }));
  }

  async devices({ organizationId, from, to }: Window): Promise<AnalyticsDeviceBreakdown> {
    const rows = await prisma.$queryRaw<Array<{ device_type: string | null; count: bigint }>>`
      SELECT device_type, COUNT(*) AS count
      FROM analytics_events
      WHERE organization_id = ${organizationId}::uuid
        AND event_type = 'pageview'
        AND created_at >= ${from} AND created_at < ${to}
      GROUP BY device_type`;
    const get = (type: string) => num(rows.find((r) => r.device_type === type)?.count);
    return { desktop: get('desktop'), mobile: get('mobile'), tablet: get('tablet') };
  }

  /** Stores the event and opens or extends its session in one transaction. */
  async record(e: NewEvent, at: Date): Promise<void> {
    const isPageView = e.eventType === 'pageview';
    await prisma.$transaction(async (tx) => {
      await tx.analyticsEvent.create({
        data: {
          organizationId: e.organizationId,
          userId: e.userId,
          sessionId: e.sessionId,
          visitorId: e.visitorId,
          eventType: e.eventType,
          eventName: e.eventName,
          pagePath: e.pagePath,
          pageTitle: e.pageTitle,
          referrer: e.referrer,
          deviceType: e.deviceType,
          browser: e.browser,
          os: e.os,
          country: e.country,
          city: e.city,
          createdAt: at,
        },
      });
      // The session id is client-generated; it is only honoured within its own organization.
      const existing = await tx.analyticsSession.findFirst({
        where: { id: e.sessionId, organizationId: e.organizationId },
        select: { startedAt: true },
      });
      if (existing) {
        await tx.analyticsSession.update({
          where: { id: e.sessionId },
          data: {
            endedAt: at,
            duration: Math.max(0, at.getTime() - existing.startedAt.getTime()),
            ...(isPageView
              ? { pageViews: { increment: 1 }, exitPage: e.pagePath }
              : { events: { increment: 1 } }),
          },
        });
        return;
      }
      await tx.analyticsSession.upsert({
        where: { id: e.sessionId },
        // Same id in another organization: leave that session alone.
        update: {},
        create: {
          id: e.sessionId,
          organizationId: e.organizationId,
          visitorId: e.visitorId,
          userId: e.userId,
          startedAt: at,
          endedAt: at,
          duration: 0,
          pageViews: isPageView ? 1 : 0,
          events: isPageView ? 0 : 1,
          entryPage: e.pagePath,
          exitPage: e.pagePath,
          referrer: e.referrer,
          deviceType: e.deviceType,
          browser: e.browser,
          os: e.os,
          country: e.country,
          city: e.city,
        },
      });
    });
  }
}
