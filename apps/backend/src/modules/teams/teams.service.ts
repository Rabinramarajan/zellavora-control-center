import { TeamsRepository } from './teams.repository';
import { CreateTeamDTOType, UpdateTeamDTOType, AddTeamMemberDTOType } from './teams.dto';
import { AppError } from '../../middleware/error';
import { AuditService } from '../audit/audit.service';

export class TeamsService {
  private repo = new TeamsRepository();
  private auditService = new AuditService();

  async create(data: CreateTeamDTOType, userId: string) {
    try {
      const team = await this.repo.create({
        ...data,
        members: [userId, ...(data.members || [])], // Add creator as member
      });

      await this.auditService.log({
        action: 'CREATE',
        entityType: 'Team',
        entityId: team.id,
        userId,
        details: { name: team.name },
        severity: 'info',
      });

      return team;
    } catch (error) {
      throw new AppError('Failed to create team', 500, 'TEAM_CREATE_ERROR');
    }
  }

  async getById(id: string) {
    const team = await this.repo.findById(id);
    if (!team) {
      throw new AppError('Team not found', 404, 'TEAM_NOT_FOUND');
    }
    return team;
  }

  async getAll(organizationId: string, options?: any) {
    return this.repo.findAll(organizationId, options);
  }

  async getStats(organizationId: string) {
    const total = await this.repo.count(organizationId);
    return { total };
  }

  async update(id: string, data: UpdateTeamDTOType, userId: string) {
    const team = await this.getById(id);

    const updated = await this.repo.update(id, data, userId);

    await this.auditService.log({
      action: 'UPDATE',
      entityType: 'Team',
      entityId: id,
      userId,
      details: { name: updated.name, changes: data },
      severity: 'info',
    });

    return updated;
  }

  async delete(id: string, userId: string) {
    const team = await this.getById(id);

    await this.repo.delete(id);

    await this.auditService.log({
      action: 'DELETE',
      entityType: 'Team',
      entityId: id,
      userId,
      details: { name: team.name },
      severity: 'warning',
    });

    return { success: true, id };
  }

  async addMember(teamId: string, memberId: string, userId: string, role = 'member') {
    const team = await this.getById(teamId);

    const updated = await this.repo.addMember(teamId, memberId, role);

    await this.auditService.log({
      action: 'ADD_MEMBER',
      entityType: 'Team',
      entityId: teamId,
      userId,
      details: { teamName: team.name, memberId, role },
      severity: 'info',
    });

    return updated;
  }

  async removeMember(teamId: string, memberId: string, userId: string) {
    const team = await this.getById(teamId);

    const updated = await this.repo.removeMember(teamId, memberId);

    await this.auditService.log({
      action: 'REMOVE_MEMBER',
      entityType: 'Team',
      entityId: teamId,
      userId,
      details: { teamName: team.name, memberId },
      severity: 'info',
    });

    return updated;
  }

  async getMembers(teamId: string, skip = 0, take = 20) {
    await this.getById(teamId); // Verify team exists

    return this.repo.getMembers(teamId, skip, take);
  }

  async getMemberCount(teamId: string) {
    await this.getById(teamId); // Verify team exists

    return this.repo.getMemberCount(teamId);
  }
}
