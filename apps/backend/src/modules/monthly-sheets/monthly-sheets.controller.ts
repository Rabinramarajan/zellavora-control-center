import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { MonthlySheetsService } from './monthly-sheets.service';
import {
  CreateMonthlySheetSchema,
  UpdateMonthlySheetSchema,
  ApproveMonthlySheetSchema,
  MarkAsPaidSchema,
  MonthlyDocumentQuerySchema,
  MonthlySheetQuerySchema,
} from './monthly-sheets.dto';
import { requestContext, resolveViewer } from '../daily-sheets/sheets.shared';

export class MonthlySheetsController {
  private readonly service = new MonthlySheetsService();

  public async create(req: AuthRequest, res: Response): Promise<void> {
    const { organizationId } = requestContext(req);
    const dto = CreateMonthlySheetSchema.parse(req.body);
    const sheet = await this.service.create(dto, organizationId, await resolveViewer(req));
    res.status(201).json({ success: true, data: sheet });
  }

  public async list(req: AuthRequest, res: Response): Promise<void> {
    const { organizationId } = requestContext(req);
    const dto = MonthlySheetQuerySchema.parse(req.query);
    const sheets = await this.service.list(organizationId, dto, await resolveViewer(req));
    res.json({ success: true, data: sheets });
  }

  public async document(req: AuthRequest, res: Response): Promise<void> {
    const { organizationId } = requestContext(req);
    const dto = MonthlyDocumentQuerySchema.parse(req.query);
    const document = await this.service.document(dto, organizationId, await resolveViewer(req));
    res.json({ success: true, data: document });
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

  /** PUT regenerates the totals from the month's approved daily sheets. */
  public async update(req: AuthRequest, res: Response): Promise<void> {
    const { organizationId } = requestContext(req);
    UpdateMonthlySheetSchema.parse(req.body ?? {});
    const sheet = await this.service.regenerate(
      req.params.id,
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
    const dto = ApproveMonthlySheetSchema.parse(req.body);
    const sheet = await this.service.approve(
      req.params.id,
      dto,
      organizationId,
      await resolveViewer(req)
    );
    res.json({ success: true, data: sheet });
  }

  public async markAsPaid(req: AuthRequest, res: Response): Promise<void> {
    const { organizationId } = requestContext(req);
    const dto = MarkAsPaidSchema.parse(req.body ?? {});
    const sheet = await this.service.markAsPaid(
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
