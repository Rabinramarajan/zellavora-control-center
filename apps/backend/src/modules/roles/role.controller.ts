import { Request, Response, NextFunction } from 'express';
import { RoleService } from './role.service';
import {
  CopyRoleSchema,
  CreateRoleSchema,
  RoleListQuerySchema,
  SetRolePermissionsSchema,
  UpdateRoleSchema,
} from './role.dto';
import type { AuthRequest } from '../../middleware/auth';

export class RoleController {
  private readonly service: RoleService;

  constructor(service?: RoleService) {
    this.service = service ?? new RoleService();
  }

  list = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const query = RoleListQuerySchema.parse(req.query);
      const data = await this.service.list(query);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  listAll = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.listAll();
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

  listPermissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.listPermissions(req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const dto = CreateRoleSchema.parse(req.body);
      const data = await this.service.create(dto, req.userId);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const dto = UpdateRoleSchema.parse(req.body);
      const data = await this.service.update(req.params.id, dto, req.userId);
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

  setPermissions = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const dto = SetRolePermissionsSchema.parse(req.body);
      const data = await this.service.setPermissions(req.params.id, dto, req.userId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  copy = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const dto = CopyRoleSchema.parse(req.body);
      const data = await this.service.copy(req.params.id, dto, req.userId);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}
