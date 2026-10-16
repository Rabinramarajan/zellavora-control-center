import { Prisma, type PmProject } from '@prisma/client';
import { AuditService } from '../../infrastructure/audit';
import { prisma } from '../../infrastructure/prisma';
import { AppError } from '../../middleware/error';
import {
  atLeast,
  doneKeys,
  requireCan,
  visibleProjectsWhere,
  type PmActor,
  type ProjectView,
} from './pm.access';
import {
  DEFAULT_COLUMNS,
  type Column,
  type CreateProjectDto,
  type ListProjectsQuery,
  type UpdateProjectDto,
} from './pm.dto';
import { PmRepository } from './pm.repository';

const num = (value: Prisma.Decimal | null | undefined): number | null =>
  value === null || value === undefined ? null : Number(value);

const day = (date: Date | null): string | null => (date ? date.toISOString().slice(0, 10) : null);

export const presentProject = (project: PmProject, role: string | null) => ({
  id: project.id,
  key: project.key,
  name: project.name,
  description: project.description,
  status: project.status,
  visibility: project.visibility,
  ownerId: project.ownerId,
  teamId: project.teamId,
  startDate: day(project.startDate),
  dueDate: day(project.dueDate),
  budgetHours: num(project.budgetHours),
  columns: project.columns as unknown as Column[],
  myRole: role,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
});

const SORT_FIELD = {
  name: 'name',
  key: 'key',
  dueDate: 'dueDate',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
} as const;

export class ProjectsService {
  constructor(private readonly repo = new PmRepository()) {}

  // ------------------------------------------------------------------ queries

  async list(actor: PmActor, query: ListProjectsQuery) {
    const teamIds = await this.repo.teamIdsOf(actor);
    const visible = visibleProjectsWhere(actor, teamIds);
    const and: Prisma.PmProjectWhereInput[] = [visible];
    if (query.status) and.push({ status: query.status });
    if (query.mine) {
      and.push({
        OR: [{ ownerId: actor.userId }, { members: { some: { userId: actor.userId } } }],
      });
    }
    if (query.q) {
      and.push({
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          { key: { contains: query.q.toUpperCase() } },
        ],
      });
    }
    const where: Prisma.PmProjectWhereInput = { AND: and };

