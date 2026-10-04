import { Router } from 'express';
import { AuditController } from './audit.controller';
import { authenticate, requirePermission } from '../../middleware/auth';

const router = Router();
const controller = new AuditController();

/**
 * @swagger
 * /api/v1/audit-logs:
 *   get:
 *     summary: searchAuditLogs
 *     operationId: searchAuditLogs
 *     tags: [operations, auditLogs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: size, schema: { type: integer, default: 25, maximum: 100 } }
 *       - { in: query, name: sort, schema: { type: string, default: "createdAt,desc" } }
 *       - { in: query, name: dateFrom, schema: { type: string, format: date-time } }
 *       - { in: query, name: dateTo, schema: { type: string, format: date-time } }
 *       - { in: query, name: user, schema: { type: string } }
 *       - { in: query, name: module, schema: { type: string } }
 *       - { in: query, name: action, schema: { type: string } }
 *       - { in: query, name: resourceType, schema: { type: string } }
 *       - { in: query, name: resourceId, schema: { type: string } }
 *       - { in: query, name: status, schema: { type: string } }
 *       - { in: query, name: correlationId, schema: { type: string } }
 *       - { in: query, name: searchText, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Paginated search results
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires AUDIT_LOG_VIEW or system:audit:read
 */
router.get(
  '/',
  authenticate,
  requirePermission('AUDIT_LOG_VIEW', 'system:audit:read', 'system:rbac:read'),
  controller.search
);

/**
 * @swagger
 * /api/v1/audit-logs/filter-options:
 *   get:
 *     summary: getAuditFilterOptions
 *     operationId: getAuditFilterOptions
 *     tags: [operations, auditLogs]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Distinct options for search filters
 */
router.get(
  '/filter-options',
  authenticate,
  requirePermission('AUDIT_LOG_VIEW', 'system:audit:read'),
  controller.getFilterOptions
);

/**
 * @swagger
 * /api/v1/audit-logs/export:
 *   get:
 *     summary: exportAuditLogsCsv
 *     operationId: exportAuditLogsCsv
 *     tags: [operations, auditLogs]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       403:
 *         description: Forbidden - Requires AUDIT_LOG_EXPORT or system:audit:export
 */
router.get(
  '/export',
  authenticate,
  requirePermission('AUDIT_LOG_EXPORT', 'system:audit:export'),
  controller.exportCsv
);

/**
 * @swagger
 * /api/v1/audit-logs/{id}:
 *   get:
 *     summary: getAuditLogDetails
 *     operationId: getAuditLogDetails
 *     tags: [operations, auditLogs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Audit log details including diff changes
 *       404:
 *         description: Not found
 */
router.get(
  '/:id',
  authenticate,
  requirePermission('AUDIT_LOG_VIEW', 'system:audit:read'),
  controller.getById
);

/** Internal logging endpoint */
router.post('/log', authenticate, controller.log);

export default router;
