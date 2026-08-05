import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { DailySheetsService } from './daily-sheets.service';
import {
  CreateDailySheetSchema,
  UpdateDailySheetSchema,
  ApproveDailySheetSchema,
  DailySheetQuerySchema,
} from './daily-sheets.dto';
import { logger } from '../../infrastructure/logger';

export class DailySheetsController {
  private service = new DailySheetsService();

  async create(req: AuthRequest, res: Response) {
    try {
      const dto = CreateDailySheetSchema.parse(req.body);
      const sheet = await this.service.create(dto, req.tenantId!, req.userId!);
      res.status(201).json({ success: true, data: sheet });
    } catch (error) {
      logger.error('Create daily sheet failed', error);
      throw error;
    }
  }

  async list(req: AuthRequest, res: Response) {
    try {
      const dto = DailySheetQuerySchema.parse(req.query);
      const sheets = await this.service.list(req.tenantId!, dto);
      res.json({ success: true, data: sheets });
    } catch (error) {
      logger.error('List daily sheets failed', error);
      throw error;
    }
  }

  async getById(req: AuthRequest, res: Response) {
    try {
      const sheet = await this.service.getById(req.params.id, req.tenantId!);
      res.json({ success: true, data: sheet });
    } catch (error) {
      logger.error('Get daily sheet failed', error);
      throw error;
    }
  }

  async update(req: AuthRequest, res: Response) {
    try {
      const dto = UpdateDailySheetSchema.parse(req.body);
      const sheet = await this.service.update(req.params.id, dto, req.tenantId!, req.userId!);
      res.json({ success: true, data: sheet });
    } catch (error) {
      logger.error('Update daily sheet failed', error);
      throw error;
    }
  }

  async submit(req: AuthRequest, res: Response) {
    try {
      const sheet = await this.service.submitForApproval(req.params.id, req.tenantId!, req.userId!);
      res.json({ success: true, data: sheet });
    } catch (error) {
      logger.error('Submit daily sheet failed', error);
      throw error;
    }
  }

  async approve(req: AuthRequest, res: Response) {
    try {
      const dto = ApproveDailySheetSchema.parse(req.body);
      const sheet = await this.service.approve(req.params.id, dto, req.tenantId!, req.userId!);
      res.json({ success: true, data: sheet });
    } catch (error) {
      logger.error('Approve daily sheet failed', error);
      throw error;
    }
  }

  async delete(req: AuthRequest, res: Response) {
    try {
      const result = await this.service.delete(req.params.id, req.tenantId!);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Delete daily sheet failed', error);
      throw error;
    }
  }
}
