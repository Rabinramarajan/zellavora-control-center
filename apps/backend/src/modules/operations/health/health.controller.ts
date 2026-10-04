import { Request, Response, NextFunction } from 'express';
import { SystemHealthService } from './health.service';
import { AppError } from '../../../middleware/error';

export class SystemHealthController {
  private readonly service = new SystemHealthService();

  getDashboard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const force = req.query.fresh === 'true' || req.query.refresh === 'true';
      const dashboard = await this.service.getDashboard(force);
      res.json(dashboard);
    } catch (err) {
      next(err);
    }
  };

  getServices = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const services = await this.service.getServices();
      res.json(services);
    } catch (err) {
      next(err);
    }
  };

  getServiceById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serviceId = req.params.serviceId;
      const service = await this.service.getServiceById(serviceId);
      if (!service) {
        throw new AppError(`Service '${serviceId}' not found`, 404, 'NOT_FOUND');
      }
      res.json(service);
    } catch (err) {
      next(err);
    }
  };

  getLiveness = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.checkLiveness();
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  getReadiness = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.checkReadiness();
      res.status(result.status === 'HEALTHY' ? 200 : 503).json(result);
    } catch (err) {
      next(err);
    }
  };
}
