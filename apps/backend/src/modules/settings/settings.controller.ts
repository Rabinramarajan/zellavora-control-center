import { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { SettingsService } from './settings.service';
import { SaveSettingSchema } from './settings.dto';

export class SettingsController {
  private readonly service = new SettingsService();

  get = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const orgId = tenantContext(req, req.query.organizationId);
      const key = req.params.key;
      const config = await this.service.getSetting(orgId, key);
      res.json({ success: true, data: config });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const orgId = tenantContext(req, req.query.organizationId);
      const configs = await this.service.getSettingsForOrg(orgId);
      res.json({ success: true, data: configs });
    } catch (err) {
      next(err);
    }
  };

  save = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = SaveSettingSchema.parse(req.body);
      tenantContext(req, data.organizationId);
      const config = await this.service.saveSetting(
        data.organizationId,
        data.key,
        data.value,
        data.category
      );
      res.json({ success: true, data: config });
    } catch (err) {
      next(err);
    }
  };
}

function tenantContext(req: AuthRequest, supplied: unknown): string {
  if (!req.tenantId) throw new AppError('Tenant context is required', 401, 'TENANT_REQUIRED');
  if (supplied !== undefined && supplied !== req.tenantId) {
    throw new AppError('Tenant context mismatch', 403, 'TENANT_MISMATCH');
  }
  return req.tenantId;
}
