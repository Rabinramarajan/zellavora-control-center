import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { DailySheetsService } from './daily-sheets.service';
import {
  CreateDailySheetSchema,
  UpdateDailySheetSchema,
  ApproveDailySheetSchema,
  DailySheetQuerySchema,
} from './daily-sheets.dto';
import { requestContext, resolveViewer } from './sheets.shared';

export class DailySheetsController {
  private readonly service = new DailySheetsService();

  public async create(req: AuthRequest, res: Response): Promise<void> {
    const { organizationId } = requestContext(req);
    const dto = CreateDailySheetSchema.parse(req.body);
    const sheet = await this.service.create(dto, organizationId, await resolveViewer(req));
    res.status(201).json({ success: true, data: sheet });
  }

  public async list(req: AuthRequest, res: Response): Promise<void> {
    const { organizationId } = requestContext(req);
    const dto = DailySheetQuerySchema.parse(req.query);
    const sheets = await this.service.list(organizationId, dto, await resolveViewer(req));
    res.json({ success: true, data: sheets });
  }

  public async projects(req: AuthRequest, res: Response): Promise<void> {
    const { organizationId, userId } = requestContext(req);
    res.json({
      success: true,
      data: await this.service.projectSuggestions(organizationId, userId),
    });
  }

  public async getById(req: AuthRequest, res: Response): Promise<void> {
    const { organizationId } = requestContext(req);
    const sheet = await this.service.getById(
      req.params.id,
      organizationId,
      await resolveViewer(req)
    );
    res.json({ success: true, data: sheet });
  }

  public async update(req: AuthRequest, res: Response): Promise<void> {
    const { organizationId } = requestContext(req);
    const dto = UpdateDailySheetSchema.parse(req.body);
    const sheet = await this.service.update(
      req.params.id,
      dto,
      organizationId,
      await resolveViewer(req)
    );
    res.json({ success: true, data: sheet });
  }

  public async submit(req: AuthRequest, res: Response): Promise<void> {
    const { organizationId } = requestContext(req);
    const sheet = await this.service.submitForApproval(
      req.params.id,
      organizationId,
      await resolveViewer(req)
    );
    res.json({ success: true, data: sheet });
  }

  public async approve(req: AuthRequest, res: Response): Promise<void> {
    const { organizationId } = requestContext(req);
    const dto = ApproveDailySheetSchema.parse(req.body);
    const sheet = await this.service.approve(
      req.params.id,
      dto,
      organizationId,
      await resolveViewer(req)
    );
    res.json({ success: true, data: sheet });
  }

  public async delete(req: AuthRequest, res: Response): Promise<void> {
    const { organizationId } = requestContext(req);
    const result = await this.service.delete(
      req.params.id,
      organizationId,
      await resolveViewer(req)
    );
    res.json({ success: true, data: result });
  }
}
