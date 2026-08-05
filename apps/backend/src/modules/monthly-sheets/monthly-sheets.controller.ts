import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { MonthlySheetsService } from './monthly-sheets.service';
import {
  CreateMonthlySheetSchema,
  UpdateMonthlySheetSchema,
  ApproveMonthlySheetSchema,
  MarkAsPaidSchema,
  MonthlySheetQuerySchema,
} from './monthly-sheets.dto';
import { logger } from '../../infrastructure/logger';

export class MonthlySheetsController {
  private service = new MonthlySheetsService();

  async create(req: AuthRequest, res: Response) {
    try {
      const dto = CreateMonthlySheetSchema.parse(req.body);
      const sheet = await this.service.create(dto, req.tenantId!, req.userId!);
      res.status(201).json({ success: true, data: sheet });
    } catch (error) {
      logger.error('Create monthly sheet failed', error);
      throw error;
    }
  }

  async list(req: AuthRequest, res: Response) {
    try {
      const dto = MonthlySheetQuerySchema.parse(req.query);
      const sheets = await this.service.list(req.tenantId!, dto);
      res.json({ success: true, data: sheets });
    } catch (error) {
      logger.error('List monthly sheets failed', error);
      throw error;
    }
  }

  async getById(req: AuthRequest, res: Response) {
    try {
      const sheet = await this.service.getById(req.params.id, req.tenantId!);
      res.json({ success: true, data: sheet });
    } catch (error) {
      logger.error('Get monthly sheet failed', error);
      throw error;
    }
  }

  async update(req: AuthRequest, res: Response) {
    try {
      const dto = UpdateMonthlySheetSchema.parse(req.body);
      const sheet = await this.service.update(req.params.id, dto, req.tenantId!, req.userId!);
      res.json({ success: true, data: sheet });
    } catch (error) {
      logger.error('Update monthly sheet failed', error);
      throw error;
    }
  }

  async submit(req: AuthRequest, res: Response) {
    try {
      const sheet = await this.service.submitForApproval(req.params.id, req.tenantId!, req.userId!);
      res.json({ success: true, data: sheet });
    } catch (error) {
      logger.error('Submit monthly sheet failed', error);
      throw error;
    }
  }

  async approve(req: AuthRequest, res: Response) {
    try {
      const dto = ApproveMonthlySheetSchema.parse(req.body);
      const sheet = await this.service.approve(req.params.id, dto, req.tenantId!, req.userId!);
      res.json({ success: true, data: sheet });
    } catch (error) {
      logger.error('Approve monthly sheet failed', error);
      throw error;
    }
  }

  async markAsPaid(req: AuthRequest, res: Response) {
    try {
      const dto = MarkAsPaidSchema.parse(req.body);
      const sheet = await this.service.markAsPaid(req.params.id, dto, req.tenantId!, req.userId!);
      res.json({ success: true, data: sheet });
    } catch (error) {
      logger.error('Mark monthly sheet as paid failed', error);
      throw error;
    }
  }

  async delete(req: AuthRequest, res: Response) {
    try {
      const result = await this.service.delete(req.params.id, req.tenantId!);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Delete monthly sheet failed', error);
      throw error;
    }
  }
}
