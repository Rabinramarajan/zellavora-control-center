import { Request, Response, NextFunction } from 'express';
import { OrganizationService } from './organization.service';
import { CreateOrganizationSchema, UpdateOrganizationSchema } from './organization.dto';

export class OrganizationController {
  private readonly service = new OrganizationService();

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const org = await this.service.getOrganization(req.params.id);
      res.json({ success: true, data: org });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = CreateOrganizationSchema.parse(req.body) as {
        name: string;
        clientCode: string;
        logoUrl?: string | null;
      };
      const org = await this.service.createOrganization(data);
      res.json({ success: true, data: org });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = UpdateOrganizationSchema.parse(req.body);
      const org = await this.service.updateOrganization(req.params.id, data);
      res.json({ success: true, data: org });
    } catch (err) {
      next(err);
    }
  };
}
