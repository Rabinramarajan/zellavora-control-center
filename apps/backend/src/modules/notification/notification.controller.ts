import { Request, Response, NextFunction } from 'express';
import { NotificationService } from './notification.service';
import { SendNotificationSchema } from './notification.dto';

export class NotificationController {
  private readonly service = new NotificationService();

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.query.organizationId as string;
      const list = await this.service.getNotifications(orgId);
      res.json({ success: true, data: list });
    } catch (err) {
      next(err);
    }
  };

  send = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = SendNotificationSchema.parse(req.body) as {
        organizationId: string;
        recipientId?: string | null;
        title?: string | null;
        body: string;
        channels?: string[];
      };
      const result = await this.service.sendNotification(data);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };
}
