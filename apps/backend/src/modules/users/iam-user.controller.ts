import { Request, Response, NextFunction } from 'express';
import { IamUserService } from './iam-user.service';
import { IamUserListQuerySchema, LockUserSchema } from './iam-user.dto';
import type { AuthRequest } from '../../middleware/auth';

export class IamUserController {
  private readonly service: IamUserService;

  constructor(service?: IamUserService) {
    this.service = service ?? new IamUserService();
  }

  list = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const query = IamUserListQuerySchema.parse(req.query);
      const data = await this.service.list(query);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  stats = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.stats();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.getById(req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  lock = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const dto = LockUserSchema.parse(req.body);
      const data = await this.service.lock(req.params.id, dto, req.userId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}
