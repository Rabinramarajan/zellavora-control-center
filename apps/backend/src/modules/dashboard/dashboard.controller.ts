import { Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { config } from '../../config/env';
import { DashboardService } from './dashboard.service';
import { ActivityQuerySchema, OverviewQuerySchema } from './dashboard.dto';
import { resolveScope } from './dashboard.scope';
import type { AuthRequest } from '../../middleware/auth';

/**
 * Controller for the Operations Dashboard.
 *
 * Scoping: every aggregation is narrowed by resolveScope(), which reads the
 * verified JWT only. Organization accounts see their own tenant; INDIVIDUAL
 * accounts share the default tenant, so they are narrowed further to their own
 * user id and receive a personal KPI set instead of the org-wide one.
 */
export class DashboardController {
  private readonly service: DashboardService;

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
    this.service = new DashboardService(undefined, redis);
  }

  overview = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = OverviewQuerySchema.parse(req.query);
      const data = await this.service.getOverview(parsed.range, resolveScope(req));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  activity = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = ActivityQuerySchema.parse(req.query);
      const data = await this.service.getActivityFeed(
        parsed.range,
        parsed.page,
        parsed.pageSize,
        resolveScope(req),
        { action: parsed.action, severity: parsed.severity }
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}
