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
 *   post:
 *     summary: searchAuditLogs
 *     tags: [audit]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Search results
 * /api/v1/admin/auditlog/LoadAuditLogDetails:
 *   post:
 *     summary: loadAuditLogDetails
 *     tags: [audit]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Log details
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