    const [total, rows] = await Promise.all([
      prisma.pmProject.count({ where }),
      prisma.pmProject.findMany({
        where,
        orderBy: [{ [SORT_FIELD[query.sort]]: query.order }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { members: { where: { userId: actor.userId }, select: { role: true } } },
      }),
    ]);

    const progress = await this.progressFor(
      rows.map((r) => ({ id: r.id, columns: r.columns as unknown as Column[] }))
    );
    const items = rows.map((row) => {
      const role = row.ownerId === actor.userId ? 'PM_LEAD' : (row.members[0]?.role ?? null);
      return { ...presentProject(row, role), ...progress.get(row.id) };
    });
    return { items, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async get(actor: PmActor, projectId: string) {
    const view = await this.repo.loadProject(actor, projectId);
    const [members, milestones, progress] = await Promise.all([
      prisma.pmProjectMember.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } }),
      prisma.pmMilestone.findMany({
        where: { projectId },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      }),
      this.progressFor([{ id: projectId, columns: view.columns }]),
    ]);
    const people = await this.repo.names([view.project.ownerId, ...members.map((m) => m.userId)]);
    return {
      ...presentProject(view.project, view.role),
      ...progress.get(projectId),
      owner: people.find((p) => p.id === view.project.ownerId) ?? null,
      members: members.map((m) => ({
        userId: m.userId,
        role: m.role,
        fullName: people.find((p) => p.id === m.userId)?.fullName ?? null,
        avatarUrl: people.find((p) => p.id === m.userId)?.avatarUrl ?? null,
      })),
      milestones: milestones.map((m) => ({
        id: m.id,
        name: m.name,
        dueDate: day(m.dueDate),
        status: m.status,
      })),
    };
  }

  // ------------------------------------------------------------------ writes

  async create(actor: PmActor, dto: CreateProjectDto) {
    requireCan(actor, 'pm:projects:write');
    const ownerId = dto.ownerId ?? actor.userId;
    await this.repo.assertOrgMembers(actor.organizationId, [ownerId]);
    if (dto.teamId) await this.repo.assertTeam(actor.organizationId, dto.teamId);
    this.assertDates(dto.startDate ?? null, dto.dueDate ?? null);
    if (dto.visibility === 'TEAM' && !dto.teamId) {
      throw new AppError('A team project needs a team', 400, 'TEAM_REQUIRED');
    }

    let project: PmProject;
    try {
      project = await this.repo.run(async (tx) => {
        const created = await tx.pmProject.create({
          data: {
            organizationId: actor.organizationId,
            key: dto.key,
            name: dto.name,
            description: dto.description ?? null,
            status: dto.status,
            visibility: dto.visibility,
            ownerId,
            teamId: dto.teamId ?? null,
            startDate: dto.startDate ?? null,
            dueDate: dto.dueDate ?? null,
            budgetHours: dto.budgetHours ?? null,
            columns: (dto.columns ?? DEFAULT_COLUMNS) as unknown as Prisma.InputJsonValue,
            createdBy: actor.userId,
            updatedBy: actor.userId,
          },
        });
        await tx.pmProjectMember.create({
          data: { projectId: created.id, userId: ownerId, role: 'PM_LEAD' },
        });
        return created;
      });
    } catch (error) {
      throw this.keyConflict(error);
    }

    await this.audit(actor, 'pm.project.created', project.id, null, {
      key: project.key,
      name: project.name,
    });
    return presentProject(project, ownerId === actor.userId ? 'PM_LEAD' : null);
  }

  async update(actor: PmActor, projectId: string, dto: UpdateProjectDto) {
    requireCan(actor, 'pm:projects:write');
    const view = await this.repo.loadProject(actor, projectId);
    this.requireLead(view);

    const next = {
      startDate: dto.startDate === undefined ? view.project.startDate : dto.startDate,
      dueDate: dto.dueDate === undefined ? view.project.dueDate : dto.dueDate,
    };
    this.assertDates(next.startDate, next.dueDate);

    const visibility = dto.visibility ?? view.project.visibility;
    const teamId = dto.teamId === undefined ? view.project.teamId : dto.teamId;
    if (visibility === 'TEAM' && !teamId) {
      throw new AppError('A team project needs a team', 400, 'TEAM_REQUIRED');
    }
    if (dto.teamId) await this.repo.assertTeam(actor.organizationId, dto.teamId);
    if (dto.ownerId) await this.repo.assertOrgMembers(actor.organizationId, [dto.ownerId]);
    if (dto.columns) await this.assertColumnsUsable(projectId, view.columns, dto.columns);

    const updated = await this.repo.run(async (tx) => {
      const row = await tx.pmProject.update({
        where: { id: projectId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
          ...(dto.ownerId !== undefined ? { ownerId: dto.ownerId } : {}),
          ...(dto.teamId !== undefined ? { teamId: dto.teamId } : {}),
          ...(dto.startDate !== undefined ? { startDate: dto.startDate } : {}),
          ...(dto.dueDate !== undefined ? { dueDate: dto.dueDate } : {}),
          ...(dto.budgetHours !== undefined ? { budgetHours: dto.budgetHours } : {}),
          ...(dto.columns !== undefined
            ? { columns: dto.columns as unknown as Prisma.InputJsonValue }
            : {}),
          updatedBy: actor.userId,
        },
      });
      if (dto.ownerId) {
        // The owner always leads the project, even if they were a viewer before.
        await tx.pmProjectMember.upsert({
          where: { projectId_userId: { projectId, userId: dto.ownerId } },
          update: { role: 'PM_LEAD' },
          create: { projectId, userId: dto.ownerId, role: 'PM_LEAD' },
        });
      }
      return row;
    });

    await this.audit(
      actor,
      'pm.project.updated',
      projectId,
      { status: view.project.status, name: view.project.name, ownerId: view.project.ownerId },
      { status: updated.status, name: updated.name, ownerId: updated.ownerId }
    );
    return presentProject(updated, view.role);
  }

  /** Soft delete: the project and its tasks disappear from every list, and the key stays reserved. */
  async remove(actor: PmActor, projectId: string) {
    requireCan(actor, 'pm:projects:write');
    const view = await this.repo.loadProject(actor, projectId);
    this.requireLead(view);
    const now = new Date();
    await this.repo.run(async (tx) => {
      await tx.pmProject.update({
        where: { id: projectId },
        data: { isDeleted: true, deletedAt: now, updatedBy: actor.userId },
      });
      await tx.pmTask.updateMany({
        where: { projectId, isDeleted: false },
        data: { isDeleted: true, deletedAt: now },
      });
    });
    await this.audit(actor, 'pm.project.deleted', projectId, { key: view.project.key }, null);
  }

  // ------------------------------------------------------------------ members

  async listMembers(actor: PmActor, projectId: string) {
    const view = await this.repo.loadProject(actor, projectId);
    const members = await prisma.pmProjectMember.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
    const people = await this.repo.names(members.map((m) => m.userId));
    return members.map((m) => ({
      userId: m.userId,
      role: m.role,
      isOwner: m.userId === view.project.ownerId,
      fullName: people.find((p) => p.id === m.userId)?.fullName ?? null,
      avatarUrl: people.find((p) => p.id === m.userId)?.avatarUrl ?? null,
    }));
  }

  /** Active organization members matching a search, for the member picker. */
  async people(actor: PmActor, query: { q?: string; limit: number }) {
    requireCan(actor, 'pm:projects:manage-members');
    const rows = await prisma.user.findMany({
      where: {
        isDeleted: false,
        status: 'ACTIVE',
        userTenants: { some: { tenantId: actor.organizationId } },
        ...(query.q
          ? {
              OR: [
                { fullName: { contains: query.q, mode: 'insensitive' as const } },
                { email: { contains: query.q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: { fullName: 'asc' },
      take: query.limit,
      select: { id: true, fullName: true, email: true, avatarUrl: true },
    });
    return rows;
  }

  async addMember(
    actor: PmActor,
    projectId: string,
    input: { userId: string; role: 'PM_LEAD' | 'CONTRIBUTOR' | 'VIEWER' }
  ) {
    requireCan(actor, 'pm:projects:manage-members');
    const view = await this.repo.loadProject(actor, projectId);
    this.requireLead(view);
    await this.repo.assertOrgMembers(actor.organizationId, [input.userId]);
    const existing = await prisma.pmProjectMember.findUnique({
      where: { projectId_userId: { projectId, userId: input.userId } },
      select: { id: true },
    });
    if (existing) throw new AppError('That person is already a member', 409, 'ALREADY_MEMBER');
    try {
      await prisma.pmProjectMember.create({
        data: { projectId, userId: input.userId, role: input.role },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError('That person is already a member', 409, 'ALREADY_MEMBER');
      }
      throw error;
    }
    await this.audit(actor, 'pm.project.member_added', projectId, null, input);
    return { userId: input.userId, role: input.role };
  }

  async updateMember(
    actor: PmActor,
    projectId: string,
    userId: string,
    role: 'PM_LEAD' | 'CONTRIBUTOR' | 'VIEWER'
  ) {
    requireCan(actor, 'pm:projects:manage-members');
    const view = await this.repo.loadProject(actor, projectId);
    this.requireLead(view);
    const member = await this.findMember(projectId, userId);
    if (userId === view.project.ownerId && role !== 'PM_LEAD') {
      throw new AppError('Transfer ownership before demoting the owner', 409, 'OWNER_MUST_LEAD');
    }
    if (member.role === 'PM_LEAD' && role !== 'PM_LEAD')
      await this.assertAnotherLead(projectId, userId);
    await prisma.pmProjectMember.update({
      where: { projectId_userId: { projectId, userId } },
      data: { role },
    });
    await this.audit(
      actor,
      'pm.project.member_role_changed',
      projectId,
      { userId, role: member.role },
      { userId, role }
    );
    return { userId, role };
  }

  async removeMember(actor: PmActor, projectId: string, userId: string) {
    requireCan(actor, 'pm:projects:manage-members');
    const view = await this.repo.loadProject(actor, projectId);
    this.requireLead(view);
    const member = await this.findMember(projectId, userId);
    if (userId === view.project.ownerId) {
      throw new AppError('Transfer ownership before removing the owner', 409, 'OWNER_MUST_LEAD');
    }
    if (member.role === 'PM_LEAD') await this.assertAnotherLead(projectId, userId);
    await this.repo.run(async (tx) => {
      await tx.pmProjectMember.delete({ where: { projectId_userId: { projectId, userId } } });
      // Their open work goes back to the pool instead of staying with someone who left.
      await tx.pmTask.updateMany({
        where: { projectId, assigneeId: userId, isDeleted: false },
        data: { assigneeId: null },
      });
    });
    await this.audit(
      actor,
      'pm.project.member_removed',
      projectId,
      { userId, role: member.role },
      null
    );
  }

  // ------------------------------------------------------------------ milestones

  async createMilestone(
    actor: PmActor,
    projectId: string,
    input: { name: string; dueDate?: Date | null }
  ) {
    requireCan(actor, 'pm:projects:write');
    const view = await this.repo.loadProject(actor, projectId);
    this.requireLead(view);
    const row = await prisma.pmMilestone.create({
      data: {
        organizationId: actor.organizationId,
        projectId,
        name: input.name,
        dueDate: input.dueDate ?? null,
      },
    });
    await this.audit(actor, 'pm.milestone.created', projectId, null, { name: row.name });
    return { id: row.id, name: row.name, dueDate: day(row.dueDate), status: row.status };
  }

  async updateMilestone(
    actor: PmActor,
    projectId: string,
    milestoneId: string,
    input: { name?: string; dueDate?: Date | null; status?: 'OPEN' | 'DONE' }
  ) {
    requireCan(actor, 'pm:projects:write');
    const view = await this.repo.loadProject(actor, projectId);
    this.requireLead(view);
    await this.findMilestone(projectId, milestoneId);
    const row = await prisma.pmMilestone.update({ where: { id: milestoneId }, data: input });
    await this.audit(actor, 'pm.milestone.updated', projectId, null, { id: milestoneId, ...input });
    return { id: row.id, name: row.name, dueDate: day(row.dueDate), status: row.status };
  }

  async removeMilestone(actor: PmActor, projectId: string, milestoneId: string) {
    requireCan(actor, 'pm:projects:write');
    const view = await this.repo.loadProject(actor, projectId);
    this.requireLead(view);
    await this.findMilestone(projectId, milestoneId);
    // Tasks keep existing; the foreign key sets their milestone to null.
    await prisma.pmMilestone.delete({ where: { id: milestoneId } });
    await this.audit(actor, 'pm.milestone.deleted', projectId, { id: milestoneId }, null);
  }

  // ------------------------------------------------------------------ progress and reports

  async progress(actor: PmActor, projectId: string) {
    requireCan(actor, 'pm:projects:report');
    const view = await this.repo.loadProject(actor, projectId);
    const [progress, milestones] = await Promise.all([
      this.progressFor([{ id: projectId, columns: view.columns }]),
      prisma.pmMilestone.findMany({ where: { projectId } }),
    ]);
    const byMilestone = await prisma.pmTask.groupBy({
      by: ['milestoneId', 'status'],
      where: {
        projectId,
        isDeleted: false,
        milestoneId: { not: null },
        children: { none: { isDeleted: false } },
      },
      _count: { _all: true },
    });
    const done = new Set(doneKeys(view.columns));
    return {
      ...progress.get(projectId),
      milestones: milestones.map((m) => {
        const rows = byMilestone.filter((r) => r.milestoneId === m.id);
        const total = rows.reduce((sum, r) => sum + r._count._all, 0);
        const finished = rows
          .filter((r) => done.has(r.status))
          .reduce((sum, r) => sum + r._count._all, 0);
        return {
          id: m.id,
          name: m.name,
          dueDate: day(m.dueDate),
          status: m.status,
          total,
          done: finished,
        };
      }),
    };
  }

  async report(actor: PmActor, projectId: string) {
    requireCan(actor, 'pm:projects:report');
    const view = await this.repo.loadProject(actor, projectId);
    const done = new Set(doneKeys(view.columns));
    const tasks = await prisma.pmTask.findMany({
      where: { projectId, isDeleted: false },
      select: {
        id: true,
        parentId: true,
        status: true,
        assigneeId: true,
        dueDate: true,
        estimateHours: true,
        createdAt: true,
        completedAt: true,
      },
      take: 10_000,
    });
    const parents = new Set(tasks.map((t) => t.parentId).filter(Boolean));
    const leaves = tasks.filter((t) => !parents.has(t.id));
    const today = new Date(new Date().toISOString().slice(0, 10));

    const byStatus = view.columns.map((c) => ({
      key: c.key,
      label: c.label,
      count: leaves.filter((t) => t.status === c.key).length,
    }));
    const estimate = leaves.reduce((sum, t) => sum + (num(t.estimateHours) ?? 0), 0);
    const estimateDone = leaves
      .filter((t) => done.has(t.status))
      .reduce((sum, t) => sum + (num(t.estimateHours) ?? 0), 0);
    const overdue = leaves.filter(
      (t) => !done.has(t.status) && t.dueDate && t.dueDate < today
    ).length;

    const assignees = new Map<string, { open: number; done: number }>();
    for (const t of leaves) {
      const key = t.assigneeId ?? 'unassigned';
      const entry = assignees.get(key) ?? { open: 0, done: 0 };
      if (done.has(t.status)) entry.done += 1;
      else entry.open += 1;
      assignees.set(key, entry);
    }
    const logged = await prisma.pmTimeEntry.groupBy({
      by: ['userId'],
      where: { projectId, isDeleted: false },
      _sum: { hours: true },
    });
    const people = await this.repo.names(
      [...assignees.keys(), ...logged.map((l) => l.userId)].filter((k) => k !== 'unassigned')
    );
    const actual = logged.reduce((sum, l) => sum + Number(l._sum.hours ?? 0), 0);

    return {
      generatedAt: new Date().toISOString(),
      totals: {
        tasks: leaves.length,
        done: leaves.filter((t) => done.has(t.status)).length,
        overdue,
      },
      byStatus,
      hours: {
        estimated: estimate,
        estimatedDone: estimateDone,
        actual: Math.round(actual * 100) / 100,
        budget: num(view.project.budgetHours),
      },
      timeByPerson: logged
        .map((l) => ({
          userId: l.userId,
          fullName: people.find((p) => p.id === l.userId)?.fullName ?? null,
          hours: Math.round(Number(l._sum.hours ?? 0) * 100) / 100,
        }))
        .sort((x, y) => y.hours - x.hours),
      byAssignee: [...assignees.entries()].map(([id, counts]) => ({
        assigneeId: id === 'unassigned' ? null : id,
        fullName: people.find((p) => p.id === id)?.fullName ?? null,
        ...counts,
      })),
      burndown: this.burndown(leaves, view.project.startDate ?? view.project.createdAt, today),
    };
  }

  // ------------------------------------------------------------------ helpers

  /** Per project: leaf-task counts and the share that is done. A parent's progress is its children's. */
  async progressFor(projects: Array<{ id: string; columns: Column[] }>) {
    const result = new Map<string, { taskTotal: number; taskDone: number; progress: number }>();
    if (!projects.length) return result;
    const rows = await prisma.pmTask.groupBy({
      by: ['projectId', 'status'],
      where: {
        projectId: { in: projects.map((p) => p.id) },
        isDeleted: false,
        children: { none: { isDeleted: false } },
      },
      _count: { _all: true },
    });
    for (const project of projects) {
      const done = new Set(doneKeys(project.columns));
      const mine = rows.filter((r) => r.projectId === project.id);
      const total = mine.reduce((sum, r) => sum + r._count._all, 0);
      const finished = mine
        .filter((r) => done.has(r.status))
        .reduce((sum, r) => sum + r._count._all, 0);
      result.set(project.id, {
        taskTotal: total,
        taskDone: finished,
        progress: total ? Math.round((finished / total) * 100) : 0,
      });
    }
    return result;
  }

  private burndown(
    tasks: Array<{ createdAt: Date; completedAt: Date | null }>,
    from: Date,
    until: Date
  ): Array<{ date: string; remaining: number }> {
    const start = new Date(from.toISOString().slice(0, 10));
    const days: Array<{ date: string; remaining: number }> = [];
    // Cap the series so a very old project does not produce thousands of points.
    const first = new Date(Math.max(start.getTime(), until.getTime() - 120 * 86_400_000));
    for (let d = new Date(first); d <= until; d = new Date(d.getTime() + 86_400_000)) {
      const endOfDay = d.getTime() + 86_400_000;
      const remaining = tasks.filter(
        (t) =>
          t.createdAt.getTime() < endOfDay &&
          (!t.completedAt || t.completedAt.getTime() >= endOfDay)
      ).length;
      days.push({ date: d.toISOString().slice(0, 10), remaining });
    }
    return days;
  }

  private requireLead(view: ProjectView): void {
    if (!atLeast(view.role, 'PM_LEAD')) {
      throw new AppError('Only a project lead can do this', 403, 'FORBIDDEN_PROJECT_ROLE');
    }
  }

  private assertDates(start: Date | null, due: Date | null): void {
    if (start && due && due < start) {
      throw new AppError('The due date cannot be before the start date', 400, 'INVALID_DATES');
    }
  }

  /** A column that still holds tasks cannot disappear, and a done flag cannot be taken away from it. */
  private async assertColumnsUsable(
    projectId: string,
    current: Column[],
    next: Column[]
  ): Promise<void> {
    const counts = await prisma.pmTask.groupBy({
      by: ['status'],
      where: { projectId, isDeleted: false },
      _count: { _all: true },
    });
    const nextKeys = new Set(next.map((c) => c.key));
    const orphaned = counts.filter((c) => !nextKeys.has(c.status)).map((c) => c.status);
    if (orphaned.length) {
      throw new AppError(
        'Move the tasks out of a column before removing it',
        409,
        'COLUMN_IN_USE',
        {
          columns: orphaned,
        }
      );
    }
    const wasDone = new Set(doneKeys(current));
    const nowDone = new Set(doneKeys(next));
    const flipped = counts.some((c) => wasDone.has(c.status) !== nowDone.has(c.status));
    if (flipped) {
      throw new AppError(
        'A column that holds tasks cannot change whether it means done',
        409,
        'COLUMN_DONE_CHANGED'
      );
    }
  }

  private async findMember(projectId: string, userId: string) {
    const member = await prisma.pmProjectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!member) throw new AppError('Member not found', 404, 'MEMBER_NOT_FOUND');
    return member;
  }

  private async findMilestone(projectId: string, milestoneId: string) {
    const row = await prisma.pmMilestone.findFirst({ where: { id: milestoneId, projectId } });
    if (!row) throw new AppError('Milestone not found', 404, 'MILESTONE_NOT_FOUND');
    return row;
  }

  private async assertAnotherLead(projectId: string, leavingUserId: string): Promise<void> {
    const others = await prisma.pmProjectMember.count({
      where: { projectId, role: 'PM_LEAD', userId: { not: leavingUserId } },
    });
    if (!others) {
      throw new AppError('A project needs at least one lead', 409, 'LAST_LEAD');
    }
  }

  private keyConflict(error: unknown): unknown {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
      ? new AppError('That project key is already used', 409, 'KEY_TAKEN')
      : error;
  }

  private audit(
    actor: PmActor,
    action: string,
    id: string,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null
  ) {
    return AuditService.log({
      action,
      resource: 'pm_project',
      resourceId: id,
      organizationId: actor.organizationId,
      actorId: actor.userId,
      before,
      after,
    });
  }
}
