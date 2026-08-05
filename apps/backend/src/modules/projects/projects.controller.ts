import { Request, Response } from 'express';
import { ProjectsService } from './projects.service';
import { CreateProjectDTO, UpdateProjectDTO, ProjectQueryDTO } from './projects.dto';
import { Logger } from '../../infrastructure/logger';

export class ProjectsController {
  private service = new ProjectsService();
  private logger = new Logger('ProjectsController');

  async create(req: Request, res: Response) {
    try {
      const validated = CreateProjectDTO.parse(req.body);
      const project = await this.service.create(validated, req.user.id);

      res.status(201).json({
        success: true,
        data: project,
      });
    } catch (error) {
      this.logger.error('Create project failed', error);
      throw error;
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const query = ProjectQueryDTO.parse(req.query);
      const skip = (query.page - 1) * query.pageSize;

      const [projects, total, stats] = await Promise.all([
        this.service.getAll(req.user.organizationId, {
          skip,
          take: query.pageSize,
          status: query.status,
          search: query.search,
          sortBy: query.sortBy,
        }),
        this.service.getStats(req.user.organizationId),
        this.service.getStats(req.user.organizationId),
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
      this.logger.error('Get projects failed', error);
      throw error;
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const project = await this.service.getById(req.params.id);

      res.json({
        success: true,
        data: project,
      });
    } catch (error) {
      this.logger.error('Get project failed', error);
      throw error;
    }
  }

  async update(req: Request, res: Response) {
    try {
      const validated = UpdateProjectDTO.parse(req.body);
      const project = await this.service.update(req.params.id, validated, req.user.id);

      res.json({
        success: true,
        data: project,
      });
    } catch (error) {
      this.logger.error('Update project failed', error);
      throw error;
    }
  }

  async updateStatus(req: Request, res: Response) {
    try {
      const { status } = req.body;
      const project = await this.service.updateStatus(req.params.id, status, req.user.id);

      res.json({
        success: true,
        data: project,
      });
    } catch (error) {
      this.logger.error('Update project status failed', error);
      throw error;
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const result = await this.service.delete(req.params.id, req.user.id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      this.logger.error('Delete project failed', error);
      throw error;
    }
  }

  async publish(req: Request, res: Response) {
    try {
      const project = await this.service.publish(req.params.id, req.user.id);

      res.json({
        success: true,
        data: project,
      });
    } catch (error) {
      this.logger.error('Publish project failed', error);
      throw error;
    }
  }

  async archive(req: Request, res: Response) {
    try {
      const project = await this.service.archive(req.params.id, req.user.id);

      res.json({
        success: true,
        data: project,
      });
    } catch (error) {
      this.logger.error('Archive project failed', error);
      throw error;
    }
  }
}
