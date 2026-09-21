import { Router } from 'express';
import { AuditController } from './audit.controller';

const router = Router();
const controller = new AuditController();

/**
 * @swagger
 * /api/v1/audit-logs:
 *   get:
 *     summary: listAuditLogs
 *     operationId: getAuditLogs
 *     tags: [audit-logs]
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
 *     summary: createAuditEvent
 *     operationId: postAuditLogsLog
 *     tags: [audit-logs]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/log', controller.log);

export default router;
