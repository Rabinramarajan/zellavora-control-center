import { Router } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth';
import { prisma } from '../infrastructure/prisma';
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
 * /api/v1/admin/audit-logs/search:
 *   get:
 *     summary: getAuditLogSearchTemplate
 *     operationId: getAdminAuditLogsSearch
 *     tags: [administrationAuditLogs]
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
 *     operationId: postAdminAuditLogsSearch
 *     tags: [administrationAuditLogs]
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
 * /api/v1/admin/audit-logs/details:
 *   post:
 *     summary: loadAuditLogDetails
 *     operationId: postAdminAuditLogsDetails
 *     tags: [administrationAuditLogs]
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

router.get(['/audit-logs/search', '/auditlog/search'], authenticate, async (req, res, next) => {
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
        pageSize: Number(req.query.pageSize) || 10,
        pageNumber: Number(req.query.pageNumber) || 1,
      })
    );
  } catch (error) {
    next(error);
  }
});

router.post(['/audit-logs/search', '/auditlog/search'], authenticate, async (req, res, next) => {
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

router.post(
  ['/audit-logs/details', '/auditlog/LoadAuditLogDetails'],
  authenticate,
  async (req, res, next) => {
    try {
      const id = req.body.data;
      const log = mockAuditLogs.find((l) => l.auditLogId === id);
      res.json(wrapResponse(log || mockAuditLogs[0]));
    } catch (error) {
      next(error);
    }
  }
);

type AuditSeverity = 'info' | 'warn' | 'critical';

// The admin UI only distinguishes three levels; stored severities are finer-grained.
const toUiSeverity = (severity: string): AuditSeverity => {
  if (severity === 'critical' || severity === 'error') return 'critical';
  if (severity === 'warning' || severity === 'warn') return 'warn';
  return 'info';
};

async function loadAuditRecords(req: AuthRequest) {
  const limit = Math.min(
    Math.max(parseInt((req.query.limit as string) || '200', 10) || 200, 1),
    1000
  );
  const rows = await prisma.auditLog.findMany({
    where: req.tenantId ? { organizationId: req.tenantId } : {},
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { actor: { select: { fullName: true, displayName: true, email: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    actorId: row.actorId,
    actorName: row.actor?.displayName || row.actor?.fullName || row.actor?.email || 'System',
    action: row.action,
    severity: toUiSeverity(row.severity),
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
  }));
}

const csvCell = (value: string | null) => `"${(value ?? '').replace(/"/g, '""')}"`;

/**
 * @swagger
 * /api/v1/admin/audit:
 *   get:
 *     summary: listAdminAuditRecords
 *     operationId: getAdminAudit
 *     tags: [administrationAuditLogs]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Audit records for the caller's organization, newest first
 */
router.get('/audit', authenticate, async (req: AuthRequest, res) => {
  res.json(await loadAuditRecords(req));
});

/**
 * @swagger
 * /api/v1/admin/audit/export:
 *   get:
 *     summary: exportAdminAuditRecords
 *     operationId: getAdminAuditExport
 *     tags: [administrationAuditLogs]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Audit records as CSV
 */
router.get('/audit/export', authenticate, async (req: AuthRequest, res) => {
  const records = await loadAuditRecords(req);
  const header = 'id,actorName,action,severity,ipAddress,createdAt';
  const lines = records.map((r) =>
    [r.id, r.actorName, r.action, r.severity, r.ipAddress, r.createdAt].map(csvCell).join(',')
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="audit_logs.csv"');
  res.send([header, ...lines].join('\n'));
});

export default router;
