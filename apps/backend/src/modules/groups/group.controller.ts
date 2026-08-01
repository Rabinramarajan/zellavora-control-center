import { Request, Response, NextFunction } from 'express';
import { GroupService } from './group.service';
import {
  AddGroupMembersSchema,
  CreateGroupSchema,
  GroupListQuerySchema,
  SetGroupRolesSchema,
  UpdateGroupSchema,
} from './group.dto';
import type { AuthRequest } from '../../middleware/auth';

export class GroupController {
  private readonly service: GroupService;

  constructor(service?: GroupService) {
    this.service = service ?? new GroupService();
  }

  list = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const query = GroupListQuerySchema.parse(req.query);
      const data = await this.service.list(query);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  tree = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.tree();
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
      const dto = CreateGroupSchema.parse(req.body);
      const data = await this.service.create(dto, req.userId);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const dto = UpdateGroupSchema.parse(req.body);
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

  addMembers = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const dto = AddGroupMembersSchema.parse(req.body);
      const data = await this.service.addMembers(req.params.id, dto, req.userId);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  removeMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.removeMember(req.params.id, req.params.userId, req.userId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  setRoles = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const dto = SetGroupRolesSchema.parse(req.body);
      const data = await this.service.setRoles(req.params.id, dto, req.userId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}
