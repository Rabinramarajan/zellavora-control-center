import { Response, NextFunction } from 'express';
import { NotificationService } from './notification.service';
import { ListNotificationsQuerySchema, type ListNotificationsQuery } from './notification.dto';
import type { AuthRequest } from '../../middleware/auth';

export class NotificationController {
  private readonly service = new NotificationService();

  list = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const query = ListNotificationsQuerySchema.parse(req.query) as ListNotificationsQuery;
      const { items, meta } = await this.service.listMine(
        req.tenantId as string,
        req.userId as string,
        query
      );
      res.json({
        success: true,
        message: 'Notifications retrieved successfully',
        data: items,
        meta,
      });
    } catch (err) {
      next(err);
    }
  };
}
