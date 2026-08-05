import { ProjectsRepository } from './projects.repository';
import { CreateProjectDTOType, UpdateProjectDTOType } from './projects.dto';
import { AppError } from '../../middleware/error';
import { AuditService } from '../audit/audit.service';

export class ProjectsService {
  private repo = new ProjectsRepository();
  private auditService = new AuditService();

  async create(data: CreateProjectDTOType, userId: string, organizationId: string) {
    try {
      const project = await this.repo.create(data);

      await this.auditService.logActivity({
        actorId: userId,
        action: `CREATE_PROJECT:${project.name}`,
        organizationId,
        severity: 'info',
      });

      return project;
    } catch (error) {
      throw new AppError('Failed to create project', 500, 'PROJECT_CREATE_ERROR');
    }
  }

  async getById(id: string) {
    const project = await this.repo.findById(id);
    if (!project) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }
    return project;
  }

  async getAll(organizationId: string, options?: any) {
    return this.repo.findAll(organizationId, options);
  }

  async getStats(organizationId: string) {
    return this.repo.getStats(organizationId);
  }

  async update(id: string, data: UpdateProjectDTOType, userId: string, organizationId: string) {
    const project = await this.getById(id);

    const updated = await this.repo.update(id, data, userId);

    await this.auditService.logActivity({
      actorId: userId,
      action: `UPDATE_PROJECT:${updated.name}`,
      organizationId,
      severity: 'info',
    });

    return updated;
  }

  async updateStatus(id: string, status: string, userId: string, organizationId: string) {
    const project = await this.getById(id);

    if (!['draft', 'published', 'archived'].includes(status)) {
      throw new AppError('Invalid status', 400, 'INVALID_STATUS');
    }

    const updated = await this.repo.updateStatus(id, status, userId);

    await this.auditService.logActivity({
      actorId: userId,
      action: `UPDATE_PROJECT_STATUS:${project.name}`,
      organizationId,
      severity: 'info',
    });

    return updated;
  }

  async delete(id: string, userId: string, organizationId: string) {
    const project = await this.getById(id);

    await this.repo.delete(id);

    await this.auditService.logActivity({
      actorId: userId,
      action: `DELETE_PROJECT:${project.name}`,
      organizationId,
      severity: 'warning',
    });

    return { success: true, id };
  }

  async publish(id: string, userId: string, organizationId: string) {
    return this.updateStatus(id, 'published', userId, organizationId);
  }

  async archive(id: string, userId: string, organizationId: string) {
    return this.updateStatus(id, 'archived', userId, organizationId);
  }
}
