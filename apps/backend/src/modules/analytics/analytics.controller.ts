import { Response } from 'express';
import Redis from 'ioredis';
import { config } from '../../config/env';
import { AppError } from '../../middleware/error';
import type { AuthRequest } from '../../middleware/auth';
import { AnalyticsService, type AnalyticsOverview } from './analytics.service';
import type { Dimension } from './analytics.repository';
import {
  AnalyticsDevicesQuerySchema,
  AnalyticsExportQuerySchema,
  AnalyticsOverviewQuerySchema,
  AnalyticsTopQuerySchema,
  TrackEventSchema,
} from './analytics.dto';

/** Analytics is tenant data; a token without an organization cannot read or write it. */
const tenantOf = (req: AuthRequest): string => {
  if (!req.tenantId) {
    throw new AppError('No organization selected', 403, 'TENANT_REQUIRED');
  }
  return req.tenantId;
};

const header = (req: AuthRequest, name: string): string | null => {
  const value = req.headers[name];
  const first = Array.isArray(value) ? value[0] : value;
  return first && first !== 'XX' ? decodeURIComponent(first) : null;
};

const csvCell = (value: string | number): string => {
  const text = String(value);
  // Leading =,+,-,@ would run as a formula when the file is opened in a spreadsheet.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

export class AnalyticsController {
  private readonly service: AnalyticsService;

  constructor(service?: AnalyticsService) {
    if (service) {
      this.service = service;
      return;
    }
    const redis =
      config.redisEnabled && config.redisUrl
        ? new Redis(config.redisUrl, {
            lazyConnect: true,
            maxRetriesPerRequest: 2,
            connectTimeout: 5000,
            enableOfflineQueue: false,
          })
        : null;
    redis?.on('error', () => {
      // best-effort: cache falls back to L1-only on Redis failure
    });
    this.service = new AnalyticsService(undefined, redis);
  }

  overview = async (req: AuthRequest, res: Response) => {
    const { range } = AnalyticsOverviewQuerySchema.parse(req.query);
    res.json({ success: true, data: await this.service.getOverview(tenantOf(req), range) });
  };

  top = (dimension: Dimension) => async (req: AuthRequest, res: Response) => {
    const { range, limit } = AnalyticsTopQuerySchema.parse(req.query);
    const data = await this.service.getTop(tenantOf(req), range, dimension, limit);
    res.json({ success: true, data });
  };

  devices = async (req: AuthRequest, res: Response) => {
    const { range } = AnalyticsDevicesQuerySchema.parse(req.query);
    res.json({ success: true, data: await this.service.getDeviceBreakdown(tenantOf(req), range) });
  };

  track = async (req: AuthRequest, res: Response) => {
    const dto = TrackEventSchema.parse(req.body);
    await this.service.track(dto, {
      organizationId: tenantOf(req),
      userId: req.userId ?? null,
      userAgent: header(req, 'user-agent'),
      country: header(req, 'x-vercel-ip-country') ?? header(req, 'cf-ipcountry'),
      city: header(req, 'x-vercel-ip-city'),
    });
    res.status(202).json({ success: true });
  };

  export = async (req: AuthRequest, res: Response) => {
    const { range, format } = AnalyticsExportQuerySchema.parse(req.query);
    const overview = await this.service.getOverview(tenantOf(req), range);
    const filename = `analytics-${range}d-${new Date().toISOString().slice(0, 10)}`;

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(this.toCsv(overview));
      return;
    }
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
    res.json({ success: true, data: overview });
  };

  private toCsv(o: AnalyticsOverview): string {
    const k = o.kpis;
    const section = (
      title: string,
      items: Array<{ name: string; count: number; percentage: number }>
    ) => [
      [],
      [title, 'Page Views', 'Share %'],
      ...items.map((i) => [i.name, i.count, i.percentage]),
    ];
    const rows: Array<Array<string | number>> = [
      ['Analytics report', `Last ${o.range.days} days`],
      ['From', o.range.from.slice(0, 10)],
      ['To', o.range.to.slice(0, 10)],
      ['Generated At', o.generatedAt],
      [],
      ['Metric', 'Value', 'Previous Period', 'Change %'],
      ['Page Views', k.pageViews.value, k.pageViews.previous, k.pageViews.change ?? ''],
      [
        'Unique Visitors',
        k.uniqueVisitors.value,
        k.uniqueVisitors.previous,
        k.uniqueVisitors.change ?? '',
      ],
      ['Sessions', k.sessions.value, k.sessions.previous, k.sessions.change ?? ''],
      [
        'Engagement Rate %',
        k.engagementRate.value,
        k.engagementRate.previous,
        k.engagementRate.change ?? '',
      ],
      [
        'Avg Session (s)',
        k.avgSessionSeconds.value,
        k.avgSessionSeconds.previous,
        k.avgSessionSeconds.change ?? '',
      ],
      [],
      ['Date', 'Page Views', 'Unique Visitors', 'Sessions', 'Engagement Rate %'],
      ...o.daily.map((d) => [d.date, d.pageViews, d.uniqueVisitors, d.sessions, d.engagementRate]),
      ...section('Top Pages', o.topPages),
      ...section('Top Referrers', o.topReferrers),
      ...section('Top Countries', o.topCountries),
      ...section('Top Cities', o.topCities),
      ...section('Top Browsers', o.topBrowsers),
      ...section('Top Operating Systems', o.topOS),
      [],
      ['Device', 'Page Views'],
      ['Desktop', o.deviceBreakdown.desktop],
      ['Mobile', o.deviceBreakdown.mobile],
      ['Tablet', o.deviceBreakdown.tablet],
    ];
    // BOM so Excel opens the UTF-8 file with the right encoding.
    return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  }
}
