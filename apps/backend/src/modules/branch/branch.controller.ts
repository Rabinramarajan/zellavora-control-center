import { Request, Response, NextFunction } from 'express';
import { BranchService } from './branch.service';
import { CreateBranchSchema, UpdateBranchSchema } from './branch.dto';

export class BranchController {
  private readonly service = new BranchService();

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const branch = await this.service.getBranch(req.params.id);
      res.json({ success: true, data: branch });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.query.organizationId as string;
      const branches = await this.service.getBranchesForOrg(orgId);
      res.json({ success: true, data: branches });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = CreateBranchSchema.parse(req.body) as {
        organizationId: string;
        name: string;
        code?: string | null;
      };
      const branch = await this.service.createBranch(data);
      res.json({ success: true, data: branch });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = UpdateBranchSchema.parse(req.body);
      const branch = await this.service.updateBranch(req.params.id, data);
      res.json({ success: true, data: branch });
    } catch (err) {
      next(err);
    }
  };
}
