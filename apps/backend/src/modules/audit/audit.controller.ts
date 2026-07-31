import { Request, Response, NextFunction } from 'express';
import { AuditService } from './audit.service';
import { LogActivitySchema } from './audit.dto';

export class AuditController {
  private readonly service = new AuditService();

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.query.organizationId as string;
      const page = parseInt((req.query.page as string) || '1', 10);
      const limit = parseInt((req.query.limit as string) || '20', 10);
      const logs = await this.service.getLogs(orgId, page, limit);
      res.json({ success: true, data: logs });
    } catch (err) {
      next(err);
    }
  };

  log = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = LogActivitySchema.parse(req.body) as {
        actorId?: string | null;
        action: string;
        organizationId: string;
        severity?: string;
      };
      const ipAddress = req.ip || null;
      const userAgent = req.headers['user-agent'] || null;
      const log = await this.service.logActivity({ ...data, ipAddress, userAgent });
      res.json({ success: true, data: log });
    } catch (err) {
      next(err);
    }
  };
}
