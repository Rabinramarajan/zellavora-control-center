import { Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { config } from '../../config/env';
import { AnalyticsService } from './analytics.service';
import {
  AnalyticsOverviewQuerySchema,
  AnalyticsTopPagesQuerySchema,
  AnalyticsTopReferrersQuerySchema,
  AnalyticsGeoQuerySchema,
  AnalyticsDevicesQuerySchema,
  AnalyticsBrowsersQuerySchema,
  AnalyticsExportQuerySchema,
} from './analytics.dto';
import type { AuthRequest } from '../../middleware/auth';

export class AnalyticsController {
  private readonly service: AnalyticsService;

  constructor() {
    const redis =
      config.redisEnabled && config.redisUrl
        ? new Redis(config.redisUrl, {
            lazyConnect: true,
            maxRetriesPerRequest: 2,
            connectTimeout: 5000,
            enableOfflineQueue: false,
          })
        : null;
    if (redis) {
      redis.on('error', () => {
        // best-effort: cache falls back to L1-only on Redis failure
      });
    }
    this.service = new AnalyticsService(undefined, redis);
  }

  overview = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = AnalyticsOverviewQuerySchema.parse(req.query);
      const data = await this.service.getOverview(parsed.range);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  topPages = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = AnalyticsTopPagesQuerySchema.parse(req.query);
      const data = await this.service.getTopPages(parsed.range, parsed.limit);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  topReferrers = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = AnalyticsTopReferrersQuerySchema.parse(req.query);
      const data = await this.service.getTopReferrers(parsed.range, parsed.limit);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  topCountries = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = AnalyticsGeoQuerySchema.parse(req.query);
      const data = await this.service.getTopCountries(parsed.range, parsed.limit);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  topCities = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = AnalyticsGeoQuerySchema.parse(req.query);
      const data = await this.service.getTopCities(parsed.range, parsed.limit);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  deviceBreakdown = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = AnalyticsDevicesQuerySchema.parse(req.query);
      const data = await this.service.getDeviceBreakdown(parsed.range);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  topBrowsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = AnalyticsBrowsersQuerySchema.parse(req.query);
      const data = await this.service.getTopBrowsers(parsed.range, parsed.limit);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  topOS = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = AnalyticsBrowsersQuerySchema.parse(req.query);
      const data = await this.service.getTopOS(parsed.range, parsed.limit);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  export = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = AnalyticsExportQuerySchema.parse(req.query);
      const overview = await this.service.getOverview(parsed.range);

      if (parsed.format === 'csv') {
        const csv = this.toCsv(overview);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="analytics-${parsed.range}d-${new Date().toISOString().slice(0, 10)}.csv"`
        );
        res.send(csv);
        return;
      }

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="analytics-${parsed.range}d-${new Date().toISOString().slice(0, 10)}.json"`
      );
      res.json({ success: true, data: overview });
    } catch (err) {
      next(err);
    }
  };

  private toCsv(overview: any): string {
    const rows: string[][] = [
      ['Metric', 'Value'],
      ['Generated At', overview.generatedAt],
      ['Page Views', overview.kpis.pageViews.toString()],
      ['Unique Visitors', overview.kpis.uniqueVisitors.toString()],
      ['Engagement Rate', `${overview.kpis.engagementRate}%`],
      ['Project Views', overview.kpis.projectViews.toString()],
      ['Blog Views', overview.kpis.blogViews.toString()],
      ['', ''],
      ['Top Pages', '', 'Count', 'Percentage'],
      ...overview.topPages.map((p: any) => ['', p.name, p.count.toString(), `${p.percentage}%`]),
      ['', ''],
      ['Top Referrers', '', 'Count', 'Percentage'],
      ...overview.topReferrers.map((p: any) => ['', p.name, p.count.toString(), `${p.percentage}%`]),
      ['', ''],
      ['Top Countries', '', 'Count', 'Percentage'],
      ...overview.topCountries.map((p: any) => ['', p.name, p.count.toString(), `${p.percentage}%`]),
      ['', ''],
      ['Device Breakdown', '', 'Count'],
      ['', 'Desktop', overview.deviceBreakdown.desktop.toString()],
      ['', 'Mobile', overview.deviceBreakdown.mobile.toString()],
      ['', 'Tablet', overview.deviceBreakdown.tablet.toString()],
      ['', ''],
      ['Top Browsers', '', 'Count', 'Percentage'],
      ...overview.topBrowsers.map((p: any) => ['', p.name, p.count.toString(), `${p.percentage}%`]),
      ['', ''],
      ['Top OS', '', 'Count', 'Percentage'],
      ...overview.topOS.map((p: any) => ['', p.name, p.count.toString(), `${p.percentage}%`]),
    ];

    return rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
  }
}