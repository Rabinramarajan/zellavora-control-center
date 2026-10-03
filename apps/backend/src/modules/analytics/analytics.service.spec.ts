import { AnalyticsService, deviceTypeOf, percentChange, referrerSource } from './analytics.service';
import type { AnalyticsRepository, AnalyticsTotals, Window } from './analytics.repository';

const ORG_A = '00000000-0000-4000-8000-00000000000a';
const ORG_B = '00000000-0000-4000-8000-00000000000b';

const totals = (overrides: Partial<AnalyticsTotals> = {}): AnalyticsTotals => ({
  pageViews: 0,
  uniqueVisitors: 0,
  sessions: 0,
  engagedSessions: 0,
  avgSessionSeconds: 0,
  ...overrides,
});

function makeRepo(overrides: Partial<Record<keyof AnalyticsRepository, jest.Mock>> = {}) {
  return {
    totals: jest.fn().mockResolvedValue(totals()),
    daily: jest.fn().mockResolvedValue([]),
    top: jest.fn().mockResolvedValue([]),
    devices: jest.fn().mockResolvedValue({ desktop: 0, mobile: 0, tablet: 0 }),
    record: jest.fn(),
    ...overrides,
  } as unknown as jest.Mocked<AnalyticsRepository>;
}

describe('helpers', () => {
  it('groups referrer URLs by source site', () => {
    expect(referrerSource('https://www.google.co.in/search?q=x')).toBe('Google');
    expect(referrerSource('https://t.co/abc')).toBe('X (Twitter)');
    expect(referrerSource('https://news.example.com/a')).toBe('news.example.com');
  });

  it('classifies device types from the user agent', () => {
    expect(deviceTypeOf('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148')).toBe('mobile');
    expect(deviceTypeOf('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe('tablet');
    expect(deviceTypeOf('Mozilla/5.0 (Linux; Android 14; SM-X710)')).toBe('tablet');
    expect(deviceTypeOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('desktop');
    expect(deviceTypeOf(null)).toBe('desktop');
  });

  it('reports no change when the previous period is empty', () => {
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(15, 10)).toBe(50);
    expect(percentChange(5, 10)).toBe(-50);
  });

  it('builds a window of whole UTC days ending today', () => {
    const w = AnalyticsService.window(ORG_A, 7, new Date('2026-10-03T15:30:00Z'));
    expect(w.from.toISOString()).toBe('2026-09-27T00:00:00.000Z');
    expect(w.to.toISOString()).toBe('2026-10-04T00:00:00.000Z');
  });
});

describe('AnalyticsService.getOverview', () => {
  it('compares against the previous period of the same length', async () => {
    const repo = makeRepo({
      totals: jest.fn(async (w: Window) =>
        w.from.getTime() < AnalyticsService.window(ORG_A, 7).from.getTime()
          ? totals({ pageViews: 50, sessions: 10, engagedSessions: 5 })
          : totals({ pageViews: 75, sessions: 20, engagedSessions: 15 })
      ),
    });
    const o = await new AnalyticsService(repo).getOverview(ORG_A, '7');
    expect(o.kpis.pageViews).toEqual({ value: 75, previous: 50, change: 50 });
    expect(o.kpis.engagementRate).toEqual({ value: 75, previous: 50, change: 50 });
  });

  it('zero-fills every day of the window', async () => {
    const repo = makeRepo();
    const o = await new AnalyticsService(repo).getOverview(ORG_A, '7');
    expect(o.daily).toHaveLength(7);
    expect(o.daily.every((d) => d.pageViews === 0 && d.engagementRate === 0)).toBe(true);
  });

  it('caches per organization, never across tenants', async () => {
    const repo = makeRepo();
    const service = new AnalyticsService(repo);
    await service.getOverview(ORG_A, '30');
    await service.getOverview(ORG_A, '30');
    await service.getOverview(ORG_B, '30');
    const orgs = (repo.daily as jest.Mock).mock.calls.map(([w]) => (w as Window).organizationId);
    expect(orgs).toEqual([ORG_A, ORG_B]);
  });

  it('merges referrers from the same site before ranking', async () => {
    const repo = makeRepo({
      totals: jest.fn().mockResolvedValue(totals({ pageViews: 10 })),
      top: jest.fn(async (_w: Window, dim: string) =>
        dim === 'referrer'
          ? [
              { name: 'https://www.google.com/', count: 3 },
              { name: 'https://github.com/x', count: 4 },
              { name: 'https://google.co.uk/', count: 2 },
            ]
          : []
      ),
    });
    const o = await new AnalyticsService(repo).getOverview(ORG_A, '30');
    expect(o.topReferrers).toEqual([
      { name: 'Google', count: 5, percentage: 50 },
      { name: 'GitHub', count: 4, percentage: 40 },
    ]);
  });
});

describe('AnalyticsService.track', () => {
  it('strips query strings and keeps only http(s) referrers', async () => {
    const repo = makeRepo();
    await new AnalyticsService(repo).track(
      {
        sessionId: '00000000-0000-4000-8000-000000000001',
        visitorId: 'visitor-123456',
        eventType: 'pageview',
        path: '/iam/users?token=secret#top',
        referrer: 'javascript:alert(1)',
      },
      {
        organizationId: ORG_A,
        userId: null,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36',
        country: 'IN',
        city: null,
      }
    );
    expect(repo.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_A,
        pagePath: '/iam/users',
        referrer: null,
        deviceType: 'desktop',
        browser: 'Chrome',
        os: 'Windows',
        country: 'IN',
      }),
      expect.any(Date)
    );
  });
});
