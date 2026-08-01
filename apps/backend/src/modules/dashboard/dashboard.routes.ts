import { Router } from 'express';
import { DashboardController } from './dashboard.controller';
import { authenticate, requirePermission } from '../../middleware/auth';

const router = Router();
const controller = new DashboardController();

/**
 * @swagger
 * /api/v1/dashboard/overview:
 *   get:
 *     summary: operationsDashboardOverview
 *     description: Aggregated KPIs, trends, recent activity and plan distribution for the caller's tenant.
 *     tags: [dashboard]
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
 *         description: Dashboard overview payload
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Insufficient permission
 */
router.get(
  '/overview',
  authenticate,
  requirePermission('dashboard:read'),
  controller.overview
);

/**
 * @swagger
 * /api/v1/dashboard/activity:
 *   get:
 *     summary: operationsDashboardActivityFeed
 *     description: Paginated, filterable audit activity feed for the caller's tenant.
 *     tags: [dashboard]
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
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [debug, info, warning, error, critical]
 *     responses:
 *       200:
 *         description: Paginated activity feed
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  '/activity',
  authenticate,
  requirePermission('dashboard:read'),
  controller.activity
);

export default router;
