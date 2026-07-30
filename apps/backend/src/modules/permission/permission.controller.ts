import { Request, Response, NextFunction } from 'express';
import { PermissionService } from './permission.service';
import { CreatePermissionSchema, AssignPermissionSchema } from './permission.dto';

export class PermissionController {
  private readonly service = new PermissionService();

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const perms = await this.service.getAllPermissions();
      res.json({ success: true, data: perms });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = CreatePermissionSchema.parse(req.body) as { name: string; description?: string | null; groupId?: string | null };
      const perm = await this.service.createPermission(data);
      res.json({ success: true, data: perm });
    } catch (err) {
      next(err);
    }
  };

  assign = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = AssignPermissionSchema.parse(req.body);
      const result = await this.service.assignPermissionToRole(data.roleId, data.permissionId, data.effect);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };
}
