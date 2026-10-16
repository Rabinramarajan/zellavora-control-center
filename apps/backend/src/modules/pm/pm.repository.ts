import { BaseRepository, type TxClient } from '../../infrastructure/prisma';
import { AppError } from '../../middleware/error';
import {
  columnsOf,
  projectNotFound,
  resolveRole,
  can,
  type PmActor,
  type ProjectView,
} from './pm.access';

/** Lookups shared by the project, task and template services. */
export class PmRepository extends BaseRepository {
  run<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
    return this.withTransaction(fn, { timeoutMs: 20_000 });
  }

  /** Ids of the teams a user belongs to inside the organization. */
  async teamIdsOf(
    actor: Pick<PmActor, 'userId' | 'organizationId'>,
    tx?: TxClient
  ): Promise<string[]> {
    const teams = await this.getDb(tx).team.findMany({
      where: {
        organizationId: actor.organizationId,
        deletedAt: null,
        members: { some: { id: actor.userId } },
      },
      select: { id: true },
    });
    return teams.map((t) => t.id);
  }

  /**
   * The project and the caller's role on it. A project the caller cannot see answers 404, exactly
   * like one that does not exist, so ids cannot be probed across tenants or private projects.
   */
  async loadProject(actor: PmActor, projectId: string, tx?: TxClient): Promise<ProjectView> {
    const project = await this.getDb(tx).pmProject.findFirst({
      where: { id: projectId, organizationId: actor.organizationId, isDeleted: false },
      include: { members: { where: { userId: actor.userId }, select: { role: true } } },
    });
    if (!project) throw projectNotFound();

    const inProjectTeam =
      project.visibility === 'TEAM' && project.teamId
        ? (await this.teamIdsOf(actor, tx)).includes(project.teamId)
        : false;
    const role = resolveRole({
      project,
      memberRole: project.members[0]?.role ?? null,
      userId: actor.userId,
      inProjectTeam,
      canWriteProjects: can(actor, 'pm:projects:write'),
    });
    if (!role) throw projectNotFound();
    const { members: _members, ...plain } = project;
    return { project: plain, role, columns: columnsOf(project) };
  }

  /** Every id must be an active member of the organization; otherwise the request is invalid. */
  async assertOrgMembers(organizationId: string, userIds: string[], tx?: TxClient): Promise<void> {
    const unique = [...new Set(userIds)];
    if (!unique.length) return;
    const found = await this.getDb(tx).user.count({
      where: {
        id: { in: unique },
        isDeleted: false,
        userTenants: { some: { tenantId: organizationId } },
      },
    });
    if (found !== unique.length) {
      throw new AppError(
        'One or more users are not members of this organization',
        400,
        'INVALID_USER'
      );
    }
  }

  /** Every id must be a current member of the project (or its owner). */
  async assertProjectMember(
    projectId: string,
    ownerId: string,
    userId: string,
    tx?: TxClient
  ): Promise<void> {
    if (userId === ownerId) return;
    const member = await this.getDb(tx).pmProjectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { id: true },
    });
    if (!member) {
      throw new AppError(
        'The assignee is not a member of this project',
        400,
        'ASSIGNEE_NOT_MEMBER'
      );
    }
  }

  async assertTeam(organizationId: string, teamId: string, tx?: TxClient): Promise<void> {
    const team = await this.getDb(tx).team.findFirst({
      where: { id: teamId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!team) throw new AppError('Team not found', 400, 'INVALID_TEAM');
  }

  names(
    userIds: string[],
    tx?: TxClient
  ): Promise<Array<{ id: string; fullName: string; avatarUrl: string | null }>> {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (!ids.length) return Promise.resolve([]);
    return this.getDb(tx).user.findMany({
      where: { id: { in: ids } },
      select: { id: true, fullName: true, avatarUrl: true },
    });
  }
}
