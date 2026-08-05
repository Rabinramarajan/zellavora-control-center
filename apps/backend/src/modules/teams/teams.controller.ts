import { Request, Response } from 'express';
import { TeamsService } from './teams.service';
import { CreateTeamDTO, UpdateTeamDTO, TeamQueryDTO, AddTeamMemberDTO, RemoveTeamMemberDTO } from './teams.dto';
import { Logger } from '../../infrastructure/logger';

export class TeamsController {
  private service = new TeamsService();
  private logger = new Logger('TeamsController');

  async create(req: Request, res: Response) {
    try {
      const validated = CreateTeamDTO.parse(req.body);
      const team = await this.service.create(validated, req.user.id);

      res.status(201).json({
        success: true,
        data: team,
      });
    } catch (error) {
      this.logger.error('Create team failed', error);
      throw error;
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const query = TeamQueryDTO.parse(req.query);
      const skip = (query.page - 1) * query.pageSize;

      const [teams, total, stats] = await Promise.all([
        this.service.getAll(req.user.organizationId, {
          skip,
          take: query.pageSize,
          search: query.search,
          sortBy: query.sortBy,
        }),
        this.service.getStats(req.user.organizationId),
        this.service.getStats(req.user.organizationId),
      ]);

      res.json({
        success: true,
        data: teams,
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total: (stats as any).total,
        },
      });
    } catch (error) {
      this.logger.error('Get teams failed', error);
      throw error;
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const team = await this.service.getById(req.params.id);

      res.json({
        success: true,
        data: team,
      });
    } catch (error) {
      this.logger.error('Get team failed', error);
      throw error;
    }
  }

  async update(req: Request, res: Response) {
    try {
      const validated = UpdateTeamDTO.parse(req.body);
      const team = await this.service.update(req.params.id, validated, req.user.id);

      res.json({
        success: true,
        data: team,
      });
    } catch (error) {
      this.logger.error('Update team failed', error);
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
      this.logger.error('Delete team failed', error);
      throw error;
    }
  }

  async getMembers(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const skip = (page - 1) * pageSize;

      const [members, total] = await Promise.all([
        this.service.getMembers(req.params.id, skip, pageSize),
        this.service.getMemberCount(req.params.id),
      ]);

      res.json({
        success: true,
        data: members,
        pagination: { page, pageSize, total },
      });
    } catch (error) {
      this.logger.error('Get team members failed', error);
      throw error;
    }
  }

  async addMember(req: Request, res: Response) {
    try {
      const validated = AddTeamMemberDTO.parse(req.body);
      const team = await this.service.addMember(
        req.params.id,
        validated.userId,
        req.user.id,
        validated.role
      );

      res.status(201).json({
        success: true,
        data: team,
      });
    } catch (error) {
      this.logger.error('Add team member failed', error);
      throw error;
    }
  }

  async removeMember(req: Request, res: Response) {
    try {
      const validated = RemoveTeamMemberDTO.parse(req.body);
      const team = await this.service.removeMember(req.params.id, validated.userId, req.user.id);

      res.json({
        success: true,
        data: team,
      });
    } catch (error) {
      this.logger.error('Remove team member failed', error);
      throw error;
    }
  }
}
