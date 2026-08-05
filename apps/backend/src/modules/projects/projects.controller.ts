import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { ProjectsService } from './projects.service';
import { CreateProjectDTO, UpdateProjectDTO, ProjectQueryDTO } from './projects.dto';
import { logger } from '../../infrastructure/logger';

export class ProjectsController {
  private service = new ProjectsService();

  async create(req: AuthRequest, res: Response) {
    try {
      const validated = CreateProjectDTO.parse(req.body);
      const project = await this.service.create(validated, req.userId!, req.tenantId!);

      res.status(201).json({
        success: true,
        data: project,
      });
    } catch (error) {
      logger.error('Create project failed', error);
      throw error;
    }
  }

  async getAll(req: AuthRequest, res: Response) {
    try {
      const query = ProjectQueryDTO.parse(req.query);
      const skip = (query.page - 1) * query.pageSize;

      const [projects, total, stats] = await Promise.all([
        this.service.getAll(req.tenantId!, {
          skip,
          take: query.pageSize,
          status: query.status,
          search: query.search,
          sortBy: query.sortBy,
        }),
        this.service.getStats(req.tenantId!),
        this.service.getStats(req.tenantId!),
      ]);

      res.json({
        success: true,
        data: projects,
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
        },
        stats,
      });
    } catch (error) {
      logger.error('Get projects failed', error);
      throw error;
    }
  }

  async getById(req: AuthRequest, res: Response) {
    try {
      const project = await this.service.getById(req.params.id);

      res.json({
        success: true,
        data: project,
      });
    } catch (error) {
      logger.error('Get project failed', error);
      throw error;
    }
  }

  async update(req: AuthRequest, res: Response) {
    try {
      const validated = UpdateProjectDTO.parse(req.body);
      const project = await this.service.update(req.params.id, validated, req.userId!, req.tenantId!);

      res.json({
        success: true,
        data: project,
      });
    } catch (error) {
      logger.error('Update project failed', error);
      throw error;
    }
  }

  async updateStatus(req: AuthRequest, res: Response) {
    try {
      const { status } = req.body;
      const project = await this.service.updateStatus(req.params.id, status, req.userId!, req.tenantId!);

      res.json({
        success: true,
        data: project,
      });
    } catch (error) {
      logger.error('Update project status failed', error);
      throw error;
    }
  }

  async delete(req: AuthRequest, res: Response) {
    try {
      const result = await this.service.delete(req.params.id, req.userId!, req.tenantId!);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Delete project failed', error);
      throw error;
    }
  }

  async publish(req: AuthRequest, res: Response) {
    try {
      const project = await this.service.publish(req.params.id, req.userId!, req.tenantId!);

      res.json({
        success: true,
        data: project,
      });
    } catch (error) {
      logger.error('Publish project failed', error);
      throw error;
    }
  }

  async archive(req: AuthRequest, res: Response) {
    try {
      const project = await this.service.archive(req.params.id, req.userId!, req.tenantId!);

      res.json({
        success: true,
        data: project,
      });
    } catch (error) {
      logger.error('Archive project failed', error);
      throw error;
    }
  }
}
