import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { wrapResponse } from './admin-helpers';

const router = Router();

const mockAuditLogs = [
  {
    auditLogId: 1,
    tableName: 'users',
    primaryKey: 1,
    changeModeId: 1,
    changeModeValue: 'UPDATE',
    machineIpAddress: '127.0.0.1',
    changeModeDescription: 'User record updated',
    changedBy: 'admin@zellavora.com',
    changedDate: '2026-07-27T10:00:00Z',
    lstAuditLogDetail: [
      {
        auditLogDetailId: 1,
        auditLogId: 1,
        columnName: 'full_name',
        oldValue: 'Admin',
        newValue: 'Admin User',
        changedBy: 'admin@zellavora.com',
        changedDate: '2026-07-27T10:00:00Z',
      },
    ],
  },
];

/**
 * @swagger
 * /api/v1/admin/auditlog/search:
 *   get:
 *     summary: searchAuditLogs
 *     tags: [audit]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                 infoMessage:
 *                   type: object
 *                   properties:
 *                     msgID: { type: integer }
 *                     msgType: { type: string }
 *                     msgDescription: { type: string }
 *                 errorMessage:
 *                   type: array
 *                   items: { type: string }
 *                 hasError:
 *                   type: boolean
 *   post:
 *     summary: searchAuditLogs
 *     tags: [audit]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pageSize:
 *                 type: integer
 *                 default: 10
 *               pageNumber:
 *                 type: integer
 *                 default: 1
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     plstAuditLogDetail:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           tableName: { type: string }
 *                           primaryKey: { type: string }
 *                           changedMode: { type: string }
 *                           logCount: { type: string }
 *                           changedBy: { type: string }
 *                           auditLogId: { type: integer }
 *                           changedDate: { type: string, format: date-time }
 *                     totalCount: { type: integer }
 *                     pageSize: { type: integer }
 *                     pageNumber: { type: integer }
 *                 infoMessage:
 *                   type: object
 *                   properties:
 *                     msgID: { type: integer }
 *                     msgType: { type: string }
 *                     msgDescription: { type: string }
 *                 errorMessage:
 *                   type: array
 *                   items: { type: string }
 *                 hasError:
 *                   type: boolean
 * /api/v1/admin/auditlog/LoadAuditLogDetails:
 *   post:
 *     summary: loadAuditLogDetails
 *     tags: [audit]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [data]
 *             properties:
 *               data:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       200:
 *         description: Log details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     auditLogId: { type: integer }
 *                     tableName: { type: string }
 *                     primaryKey: { type: integer }
 *                     changeModeId: { type: integer }
 *                     changeModeValue: { type: string }
 *                     machineIpAddress: { type: string }
 *                     changeModeDescription: { type: string }
 *                     changedBy: { type: string }
 *                     changedDate: { type: string, format: date-time }
 *                     lstAuditLogDetail:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           auditLogDetailId: { type: integer }
 *                           auditLogId: { type: integer }
 *                           columnName: { type: string }
 *                           oldValue: { type: string }
 *                           newValue: { type: string }
 *                           changedBy: { type: string }
 *                           changedDate: { type: string, format: date-time }
 *                 infoMessage:
 *                   type: object
 *                   properties:
 *                     msgID: { type: integer }
 *                     msgType: { type: string }
 *                     msgDescription: { type: string }
 *                 errorMessage:
 *                   type: array
 *                   items: { type: string }
 *                 hasError:
 *                   type: boolean
 */

router.get('/auditlog/search', authenticate, async (req, res, next) => {
  try {
    res.json(wrapResponse({}));
  } catch (error) {
    next(error);
  }
});

router.post('/auditlog/search', authenticate, async (req, res, next) => {
  try {
    const plstAuditLogDetail = mockAuditLogs.map((log) => ({
      tableName: log.tableName,
      primaryKey: String(log.primaryKey),
      changedMode: log.changeModeValue,
      logCount: String(log.lstAuditLogDetail.length),
      changedBy: log.changedBy,
      auditLogId: log.auditLogId,
      changedDate: log.changedDate,
    }));
    res.json(
      wrapResponse({
        plstAuditLogDetail,
        totalCount: plstAuditLogDetail.length,
        pageSize: req.body.pageSize || 10,
        pageNumber: req.body.pageNumber || 1,
      })
    );
  } catch (error) {
    next(error);
  }
});

router.post('/auditlog/LoadAuditLogDetails', authenticate, async (req, res, next) => {
  try {
    const id = req.body.data;
    const log = mockAuditLogs.find((l) => l.auditLogId === id);
    res.json(wrapResponse(log || mockAuditLogs[0]));
  } catch (error) {
    next(error);
  }
});

export default router;
