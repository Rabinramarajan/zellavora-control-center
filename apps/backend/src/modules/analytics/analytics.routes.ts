import { Router, RequestHandler, Response, NextFunction } from 'express';
import { AnalyticsController } from './analytics.controller';
import { authenticate, requirePermission } from '../../middleware/auth';

const router = Router();
const controller = new AnalyticsController();

/**
 * Express 4 does not forward a rejected promise to the error middleware, so
 * every async handler is wrapped. Without this an `AppError` thrown inside a
 * controller would hang the request instead of returning its status code.
 */
const handle =
  (fn: (req: AuthRequest, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next: NextFunction) => {
    Promise.resolve(fn(req as AuthRequest, res)).catch(next);
  };

router.use(authenticate);

/**
 * @swagger
 * /api/v1/analytics/overview:
 *   get:
 *     summary: getAnalyticsOverview
 *     operationId: getAnalyticsOverview
 *     description: Aggregated KPIs, trends, top pages, referrers, geographic data, device breakdown, and browser/OS stats.
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [7, 30, 90]
 *           default: 30
 *         description: Look-back window in days
 *     responses:
 *       200:
 *         description: Analytics overview payload
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Insufficient permission
 */
router.get(
  '/overview',
  requirePermission('analytics:read'),
  handle((req, res) => controller.overview(req, res))
);

/**
 * @swagger
 * /api/v1/analytics/top-pages:
 *   get:
 *     summary: getAnalyticsTopPages
 *     operationId: getAnalyticsTopPages
 *     description: Top pages by view count.
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [7, 30, 90]
 *           default: 30
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Top pages list
 */
router.get(
  '/top-pages',
  requirePermission('analytics:read'),
  handle((req, res) => controller.topPages(req, res))
);

/**
 * @swagger
 * /api/v1/analytics/top-referrers:
 *   get:
 *     summary: getAnalyticsTopReferrers
 *     operationId: getAnalyticsTopReferrers
 *     description: Top referrers (traffic sources) by visit count.
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [7, 30, 90]
 *           default: 30
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Top referrers list
 */
router.get(
  '/top-referrers',
  requirePermission('analytics:read'),
  handle((req, res) => controller.topReferrers(req, res))
);

/**
 * @swagger
 * /api/v1/analytics/top-countries:
 *   get:
 *     summary: getAnalyticsTopCountries
 *     operationId: getAnalyticsTopCountries
 *     description: Top countries by visit count.
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [7, 30, 90]
 *           default: 30
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Top countries list
 */
router.get(
  '/top-countries',
  requirePermission('analytics:read'),
  handle((req, res) => controller.topCountries(req, res))
);

/**
 * @swagger
 * /api/v1/analytics/top-cities:
 *   get:
 *     summary: getAnalyticsTopCities
 *     operationId: getAnalyticsTopCities
 *     description: Top cities by visit count.
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [7, 30, 90]
 *           default: 30
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Top cities list
 */
router.get(
  '/top-cities',
  requirePermission('analytics:read'),
  handle((req, res) => controller.topCities(req, res))
);

/**
 * @swagger
 * /api/v1/analytics/device-breakdown:
 *   get:
 *     summary: getAnalyticsDeviceBreakdown
 *     operationId: getAnalyticsDeviceBreakdown
 *     description: Device type breakdown (desktop, mobile, tablet).
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [7, 30, 90]
 *           default: 30
 *     responses:
 *       200:
 *         description: Device breakdown
 */
router.get(
  '/device-breakdown',
  requirePermission('analytics:read'),
  handle((req, res) => controller.deviceBreakdown(req, res))
);

/**
 * @swagger
 * /api/v1/analytics/top-browsers:
 *   get:
 *     summary: getAnalyticsTopBrowsers
 *     operationId: getAnalyticsTopBrowsers
 *     description: Top browsers by visit count.
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [7, 30, 90]
 *           default: 30
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Top browsers list
 */
router.get(
  '/top-browsers',
  requirePermission('analytics:read'),
  handle((req, res) => controller.topBrowsers(req, res))
);

/**
 * @swagger
 * /api/v1/analytics/top-os:
 *   get:
 *     summary: getAnalyticsTopOS
 *     operationId: getAnalyticsTopOS
 *     description: Top operating systems by visit count.
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [7, 30, 90]
 *           default: 30
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Top OS list
 */
router.get(
  '/top-os',
  requirePermission('analytics:read'),
  handle((req, res) => controller.topOS(req, res))
);

/**
 * @swagger
 * /api/v1/analytics/export:
 *   get:
 *     summary: exportAnalytics
 *     operationId: exportAnalytics
 *     description: Export analytics data as JSON or CSV.
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [7, 30, 90]
 *           default: 30
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *     responses:
 *       200:
 *         description: Exported analytics data
 */
router.get(
  '/export',
  requirePermission('analytics:read'),
  handle((req, res) => controller.export(req, res))
);

export default router;
