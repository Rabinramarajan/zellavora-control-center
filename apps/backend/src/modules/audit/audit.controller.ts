import { Request, Response, NextFunction } from 'express';
import { AuditService } from './audit.service';
import { AuditSearchQuerySchema, CreateAuditRecordSchema } from './audit.dto';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/error';

export class AuditController {
  private readonly service = new AuditService();

  /**
   * GET /api/v1/operations/audit-logs or /api/v1/audit-logs
   * Server-side paginated & filtered search.
   */
  search = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = AuditSearchQuerySchema.parse(req.query);
      const organizationId = req.tenantId;

      const result = await this.service.searchLogs(organizationId, parsed);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/operations/audit-logs/filter-options
   */
  getFilterOptions = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.tenantId;
      const options = await this.service.getFilterOptions(organizationId);
      res.json(options);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/operations/audit-logs/export
   * Generates CSV matching current active filters.
   */
  exportCsv = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = AuditSearchQuerySchema.parse(req.query);
      const organizationId = req.tenantId;

      const csvContent = await this.service.exportCsv(organizationId, parsed, 1000);

      // Audit the export action itself
      if (organizationId) {
        void this.service.logActivity({
          organizationId,
          actorId: req.userId ?? null,
          module: 'OPERATIONS',
          action: 'EXPORT',
          resourceType: 'AUDIT_LOGS',
          status: 'SUCCESS',
          severity: 'info',
          metadata: { filterCriteria: req.query },
        });
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(csvContent);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/operations/audit-logs/:id
   */
  getById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id || req.params.auditId;
      if (!id) {
        throw new AppError('Audit ID is required', 400, 'BAD_REQUEST');
      }

      const organizationId = req.tenantId;
      const detail = await this.service.getAuditDetail(id, organizationId);
      if (!detail) {
        throw new AppError('Audit log entry not found', 404, 'NOT_FOUND');
      }

      res.json(detail);
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/audit-logs/log (internal/backward compatible)
   */
  log = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = CreateAuditRecordSchema.parse(req.body);
      const log = await this.service.logActivity(data);
      res.json({ success: true, data: log });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Legacy list method preserved for backwards compatibility.
   */
  list = async (req: Request, res: Response, next: NextFunction) => {
    return this.search(req as AuthRequest, res, next);
  };
}
