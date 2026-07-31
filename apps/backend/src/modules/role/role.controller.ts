import { Request, Response, NextFunction } from 'express';
import { RoleService } from './role.service';
import { CreateRoleSchema, UpdateRoleSchema } from './role.dto';

export class RoleController {
  private readonly service = new RoleService();

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = await this.service.getRole(req.params.id);
      res.json({ success: true, data: role });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.query.organizationId as string;
      const roles = await this.service.getRolesForOrg(orgId);
      res.json({ success: true, data: roles });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = CreateRoleSchema.parse(req.body) as {
        name: string;
        organizationId?: string | null;
        description?: string | null;
      };
      const role = await this.service.createRole(data);
      res.json({ success: true, data: role });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = UpdateRoleSchema.parse(req.body);
      const role = await this.service.updateRole(req.params.id, data);
      res.json({ success: true, data: role });
    } catch (err) {
      next(err);
    }
  };
}
