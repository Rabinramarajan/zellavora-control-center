import { Router } from 'express';
import { SystemHealthController } from './health.controller';
import { authenticate, requirePermission } from '../../../middleware/auth';

const router = Router();
const controller = new SystemHealthController();

/**
 * Public/Infra Health Probe Endpoints
 */
/**
 * @swagger
 * /api/v1/operations/health/liveness:
 *   get:
 *     summary: getLivenessStatus
 *     operationId: getLivenessStatus
 *     tags: [operations, health]
 *     security: []
 *     responses:
 *       200:
 *         description: Application process is alive
 */
router.get('/liveness', controller.getLiveness);

/**
 * @swagger
 * /api/v1/operations/health/readiness:
 *   get:
 *     summary: getReadinessStatus
 *     operationId: getReadinessStatus
 *     tags: [operations, health]
 *     security: []
 *     responses:
 *       200:
 *         description: Application is ready to accept traffic
 *       503:
 *         description: Application dependencies are unavailable
 */
router.get('/readiness', controller.getReadiness);

/**
 * Authenticated & RBAC Protected Dashboard Endpoints
 */
/**
 * @swagger
 * /api/v1/operations/health:
 *   get:
 *     summary: getOperationsHealthDashboard
 *     operationId: getOperationsHealthDashboard
 *     tags: [operations, health]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: System health status dashboard
 *       403:
 *         description: Forbidden - Requires OPERATIONS_SYSTEM_HEALTH_VIEW or system:rbac:read
 */
router.get(
  '/',
  authenticate,
  requirePermission('OPERATIONS_SYSTEM_HEALTH_VIEW', 'system:rbac:read', 'system:audit:read'),
  controller.getDashboard
);

/**
 * @swagger
 * /api/v1/operations/health/services:
 *   get:
 *     summary: getOperationsServicesHealth
 *     operationId: getOperationsServicesHealth
 *     tags: [operations, health]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of service health items
 */
router.get(
  '/services',
  authenticate,
  requirePermission('OPERATIONS_SYSTEM_HEALTH_VIEW', 'system:rbac:read', 'system:audit:read'),
  controller.getServices
);

/**
 * @swagger
 * /api/v1/operations/health/services/{serviceId}:
 *   get:
 *     summary: getOperationsServiceHealthById
 *     operationId: getOperationsServiceHealthById
 *     tags: [operations, health]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { in: path, name: serviceId, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Service health details
 *       404:
 *         description: Service not found
 */
router.get(
  '/services/:serviceId',
  authenticate,
  requirePermission('OPERATIONS_SYSTEM_HEALTH_VIEW', 'system:rbac:read', 'system:audit:read'),
  controller.getServiceById
);

export default router;
