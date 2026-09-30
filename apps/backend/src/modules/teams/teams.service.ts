import { AppError } from '../../middleware/error';
import { AuditService } from '../../infrastructure/audit';
import { TeamsRepository } from './teams.repository';
import { CreateTeamDto, TeamListQuery, UpdateTeamDto } from './teams.dto';

type TeamRow = NonNullable<Awaited<ReturnType<TeamsRepository['findById']>>>;

const toMember = (m: TeamRow['members'][number]) => ({
  userId: m.id,
  fullName: m.fullName,
  email: m.email,
  jobTitle: m.jobTitle,
  avatarUrl: m.avatarUrl,
  status: m.status,
});

const toView = (t: TeamRow) => ({
  id: t.id,
  name: t.name,
  description: t.description,
  memberCount: t._count.members,
  createdAt: t.createdAt.toISOString(),
  updatedAt: t.updatedAt.toISOString(),
});

export class TeamsService {
  constructor(private readonly repo = new TeamsRepository()) {}

  async list(organizationId: string, query: TeamListQuery) {
    const { data, total } = await this.repo.list(organizationId, query);
    return {
      data: data.map((t) => ({ ...toView(t), memberPreview: t.members.map(toMember) })),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async get(organizationId: string, id: string) {
    const team = await this.require(organizationId, id);
    return { ...toView(team), members: team.members.map(toMember) };
  }

  async create(organizationId: string, dto: CreateTeamDto, actorId: string) {
    await this.assertNameFree(organizationId, dto.name);
    const created = await this.repo.create({
      organizationId,
      name: dto.name,
      description: dto.description ?? null,
      createdBy: actorId,
    });
    await this.audit(organizationId, actorId, 'team.created', created.id, { after: dto });
    return this.get(organizationId, created.id);
  }

  async update(organizationId: string, id: string, dto: UpdateTeamDto, actorId: string) {
    const existing = await this.require(organizationId, id);
    if (dto.name && dto.name.toLowerCase() !== existing.name.toLowerCase()) {
      await this.assertNameFree(organizationId, dto.name);
    }
    await this.repo.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      updatedBy: actorId,
    });
    await this.audit(organizationId, actorId, 'team.updated', id, {
      before: { name: existing.name, description: existing.description },
      after: dto,
    });
    return this.get(organizationId, id);
  }

  async remove(organizationId: string, id: string, actorId: string) {
    const existing = await this.require(organizationId, id);
    await this.repo.softDelete(id, actorId);
    await this.audit(organizationId, actorId, 'team.deleted', id, {
      before: { name: existing.name },
    });
    return { success: true };
  }

  async addMembers(organizationId: string, id: string, userIds: string[], actorId: string) {
    await this.require(organizationId, id);
    const valid = (await this.repo.orgMemberIds(organizationId, userIds)).map((u) => u.id);
    if (!valid.length) {
      throw new AppError(
        'None of the selected users belong to this organization.',
        400,
        'NO_MEMBERS'
      );
    }
    await this.repo.transaction((tx) =>
      this.repo.setMembership(id, { connect: valid }, actorId, tx)
    );
    await this.audit(organizationId, actorId, 'team.members_added', id, {
      metadata: { userIds: valid },
    });
    return this.get(organizationId, id);
  }

  async removeMember(organizationId: string, id: string, userId: string, actorId: string) {
    await this.require(organizationId, id);
    await this.repo.transaction((tx) =>
      this.repo.setMembership(id, { disconnect: [userId] }, actorId, tx)
    );
    await this.audit(organizationId, actorId, 'team.member_removed', id, { metadata: { userId } });
    return this.get(organizationId, id);
  }

  private async require(organizationId: string, id: string) {
    const team = await this.repo.findById(id, organizationId);
    if (!team) throw new AppError('Team not found', 404, 'TEAM_NOT_FOUND');
    return team;
  }

  private async assertNameFree(organizationId: string, name: string) {
    if (await this.repo.findByName(organizationId, name)) {
      throw new AppError(`A team named '${name}' already exists.`, 409, 'TEAM_EXISTS');
    }
  }

  private audit(
    organizationId: string,
    actorId: string,
    action: string,
    resourceId: string,
    detail: { before?: object; after?: object; metadata?: Record<string, unknown> }
  ) {
    return AuditService.log({
      organizationId,
      actorId,
      action,
      resource: 'team',
      resourceId,
      before: detail.before as Record<string, unknown> | undefined,
      after: detail.after as Record<string, unknown> | undefined,
      metadata: detail.metadata,
    });
  }
}
