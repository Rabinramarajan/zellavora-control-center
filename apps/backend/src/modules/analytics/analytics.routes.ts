import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, requirePermission, type AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/async-handler';
import { AnalyticsController } from './analytics.controller';

const router = Router();
const controller = new AnalyticsController();

// One event per navigation; a generous cap still stops a runaway client from flooding the table.
const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthRequest).userId ?? req.ip ?? 'anonymous',
});

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: analytics
 *   description: Tenant-scoped traffic analytics (page views, visitors, sessions, breakdowns).
 */

/**
 * @swagger
 * /api/v1/analytics/events:
 *   post:
 *     summary: trackAnalyticsEvent
 *     operationId: postAnalyticsEvents
 *     description: Record a page view or custom event for the caller's organization and extend its session.
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId, visitorId, path]
 *             properties:
 *               sessionId: { type: string, format: uuid }
 *               visitorId: { type: string }
 *               eventType: { type: string, enum: [pageview, event], default: pageview }
 *               eventName: { type: string }
 *               path: { type: string, example: /dashboard }
 *               title: { type: string }
 *               referrer: { type: string }
 *     responses:
 *       202:
 *         description: Event accepted
 *       429:
 *         description: Too many events
 */
router.post('/events', trackLimiter, asyncHandler(controller.track));

/**
 * @swagger
 * /api/v1/analytics/overview:
 *   get:
 *     summary: getAnalyticsOverview
 *     operationId: getAnalyticsOverview
 *     description: KPIs with previous-period comparison, daily trend and every breakdown for the window.
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema: { type: string, enum: ['7', '30', '90'], default: '30' }
 *     responses:
 *       200:
 *         description: Analytics overview payload
 */
router.get('/overview', requirePermission('analytics:read'), asyncHandler(controller.overview));

/**
 * @swagger
 * /api/v1/analytics/top-pages:
 *   get:
 *     summary: getAnalyticsTopPages
 *     operationId: getAnalyticsTopPages
 *     description: Most viewed pages.
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: range, schema: { type: string, enum: ['7', '30', '90'] } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 50 } }
 *     responses:
 *       200:
 *         description: Top pages
 */
router.get('/top-pages', requirePermission('analytics:read'), asyncHandler(controller.top('page')));

/**
 * @swagger
 * /api/v1/analytics/top-referrers:
 *   get:
 *     summary: getAnalyticsTopReferrers
 *     operationId: getAnalyticsTopReferrers
 *     description: Top traffic sources, grouped by site.
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: range, schema: { type: string, enum: ['7', '30', '90'] } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 50 } }
 *     responses:
 *       200:
 *         description: Top referrers
 */
router.get(
  '/top-referrers',
  requirePermission('analytics:read'),
  asyncHandler(controller.top('referrer'))
);

/**
 * @swagger
 * /api/v1/analytics/top-countries:
 *   get:
 *     summary: getAnalyticsTopCountries
 *     operationId: getAnalyticsTopCountries
 *     description: Page views by country.
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: range, schema: { type: string, enum: ['7', '30', '90'] } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 50 } }
 *     responses:
 *       200:
 *         description: Top countries
 */
router.get(
  '/top-countries',
  requirePermission('analytics:read'),
  asyncHandler(controller.top('country'))
);

/**
 * @swagger
 * /api/v1/analytics/top-cities:
 *   get:
 *     summary: getAnalyticsTopCities
 *     operationId: getAnalyticsTopCities
 *     description: Page views by city.
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: range, schema: { type: string, enum: ['7', '30', '90'] } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 50 } }
 *     responses:
 *       200:
 *         description: Top cities
 */
router.get(
  '/top-cities',
  requirePermission('analytics:read'),
  asyncHandler(controller.top('city'))
);

/**
 * @swagger
 * /api/v1/analytics/device-breakdown:
 *   get:
 *     summary: getAnalyticsDeviceBreakdown
 *     operationId: getAnalyticsDeviceBreakdown
 *     description: Page views by device type.
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: range, schema: { type: string, enum: ['7', '30', '90'] } }
 *     responses:
 *       200:
 *         description: Desktop / mobile / tablet counts
 */
router.get(
  '/device-breakdown',
  requirePermission('analytics:read'),
  asyncHandler(controller.devices)
);

/**
 * @swagger
 * /api/v1/analytics/top-browsers:
 *   get:
 *     summary: getAnalyticsTopBrowsers
 *     operationId: getAnalyticsTopBrowsers
 *     description: Page views by browser.
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: range, schema: { type: string, enum: ['7', '30', '90'] } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 50 } }
 *     responses:
 *       200:
 *         description: Top browsers
 */
router.get(
  '/top-browsers',
  requirePermission('analytics:read'),
  asyncHandler(controller.top('browser'))
);

/**
 * @swagger
 * /api/v1/analytics/top-os:
 *   get:
 *     summary: getAnalyticsTopOs
 *     operationId: getAnalyticsTopOs
 *     description: Page views by operating system.
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: range, schema: { type: string, enum: ['7', '30', '90'] } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 50 } }
 *     responses:
 *       200:
 *         description: Top operating systems
 */
router.get('/top-os', requirePermission('analytics:read'), asyncHandler(controller.top('os')));

/**
 * @swagger
 * /api/v1/analytics/export:
 *   get:
 *     summary: exportAnalytics
 *     operationId: getAnalyticsExport
 *     description: Download the overview for the window as CSV or JSON.
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: range, schema: { type: string, enum: ['7', '30', '90'] } }
 *       - { in: query, name: format, schema: { type: string, enum: [csv, json], default: csv } }
 *     responses:
 *       200:
 *         description: File download
 */
router.get('/export', requirePermission('analytics:export'), asyncHandler(controller.export));

export default router;
