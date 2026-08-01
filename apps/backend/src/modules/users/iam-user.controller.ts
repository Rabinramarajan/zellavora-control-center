import { Request, Response, NextFunction } from 'express';
import { IamUserService } from './iam-user.service';
import {
  CreateIamUserSchema,
  IamUserListQuerySchema,
  LockUserSchema,
  SetUserGroupsSchema,
  SetUserRolesSchema,
  SetUserStatusSchema,
  UpdateIamUserSchema,
} from './iam-user.dto';
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

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.getById(req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const dto = CreateIamUserSchema.parse(req.body);
      const data = await this.service.create(dto, req.userId);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const dto = UpdateIamUserSchema.parse(req.body);
      const data = await this.service.update(req.params.id, dto, req.userId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  setStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const dto = SetUserStatusSchema.parse(req.body);
      const data = await this.service.setStatus(req.params.id, dto, req.userId);
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

  unlock = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.unlock(req.params.id, req.userId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  setRoles = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const dto = SetUserRolesSchema.parse(req.body);
      const data = await this.service.setRoles(req.params.id, dto, req.userId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  setGroups = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const dto = SetUserGroupsSchema.parse(req.body);
      const data = await this.service.setGroups(req.params.id, dto, req.userId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.delete(req.params.id, req.userId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}
