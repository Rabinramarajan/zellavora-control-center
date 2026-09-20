import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { logger } from '../../infrastructure/logger';
import { TimesheetsService } from './timesheets.service';
import { buildExportModel, toCsv, toPrintableHtml } from './timesheets.export';
import {
  BulkUpsertEntriesSchema,
  ExportQuerySchema,
  GetTimesheetQuerySchema,
  ListTimesheetsQuerySchema,
  RejectTimesheetSchema,
  SummaryQuerySchema,
  UpdateEntrySchema,
} from './timesheets.dto';

export class TimesheetsController {
  private readonly service = new TimesheetsService();

  /**
   * The tenant always comes from the verified token, never from the request.
   * `employeeId` defaults to the caller, so the common case needs no client
   * state at all.
   */
  private context(req: AuthRequest): { organizationId: string; actorUserId: string } {
    if (!req.tenantId || !req.userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }
    return { organizationId: req.tenantId, actorUserId: req.userId };
  }

  async getForPeriod(req: AuthRequest, res: Response) {
    try {
      const { organizationId, actorUserId } = this.context(req);
      const dto = GetTimesheetQuerySchema.parse(req.query);
      const sheet = await this.service.getOrCreateForPeriod(
        dto.employeeId ?? actorUserId,
        dto.period,
        organizationId,
        actorUserId
      );
      res.json({ success: true, data: sheet });
    } catch (error) {
      logger.error('Get timesheet failed', error);
      throw error;
    }
  }

  async list(req: AuthRequest, res: Response) {
    try {
      const { organizationId } = this.context(req);
      const dto = ListTimesheetsQuerySchema.parse(req.query);
      const sheets = await this.service.list(organizationId, dto);
      res.json({ success: true, data: sheets });
    } catch (error) {
      logger.error('List timesheets failed', error);
      throw error;
    }
  }

  async getById(req: AuthRequest, res: Response) {
    try {
      const { organizationId } = this.context(req);
      const sheet = await this.service.getById(req.params.id, organizationId);
      res.json({ success: true, data: sheet });
    } catch (error) {
      logger.error('Get timesheet by id failed', error);
      throw error;
    }
  }

  async bulkUpsertEntries(req: AuthRequest, res: Response) {
    try {
      const { organizationId, actorUserId } = this.context(req);
      const dto = BulkUpsertEntriesSchema.parse(req.body);
      const sheet = await this.service.bulkUpsertEntries(
        req.params.id,
        dto,
        organizationId,
        actorUserId
      );
      res.json({ success: true, data: sheet });
    } catch (error) {
      logger.error('Bulk upsert timesheet entries failed', error);
      throw error;
    }
  }

  async updateEntry(req: AuthRequest, res: Response) {
    try {
      const { organizationId, actorUserId } = this.context(req);
      const dto = UpdateEntrySchema.parse(req.body);
      const sheet = await this.service.updateEntry(
        req.params.id,
        req.params.entryId,
        dto,
        organizationId,
        actorUserId
      );
      res.json({ success: true, data: sheet });
    } catch (error) {
      logger.error('Update timesheet entry failed', error);
      throw error;
    }
  }

  async submit(req: AuthRequest, res: Response) {
    try {
      const { organizationId, actorUserId } = this.context(req);
      const sheet = await this.service.submit(req.params.id, organizationId, actorUserId);
      res.json({ success: true, data: sheet });
    } catch (error) {
      logger.error('Submit timesheet failed', error);
      throw error;
    }
  }

  async approve(req: AuthRequest, res: Response) {
    try {
      const { organizationId, actorUserId } = this.context(req);
      const sheet = await this.service.approve(req.params.id, organizationId, actorUserId);
      res.json({ success: true, data: sheet });
    } catch (error) {
      logger.error('Approve timesheet failed', error);
      throw error;
    }
  }

  async reject(req: AuthRequest, res: Response) {
    try {
      const { organizationId, actorUserId } = this.context(req);
      const dto = RejectTimesheetSchema.parse(req.body);
      const sheet = await this.service.reject(req.params.id, dto, organizationId, actorUserId);
      res.json({ success: true, data: sheet });
    } catch (error) {
      logger.error('Reject timesheet failed', error);
      throw error;
    }
  }

  async export(req: AuthRequest, res: Response) {
    try {
      const { organizationId } = this.context(req);
      const { format } = ExportQuerySchema.parse(req.query);
      const sheet = await this.service.getById(req.params.id, organizationId);
      const model = buildExportModel(sheet);
      const filename = `timesheet-${model.employee.name.replace(/\s+/g, '-').toLowerCase()}-${model.period}`;

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        res.send(toCsv(model));
        return;
      }

      if (format === 'html') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', `inline; filename="${filename}.html"`);
        res.send(toPrintableHtml(model));
        return;
      }

      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      res.json({ success: true, data: model });
    } catch (error) {
      logger.error('Export timesheet failed', error);
      throw error;
    }
  }

  async summary(req: AuthRequest, res: Response) {
    try {
      const { organizationId, actorUserId } = this.context(req);
      const dto = SummaryQuerySchema.parse(req.query);
      const summary = await this.service.summary(organizationId, dto, actorUserId);
      res.json({ success: true, data: summary });
    } catch (error) {
      logger.error('Timesheet summary failed', error);
      throw error;
    }
  }
}
