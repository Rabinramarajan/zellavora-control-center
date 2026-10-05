import { NextFunction, Response } from 'express';
import type { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { MenuAccessService } from './menu-access.service';
import { MenuAccessRoleParamsSchema, UpdateMenuAccessSchema } from './menu-access.dto';

export class MenuAccessController {
  constructor(private readonly service = new MenuAccessService()) {}

  tree = (_req: AuthRequest, res: Response) => {
    res.json({ success: true, data: this.service.tree() });
  };

  get = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { roleId } = MenuAccessRoleParamsSchema.parse(req.params);
      const data = await this.service.get(roleId, this.tenant(req));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { roleId } = MenuAccessRoleParamsSchema.parse(req.params);
      const dto = UpdateMenuAccessSchema.parse(req.body);
      const data = await this.service.update(roleId, dto, this.tenant(req), req.userId!);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  /** The tenant always comes from the verified token. */
  private tenant(req: AuthRequest): string {
    if (!req.tenantId || !req.userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    return req.tenantId;
  }
}
