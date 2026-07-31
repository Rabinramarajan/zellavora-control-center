import { Request, Response, NextFunction } from 'express';
import { SettingsService } from './settings.service';
import { SaveSettingSchema } from './settings.dto';

export class SettingsController {
  private readonly service = new SettingsService();

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.query.organizationId as string;
      const key = req.params.key;
      const config = await this.service.getSetting(orgId, key);
      res.json({ success: true, data: config });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.query.organizationId as string;
      const configs = await this.service.getSettingsForOrg(orgId);
      res.json({ success: true, data: configs });
    } catch (err) {
      next(err);
    }
  };

  save = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = SaveSettingSchema.parse(req.body);
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
