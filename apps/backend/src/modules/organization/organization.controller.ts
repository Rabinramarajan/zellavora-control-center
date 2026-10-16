import { Response, NextFunction } from 'express';
import { OrganizationService, type OrganizationCaller } from './organization.service';
import { CreateOrganizationSchema, UpdateOrganizationSchema } from './organization.dto';
import { resolvePlatformAdmin, type AuthRequest } from '../../middleware/auth';

const callerOf = async (req: AuthRequest): Promise<OrganizationCaller> => ({
  tenantId: req.tenantId as string,
  isPlatformAdmin: await resolvePlatformAdmin(req),
});

export class OrganizationController {
  private readonly service = new OrganizationService();

  get = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const org = await this.service.getOrganization(req.params.id, await callerOf(req));
      res.json({ success: true, message: 'Organization retrieved successfully', data: org });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = CreateOrganizationSchema.parse(req.body) as {
        name: string;
        clientCode: string;
        logoUrl?: string | null;
      };
      const org = await this.service.createOrganization(data);
      res.json({ success: true, message: 'Organization created successfully', data: org });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = UpdateOrganizationSchema.parse(req.body);
      const org = await this.service.updateOrganization(req.params.id, data, await callerOf(req));
      res.json({ success: true, message: 'Organization updated successfully', data: org });
    } catch (err) {
      next(err);
    }
  };
}
