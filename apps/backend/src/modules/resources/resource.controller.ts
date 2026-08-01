import { Request, Response, NextFunction } from 'express';
import { ResourceService } from './resource.service';
import {
  AddResourceActionSchema,
  CreateResourceSchema,
  ResourceListQuerySchema,
  UpdateResourceSchema,
} from './resource.dto';
import type { AuthRequest } from '../../middleware/auth';

export class ResourceController {
  private readonly service: ResourceService;

  constructor(service?: ResourceService) {
    this.service = service ?? new ResourceService();
  }

  list = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const query = ResourceListQuerySchema.parse(req.query);
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

  getByKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.getByKey(req.params.key);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const dto = CreateResourceSchema.parse(req.body);
      const data = await this.service.create(dto, req.userId);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const dto = UpdateResourceSchema.parse(req.body);
      const data = await this.service.update(req.params.id, dto, req.userId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  addAction = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const dto = AddResourceActionSchema.parse(req.body);
      const data = await this.service.addAction(req.params.id, dto, req.userId);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  removeAction = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await this.service.removeAction(req.params.id, req.params.actionId, req.userId);
      res.json({ success: true, data: { id: req.params.actionId } });
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
