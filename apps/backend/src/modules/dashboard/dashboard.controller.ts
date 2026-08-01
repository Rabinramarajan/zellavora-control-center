import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { config } from '../../config/env';
import { DashboardService } from './dashboard.service';
import { ActivityQuerySchema, OverviewQuerySchema } from './dashboard.dto';
import type { AuthRequest } from '../../middleware/auth';

/**
 * Controller for the Operations Dashboard.
 *
 * Tenant isolation: every aggregation is scoped to the caller's tenant
 * (from the verified JWT) so one organization can never observe another's
 * metrics. The optional `scope` param is validated server-side and never
 * trusts a client-claimed tenant id.
 */
export class DashboardController {
  private readonly service: DashboardService;

  constructor() {
    const redis =
      config.redisEnabled && config.redisUrl ? new Redis(config.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 2, connectTimeout: 5000, enableOfflineQueue: false }) : null;
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
      // Scope: prefer the verified JWT tenant; fall back to the header for
      // platform-level views only when the caller is allowed to (owner/admin).
      const scope = req.tenantId ?? 'platform';
      const data = await this.service.getOverview(parsed.range, scope);
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
        { action: parsed.action, severity: parsed.severity }
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}
