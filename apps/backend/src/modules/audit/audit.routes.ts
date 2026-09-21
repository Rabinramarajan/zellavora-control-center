import { Router } from 'express';
import { AuditController } from './audit.controller';

const router = Router();
const controller = new AuditController();

/**
 * @swagger
 * /api/v1/audit-logs:
 *   get:
 *     summary: List audit logs
 *     operationId: getAuditLogs
 *     tags: [Audit Logs]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.get('/', controller.list);
/**
 * @swagger
 * /api/v1/audit-logs/log:
 *   post:
 *     summary: Create audit event
 *     operationId: postAuditLogsLog
 *     tags: [Audit Logs]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/log', controller.log);

export default router;
