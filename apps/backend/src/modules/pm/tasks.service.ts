import { Prisma, type PmTask } from '@prisma/client';
import { AuditService } from '../../infrastructure/audit';
import { type TxClient, prisma } from '../../infrastructure/prisma';
import { logger } from '../../infrastructure/logger';
import { AppError } from '../../middleware/error';
import { NotificationService } from '../notification/notification.service';
import {
  atLeast,
  doneKeys,
  requireCan,
  taskNotFound,
  visibleProjectsWhere,
  type PmActor,
  type ProjectView,
} from './pm.access';
import type { Column, CreateTaskDto, ListTasksQuery, MoveTaskDto, UpdateTaskDto } from './pm.dto';
import { loggedHoursFor } from './pm.hours';
import { PmRepository } from './pm.repository';

const GAP = 1000;
const MIN_GAP = 0.0001;

const day = (date: Date | null): string | null => (date ? date.toISOString().slice(0, 10) : null);
const num = (value: Prisma.Decimal | null | undefined): number | null =>
  value === null || value === undefined ? null : Number(value);
const today = (): Date => new Date(new Date().toISOString().slice(0, 10));

type Rollup = { childCount: number; childDone: number };

/** The wire shape of a task. Decimals become numbers and dates stay date-only strings. */
export function presentTask(task: PmTask, projectKey: string, done: Set<string>, rollup?: Rollup) {
  const open = !done.has(task.status);
  return {
    id: task.id,
    projectId: task.projectId,
    number: task.number,
    key: `${projectKey}-${task.number}`,
    parentId: task.parentId,
    milestoneId: task.milestoneId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assigneeId: task.assigneeId,
    reporterId: task.reporterId,
    dueDate: day(task.dueDate),
    overdue: open && !!task.dueDate && task.dueDate < today(),
    estimateHours: num(task.estimateHours),
    position: Number(task.position),
    version: task.version,
    completedAt: task.completedAt,
    recurrence: task.recurrence,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    ...(rollup
      ? {
          childCount: rollup.childCount,
          childDone: rollup.childDone,
          // A parent's progress is the share of its subtasks that are done.
          progress: rollup.childCount
            ? Math.round((rollup.childDone / rollup.childCount) * 100)
            : null,
        }
      : {}),
  };
}

const STEP: Record<'DAILY' | 'WEEKLY' | 'MONTHLY', (d: Date) => Date> = {
  DAILY: (d) => new Date(d.getTime() + 86_400_000),
  WEEKLY: (d) => new Date(d.getTime() + 7 * 86_400_000),
  MONTHLY: (d) => {
    const next = new Date(d);
    next.setUTCMonth(next.getUTCMonth() + 1);
    return next;
  },
};

export class TasksService {
  constructor(
    private readonly repo = new PmRepository(),
    private readonly notifications = new NotificationService()
  ) {}

  // ------------------------------------------------------------------ reads

  async list(actor: PmActor, projectId: string, query: ListTasksQuery) {
    const view = await this.repo.loadProject(actor, projectId);
    const where: Prisma.PmTaskWhereInput = {
      projectId,
      organizationId: actor.organizationId,
      isDeleted: false,
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
      ...(query.milestoneId ? { milestoneId: query.milestoneId } : {}),
      ...(query.mine ? { assigneeId: actor.userId } : {}),
      ...(query.overdue ? { dueDate: { lt: today() }, completedAt: null } : {}),
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' as const } } : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.pmTask.count({ where }),
      prisma.pmTask.findMany({
        where,
        orderBy: [{ [query.sort]: query.order }, { number: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    const done = new Set(doneKeys(view.columns));
    const [rollups, hours] = await Promise.all([
      this.rollups(
        rows.map((r) => r.id),
        done
      ),
      loggedHoursFor(rows.map((r) => r.id)),
    ]);
    return {
      items: rows.map((r) => ({
        ...presentTask(r, view.project.key, done, rollups.get(r.id)),
        loggedHours: Math.round((hours.get(r.id) ?? 0) * 100) / 100,
      })),
      meta: { page: query.page, pageSize: query.pageSize, total },
    };
  }

  /** Kanban data: every column with its true count and the first cards in board order. */
  async board(
    actor: PmActor,
    projectId: string,
    query: { perColumn: number; assigneeId?: string; q?: string }
  ) {
    const view = await this.repo.loadProject(actor, projectId);
    const filter: Prisma.PmTaskWhereInput = {
      projectId,
      organizationId: actor.organizationId,
      isDeleted: false,
      parentId: null,
      ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' as const } } : {}),
    };
    const done = new Set(doneKeys(view.columns));
    const columns = await Promise.all(
      view.columns.map(async (column) => {
        const [total, cards] = await Promise.all([
          prisma.pmTask.count({ where: { ...filter, status: column.key } }),
          prisma.pmTask.findMany({
            where: { ...filter, status: column.key },
            orderBy: [{ position: 'asc' }, { number: 'asc' }],
            take: query.perColumn,
          }),
        ]);
        return { column, total, cards };
      })
    );
    const rollups = await this.rollups(
      columns.flatMap((c) => c.cards.map((t) => t.id)),
      done
    );
    const people = await this.repo.names(
      columns.flatMap((c) => c.cards.map((t) => t.assigneeId ?? ''))
    );
    return {
      project: { id: view.project.id, key: view.project.key, name: view.project.name },
      myRole: view.role,
      columns: columns.map(({ column, total, cards }) => ({
        ...column,
        total,
        hasMore: cards.length < total,
        cards: cards.map((t) => ({
          ...presentTask(t, view.project.key, done, rollups.get(t.id)),
          assignee: people.find((p) => p.id === t.assigneeId) ?? null,
        })),
      })),
    };
  }

  /** More cards for one column, continuing after `cursor` cards. */
  async columnPage(
    actor: PmActor,
    projectId: string,
    query: { status: string; cursor: number; limit: number }
  ) {
    const view = await this.repo.loadProject(actor, projectId);
    this.assertColumn(view.columns, query.status);
    const done = new Set(doneKeys(view.columns));
    const where = {
      projectId,
      organizationId: actor.organizationId,
      isDeleted: false,
      parentId: null,
      status: query.status,
    };
    const [total, cards] = await Promise.all([
      prisma.pmTask.count({ where }),
      prisma.pmTask.findMany({
        where,
        orderBy: [{ position: 'asc' }, { number: 'asc' }],
        skip: query.cursor,
        take: query.limit,
      }),
    ]);
    const rollups = await this.rollups(
      cards.map((t) => t.id),
      done
    );
    return {
      total,
      nextCursor: query.cursor + cards.length < total ? query.cursor + cards.length : null,
      cards: cards.map((t) => presentTask(t, view.project.key, done, rollups.get(t.id))),
    };
  }

  /** The caller's open tasks across every project they can see. */
  async mine(actor: PmActor, query: { page: number; pageSize: number; includeDone?: boolean }) {
    const teamIds = await this.repo.teamIdsOf(actor);
    const where: Prisma.PmTaskWhereInput = {
      organizationId: actor.organizationId,
      isDeleted: false,
      assigneeId: actor.userId,
      ...(query.includeDone ? {} : { completedAt: null }),
      project: visibleProjectsWhere(actor, teamIds),
    };
    const [total, rows] = await Promise.all([
      prisma.pmTask.count({ where }),
      prisma.pmTask.findMany({
        where,
        orderBy: [
          { dueDate: { sort: 'asc', nulls: 'last' } },
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { project: { select: { id: true, key: true, name: true, columns: true } } },
      }),
    ]);
    return {
      items: rows.map(({ project, ...task }) => ({
        ...presentTask(
          task,
          project.key,
          new Set(doneKeys(project.columns as unknown as Column[]))
        ),
        project: { id: project.id, key: project.key, name: project.name },
      })),
      meta: { page: query.page, pageSize: query.pageSize, total },
    };
  }

  async get(actor: PmActor, taskId: string) {
    const { task, view } = await this.load(actor, taskId);
    const done = new Set(doneKeys(view.columns));
    const [children, blockedBy, blocks, commentCount, milestone, hours, attachmentCount] =
      await Promise.all([
        prisma.pmTask.findMany({
          where: { parentId: taskId, isDeleted: false },
          orderBy: { number: 'asc' },
        }),
        prisma.pmTaskDependency.findMany({
          where: { taskId },
          include: { dependsOn: true },
        }),
        prisma.pmTaskDependency.findMany({
          where: { dependsOnTaskId: taskId },
          include: { task: true },
        }),
        prisma.pmTaskComment.count({ where: { taskId, isDeleted: false } }),
        task.milestoneId
          ? prisma.pmMilestone.findUnique({ where: { id: task.milestoneId } })
          : null,
        loggedHoursFor([taskId]),
        prisma.pmTaskAttachment.count({ where: { taskId, isDeleted: false } }),
      ]);
    const people = await this.repo.names([task.assigneeId ?? '', task.reporterId]);
    const brief = (t: PmTask) => ({
      id: t.id,
      key: `${view.project.key}-${t.number}`,
      title: t.title,
      status: t.status,
      done: done.has(t.status),
      assigneeId: t.assigneeId,
    });
    const childDone = children.filter((c) => done.has(c.status)).length;
    return {
      ...presentTask(task, view.project.key, done, { childCount: children.length, childDone }),
      myRole: view.role,
      project: {
        id: view.project.id,
        key: view.project.key,
        name: view.project.name,
        columns: view.columns,
      },
      assignee: people.find((p) => p.id === task.assigneeId) ?? null,
      reporter: people.find((p) => p.id === task.reporterId) ?? null,
      milestone: milestone ? { id: milestone.id, name: milestone.name } : null,
      subtasks: children.map(brief),
      blockedBy: blockedBy.filter((d) => !d.dependsOn.isDeleted).map((d) => brief(d.dependsOn)),
      blocks: blocks.filter((d) => !d.task.isDeleted).map((d) => brief(d.task)),
      commentCount,
      attachmentCount,
      loggedHours: Math.round((hours.get(taskId) ?? 0) * 100) / 100,
    };
  }

  async activity(actor: PmActor, taskId: string, page: { page: number; pageSize: number }) {
    await this.load(actor, taskId);
    const where = { taskId, organizationId: actor.organizationId };
    const [total, rows] = await Promise.all([
      prisma.pmTaskActivity.count({ where }),
      prisma.pmTaskActivity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
    ]);
    const people = await this.repo.names(rows.map((r) => r.actorId ?? ''));
    return {
      items: rows.map((r) => ({
        id: r.id,
        type: r.type,
        data: r.data,
        actorId: r.actorId,
        actorName: people.find((p) => p.id === r.actorId)?.fullName ?? null,
        createdAt: r.createdAt,
      })),
      meta: { page: page.page, pageSize: page.pageSize, total },
    };
  }

  // ------------------------------------------------------------------ writes

  async create(actor: PmActor, projectId: string, dto: CreateTaskDto) {
    requireCan(actor, 'pm:tasks:write');
    const view = await this.repo.loadProject(actor, projectId);
    this.requireContributor(view);
    const status = dto.status ?? view.columns[0].key;
    this.assertColumn(view.columns, status);
    if (dto.assigneeId) await this.assertAssignee(view, dto.assigneeId);
    if (dto.milestoneId) await this.assertMilestone(projectId, dto.milestoneId);
    if (dto.parentId) await this.assertParent(projectId, null, dto.parentId);

    const task = await this.repo.run(async (tx) => {
      const created = await this.insertTask(tx, actor, view, {
        ...dto,
        title: dto.title as string,
        status,
      });
      await this.record(tx, actor, created.id, 'created', { status, title: created.title });
      return created;
    });

    await this.audit(actor, 'pm.task.created', task.id, null, {
      key: `${view.project.key}-${task.number}`,
      title: task.title,
    });
    await this.notifyAssigned(actor, view, task);
    return presentTask(task, view.project.key, new Set(doneKeys(view.columns)));
  }

  async update(actor: PmActor, taskId: string, dto: UpdateTaskDto) {
    requireCan(actor, 'pm:tasks:write');
    const { task, view } = await this.load(actor, taskId);
    this.requireContributor(view);
    if (dto.assigneeId) await this.assertAssignee(view, dto.assigneeId);
    if (dto.milestoneId) await this.assertMilestone(view.project.id, dto.milestoneId);
    if (dto.parentId) await this.assertParent(view.project.id, taskId, dto.parentId);

    const { version, ...changes } = dto;
    const diff = this.diff(task, changes);
    const updated = await this.repo.run(async (tx) => {
      const result = await tx.pmTask.updateMany({
        where: { id: taskId, version, isDeleted: false },
        data: {
          ...(changes.title !== undefined ? { title: changes.title } : {}),
          ...(changes.description !== undefined ? { description: changes.description } : {}),
          ...(changes.priority !== undefined ? { priority: changes.priority } : {}),
          ...(changes.assigneeId !== undefined ? { assigneeId: changes.assigneeId } : {}),
          ...(changes.parentId !== undefined ? { parentId: changes.parentId } : {}),
          ...(changes.milestoneId !== undefined ? { milestoneId: changes.milestoneId } : {}),
          ...(changes.dueDate !== undefined ? { dueDate: changes.dueDate } : {}),
          ...(changes.estimateHours !== undefined ? { estimateHours: changes.estimateHours } : {}),
          ...(changes.recurrence !== undefined ? { recurrence: changes.recurrence } : {}),
          updatedBy: actor.userId,
          version: { increment: 1 },
        },
      });
      if (result.count === 0) throw await this.staleVersion(tx, taskId);
      if (Object.keys(diff).length) await this.record(tx, actor, taskId, 'updated', diff);
      return tx.pmTask.findUniqueOrThrow({ where: { id: taskId } });
    });

    await this.audit(actor, 'pm.task.updated', taskId, null, { changed: Object.keys(diff) });
    if (changes.assigneeId && changes.assigneeId !== task.assigneeId) {
      await this.notifyAssigned(actor, view, updated);
    }
    return presentTask(updated, view.project.key, new Set(doneKeys(view.columns)));
  }

  /** Change a task's column and place it in that column; the one entry point for kanban drags. */
  async move(actor: PmActor, taskId: string, dto: MoveTaskDto) {
    requireCan(actor, 'pm:tasks:write');
    const { task, view } = await this.load(actor, taskId);
    this.requireContributor(view);
    this.assertColumn(view.columns, dto.status);

    const moved = await this.repo.run((tx) =>
      this.applyMove(tx, actor, view, task, dto.status, dto.afterTaskId ?? null, dto.version)
    );
    await this.audit(
      actor,
      'pm.task.moved',
      taskId,
      { status: task.status },
      { status: moved.status }
    );
    return presentTask(moved, view.project.key, new Set(doneKeys(view.columns)));
  }

  async remove(actor: PmActor, taskId: string) {
    requireCan(actor, 'pm:tasks:write');
    const { task, view } = await this.load(actor, taskId);
    this.requireContributor(view);
    const now = new Date();
    await this.repo.run(async (tx) => {
      // The task and its subtasks go together; dependency rows stay and are ignored while deleted.
      await tx.pmTask.updateMany({
        where: { OR: [{ id: taskId }, { parentId: taskId }], isDeleted: false },
        data: { isDeleted: true, deletedAt: now, updatedBy: actor.userId },
      });
      await this.record(tx, actor, taskId, 'deleted', { title: task.title });
    });
    await this.audit(actor, 'pm.task.deleted', taskId, { title: task.title }, null);
  }

  /** Apply the same change to up to 100 tasks, all or nothing. */
  async bulkUpdate(
    actor: PmActor,
    input: {
      taskIds: string[];
      changes: {
        status?: string;
        priority?: PmTask['priority'];
        assigneeId?: string | null;
        milestoneId?: string | null;
        dueDate?: Date | null;
      };
    }
  ) {
    requireCan(actor, 'pm:tasks:write');
    const ids = [...new Set(input.taskIds)];
    const tasks = await prisma.pmTask.findMany({
      where: { id: { in: ids }, organizationId: actor.organizationId, isDeleted: false },
    });
    if (tasks.length !== ids.length) throw taskNotFound();

    const views = new Map<string, ProjectView>();
    for (const projectId of new Set(tasks.map((t) => t.projectId))) {
      const view = await this.repo.loadProject(actor, projectId);
      this.requireContributor(view);
      const { changes } = input;
      if (changes.status) this.assertColumn(view.columns, changes.status);
      if (changes.assigneeId) await this.assertAssignee(view, changes.assigneeId);
      if (changes.milestoneId) await this.assertMilestone(projectId, changes.milestoneId);
      views.set(projectId, view);
    }

    const updated = await this.repo.run(async (tx) => {
      const out: PmTask[] = [];
      for (const task of tasks) {
        const view = views.get(task.projectId) as ProjectView;
        const { status, ...rest } = input.changes;
        let current = task;
        if (Object.keys(rest).length) {
          current = await tx.pmTask.update({
            where: { id: task.id },
            data: { ...rest, updatedBy: actor.userId, version: { increment: 1 } },
          });
          await this.record(tx, actor, task.id, 'updated', this.diff(task, rest));
        }
        if (status && status !== current.status) {
          current = await this.applyMove(tx, actor, view, current, status, 'END', current.version);
        }
        out.push(current);
      }
      return out;
    });

    await this.audit(actor, 'pm.task.bulk_updated', ids[0], null, {
      count: ids.length,
      fields: Object.keys(input.changes),
    });
    return {
      updated: updated.length,
      items: updated.map((t) =>
        presentTask(
          t,
          (views.get(t.projectId) as ProjectView).project.key,
          new Set(doneKeys((views.get(t.projectId) as ProjectView).columns))
        )
      ),
    };
  }

  // ------------------------------------------------------------------ comments

  async comments(actor: PmActor, taskId: string, page: { page: number; pageSize: number }) {
    await this.load(actor, taskId);
    const where = { taskId, organizationId: actor.organizationId, isDeleted: false };
    const [total, rows] = await Promise.all([
      prisma.pmTaskComment.count({ where }),
      prisma.pmTaskComment.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
    ]);
    const people = await this.repo.names(rows.map((r) => r.authorId));
    return {
      items: rows.map((c) => ({
        id: c.id,
        body: c.body,
        authorId: c.authorId,
        authorName: people.find((p) => p.id === c.authorId)?.fullName ?? null,
        authorAvatarUrl: people.find((p) => p.id === c.authorId)?.avatarUrl ?? null,
        editedAt: c.editedAt,
        createdAt: c.createdAt,
      })),
      meta: { page: page.page, pageSize: page.pageSize, total },
    };
  }

  async addComment(actor: PmActor, taskId: string, body: string) {
    requireCan(actor, 'pm:tasks:comment');
    const { task, view } = await this.load(actor, taskId);
    this.requireContributor(view);
    const comment = await this.repo.run(async (tx) => {
      const row = await tx.pmTaskComment.create({
        data: { organizationId: actor.organizationId, taskId, authorId: actor.userId, body },
      });
      await this.record(tx, actor, taskId, 'commented', { commentId: row.id });
      return row;
    });
    // Tell the assignee, unless they wrote it themselves.
    if (task.assigneeId && task.assigneeId !== actor.userId) {
      await this.notify(
        actor,
        task.assigneeId,
        'New comment',
        `${view.project.key}-${task.number}: ${task.title}`
      );
    }
    return {
      id: comment.id,
      body: comment.body,
      authorId: comment.authorId,
      createdAt: comment.createdAt,
      editedAt: null,
    };
  }

  async editComment(actor: PmActor, taskId: string, commentId: string, body: string) {
    requireCan(actor, 'pm:tasks:comment');
    const { view } = await this.load(actor, taskId);
    this.requireContributor(view);
    const comment = await this.findComment(actor, taskId, commentId);
    if (comment.authorId !== actor.userId) {
      throw new AppError('You can only edit your own comments', 403, 'FORBIDDEN_COMMENT');
    }
    const row = await prisma.pmTaskComment.update({
      where: { id: commentId },
      data: { body, editedAt: new Date() },
    });
    return {
      id: row.id,
      body: row.body,
      authorId: row.authorId,
      createdAt: row.createdAt,
      editedAt: row.editedAt,
    };
  }

  /** The author may delete their own comment; a project lead may delete anyone's. */
  async deleteComment(actor: PmActor, taskId: string, commentId: string) {
    const { view } = await this.load(actor, taskId);
    const comment = await this.findComment(actor, taskId, commentId);
    const moderator = atLeast(view.role, 'PM_LEAD');
    if (comment.authorId !== actor.userId && !moderator) {
      throw new AppError('You can only delete your own comments', 403, 'FORBIDDEN_COMMENT');
    }
    await prisma.pmTaskComment.update({
      where: { id: commentId },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    await this.audit(actor, 'pm.task.comment_deleted', taskId, { commentId }, null);
  }

  // ------------------------------------------------------------------ dependencies

  async addDependency(actor: PmActor, taskId: string, dependsOnTaskId: string) {
    requireCan(actor, 'pm:tasks:write');
    const { task, view } = await this.load(actor, taskId);
    this.requireContributor(view);
    if (dependsOnTaskId === taskId) {
      throw new AppError('A task cannot depend on itself', 400, 'DEPENDENCY_SELF');
    }
    const other = await prisma.pmTask.findFirst({
      where: {
        id: dependsOnTaskId,
        projectId: task.projectId,
        organizationId: actor.organizationId,
        isDeleted: false,
      },
    });
    if (!other) {
      throw new AppError(
        'The blocking task must be in the same project',
        400,
        'DEPENDENCY_PROJECT'
      );
    }
    if (await this.reaches(task.projectId, dependsOnTaskId, taskId)) {
      throw new AppError('That dependency would create a loop', 409, 'DEPENDENCY_CYCLE');
    }
    try {
      await this.repo.run(async (tx) => {
        await tx.pmTaskDependency.create({
          data: { organizationId: actor.organizationId, taskId, dependsOnTaskId },
        });
        await this.record(tx, actor, taskId, 'dependency_added', { dependsOnTaskId });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError('That dependency already exists', 409, 'DEPENDENCY_EXISTS');
      }
      throw error;
    }
    return { taskId, dependsOnTaskId };
  }

  async removeDependency(actor: PmActor, taskId: string, dependsOnTaskId: string) {
    requireCan(actor, 'pm:tasks:write');
    const { view } = await this.load(actor, taskId);
    this.requireContributor(view);
    const result = await prisma.pmTaskDependency.deleteMany({
      where: { taskId, dependsOnTaskId, organizationId: actor.organizationId },
    });
    if (!result.count) throw new AppError('Dependency not found', 404, 'DEPENDENCY_NOT_FOUND');
    await prisma.pmTaskActivity.create({
      data: {
        organizationId: actor.organizationId,
        taskId,
        actorId: actor.userId,
        type: 'dependency_removed',
        data: { dependsOnTaskId },
      },
    });
  }

  // ------------------------------------------------------------------ internals

  async load(
    actor: PmActor,
    taskId: string,
    tx?: TxClient
  ): Promise<{ task: PmTask; view: ProjectView }> {
    const task = await (tx ?? prisma).pmTask.findFirst({
      where: { id: taskId, organizationId: actor.organizationId, isDeleted: false },
    });
    if (!task) throw taskNotFound();
    const view = await this.repo.loadProject(actor, task.projectId, tx).catch(() => {
      throw taskNotFound();
    });
    return { task, view };
  }

  /** Creates a task with the next number in its project; the counter update locks the project row. */
  async insertTask(
    tx: TxClient,
    actor: PmActor,
    view: ProjectView,
    input: {
      title: string;
      description?: string | null;
      status: string;
      priority?: PmTask['priority'];
      assigneeId?: string | null;
      parentId?: string | null;
      milestoneId?: string | null;
      dueDate?: Date | null;
      estimateHours?: number | null;
      recurrence?: PmTask['recurrence'];
      recurrenceParentId?: string | null;
    }
  ): Promise<PmTask> {
    const { taskCounter } = await tx.pmProject.update({
      where: { id: view.project.id },
      data: { taskCounter: { increment: 1 } },
      select: { taskCounter: true },
    });
    const last = await tx.pmTask.aggregate({
      _max: { position: true },
      where: { projectId: view.project.id, status: input.status, isDeleted: false },
    });
    const isDone = doneKeys(view.columns).includes(input.status);
    return tx.pmTask.create({
      data: {
        organizationId: actor.organizationId,
        projectId: view.project.id,
        number: taskCounter,
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        priority: input.priority ?? 'MEDIUM',
        assigneeId: input.assigneeId ?? null,
        reporterId: actor.userId,
        parentId: input.parentId ?? null,
        milestoneId: input.milestoneId ?? null,
        dueDate: input.dueDate ?? null,
        estimateHours: input.estimateHours ?? null,
        recurrence: input.recurrence ?? 'NONE',
        recurrenceParentId: input.recurrenceParentId ?? null,
        position: Number(last._max.position ?? 0) + GAP,
        completedAt: isDone ? new Date() : null,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
    });
  }

  /**
   * Moves a task to a column and a place in it. `afterTaskId` of null puts it first, 'END' last.
   * Entering a done column is refused while blockers or subtasks are open; completing a recurring
   * task creates its next occurrence exactly once.
   */
  private async applyMove(
    tx: TxClient,
    actor: PmActor,
    view: ProjectView,
    task: PmTask,
    status: string,
    afterTaskId: string | null | 'END',
    version: number
  ): Promise<PmTask> {
    const done = new Set(doneKeys(view.columns));
    const entersDone = done.has(status) && !done.has(task.status);

    if (done.has(status)) {
      const [blockers, openChildren] = await Promise.all([
        tx.pmTaskDependency.findMany({
          where: { taskId: task.id, dependsOn: { isDeleted: false, status: { notIn: [...done] } } },
          select: { dependsOn: { select: { number: true, title: true } } },
        }),
        tx.pmTask.count({
          where: { parentId: task.id, isDeleted: false, status: { notIn: [...done] } },
        }),
      ]);
      if (blockers.length) {
        throw new AppError(
          'This task is blocked by tasks that are not done',
          409,
          'BLOCKED_BY_DEPENDENCIES',
          {
            blockedBy: blockers.map((b) => `${view.project.key}-${b.dependsOn.number}`),
          }
        );
      }
      if (openChildren) {
        throw new AppError('Finish the subtasks first', 409, 'OPEN_SUBTASKS', {
          openSubtasks: openChildren,
        });
      }
    }

    const position = await this.placement(tx, view.project.id, task.id, status, afterTaskId);
    const leavingDone = done.has(task.status) && !done.has(status);
    const result = await tx.pmTask.updateMany({
      where: { id: task.id, version, isDeleted: false },
      data: {
        status,
        position,
        completedAt: done.has(status) ? (task.completedAt ?? new Date()) : null,
        // Reopening a recurring task lets it spawn again the next time it is finished.
        ...(leavingDone ? { recurrenceSpawnedAt: null } : {}),
        updatedBy: actor.userId,
        version: { increment: 1 },
      },
    });
    if (result.count === 0) throw await this.staleVersion(tx, task.id);

    if (status !== task.status) {
      await this.record(tx, actor, task.id, 'moved', { from: task.status, to: status });
    }
    const moved = await tx.pmTask.findUniqueOrThrow({ where: { id: task.id } });
    if (entersDone && moved.recurrence !== 'NONE') await this.spawnNext(tx, actor, view, moved);
    return moved;
  }

  /** Create the next occurrence of a recurring task; the conditional update makes it idempotent. */
  private async spawnNext(
    tx: TxClient,
    actor: PmActor,
    view: ProjectView,
    task: PmTask
  ): Promise<void> {
    const claimed = await tx.pmTask.updateMany({
      where: { id: task.id, recurrenceSpawnedAt: null },
      data: { recurrenceSpawnedAt: new Date() },
    });
    if (claimed.count === 0 || task.recurrence === 'NONE') return;
    const base = task.dueDate ?? today();
    const next = await this.insertTask(tx, actor, view, {
      title: task.title,
      description: task.description,
      status: view.columns[0].key,
      priority: task.priority,
      assigneeId: task.assigneeId,
      parentId: task.parentId,
      milestoneId: task.milestoneId,
      dueDate: STEP[task.recurrence](base),
      estimateHours: num(task.estimateHours),
      recurrence: task.recurrence,
      recurrenceParentId: task.recurrenceParentId ?? task.id,
    });
    await this.record(tx, actor, task.id, 'recurred', { nextTaskId: next.id });
    await this.record(tx, actor, next.id, 'created', { recurredFrom: task.id });
  }

  /** The position that puts a task after `afterTaskId`, first in the column, or last. */
  private async placement(
    tx: TxClient,
    projectId: string,
    taskId: string,
    status: string,
    afterTaskId: string | null | 'END'
  ): Promise<number> {
    const load = () =>
      tx.pmTask.findMany({
        where: { projectId, status, isDeleted: false, id: { not: taskId } },
        orderBy: [{ position: 'asc' }, { number: 'asc' }],
        select: { id: true, position: true },
      });
    let siblings = await load();

    if (afterTaskId === 'END')
      return (siblings.length ? Number(siblings[siblings.length - 1].position) : 0) + GAP;
    if (afterTaskId === null) return siblings.length ? Number(siblings[0].position) - GAP : GAP;

    let index = siblings.findIndex((s) => s.id === afterTaskId);
    if (index === -1) {
      throw new AppError(
        'The task to place it after is not in that column',
        400,
        'INVALID_POSITION'
      );
    }
    let prev = Number(siblings[index].position);
    let next = siblings[index + 1] ? Number(siblings[index + 1].position) : null;
    if (next !== null && next - prev < MIN_GAP) {
      // The gap has been halved too many times: renumber the column, then place it.
      for (const [i, sibling] of siblings.entries()) {
        await tx.pmTask.update({ where: { id: sibling.id }, data: { position: (i + 1) * GAP } });
      }
      siblings = await load();
      index = siblings.findIndex((s) => s.id === afterTaskId);
      prev = Number(siblings[index].position);
      next = siblings[index + 1] ? Number(siblings[index + 1].position) : null;
    }
    return next === null ? prev + GAP : (prev + next) / 2;
  }

  private async staleVersion(tx: TxClient, taskId: string): Promise<AppError> {
    const current = await tx.pmTask.findFirst({
      where: { id: taskId, isDeleted: false },
      select: { version: true },
    });
    if (!current) return taskNotFound();
    return new AppError(
      'This task was changed by someone else. Reload and try again.',
      409,
      'VERSION_CONFLICT',
      {
        currentVersion: current.version,
      }
    );
  }

  private async rollups(taskIds: string[], done: Set<string>): Promise<Map<string, Rollup>> {
    const map = new Map<string, Rollup>();
    if (!taskIds.length) return map;
    const rows = await prisma.pmTask.groupBy({
      by: ['parentId', 'status'],
      where: { parentId: { in: taskIds }, isDeleted: false },
      _count: { _all: true },
    });
    for (const row of rows) {
      if (!row.parentId) continue;
      const entry = map.get(row.parentId) ?? { childCount: 0, childDone: 0 };
      entry.childCount += row._count._all;
      if (done.has(row.status)) entry.childDone += row._count._all;
      map.set(row.parentId, entry);
    }
    return map;
  }

  /** True when `from` already depends, directly or through others, on `target`. */
  private async reaches(projectId: string, from: string, target: string): Promise<boolean> {
    const edges = await prisma.pmTaskDependency.findMany({
      where: { task: { projectId, isDeleted: false } },
      select: { taskId: true, dependsOnTaskId: true },
    });
    const graph = new Map<string, string[]>();
    for (const e of edges) graph.set(e.taskId, [...(graph.get(e.taskId) ?? []), e.dependsOnTaskId]);
    const seen = new Set<string>();
    const stack = [from];
    while (stack.length) {
      const id = stack.pop() as string;
      if (id === target) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...(graph.get(id) ?? []));
    }
    return false;
  }

  private async assertParent(
    projectId: string,
    taskId: string | null,
    parentId: string
  ): Promise<void> {
    if (taskId && parentId === taskId) {
      throw new AppError('A task cannot be its own parent', 400, 'PARENT_CYCLE');
    }
    let cursor: string | null = parentId;
    for (let depth = 0; cursor && depth < 10; depth += 1) {
      const row: { id: string; parentId: string | null; projectId: string } | null =
        await prisma.pmTask.findFirst({
          where: { id: cursor, isDeleted: false },
          select: { id: true, parentId: true, projectId: true },
        });
      if (!row || row.projectId !== projectId) {
        throw new AppError('The parent must be a task in the same project', 400, 'INVALID_PARENT');
      }
      if (taskId && row.parentId === taskId) {
        throw new AppError('That would make the task its own ancestor', 400, 'PARENT_CYCLE');
      }
      if (depth === 0 && row.parentId) {
        throw new AppError('Subtasks can only be one level deep', 400, 'SUBTASK_DEPTH');
      }
      cursor = row.parentId;
    }
  }

  private async assertMilestone(projectId: string, milestoneId: string): Promise<void> {
    const found = await prisma.pmMilestone.findFirst({
      where: { id: milestoneId, projectId },
      select: { id: true },
    });
    if (!found) throw new AppError('Milestone not found in this project', 400, 'INVALID_MILESTONE');
  }

  private assertAssignee(view: ProjectView, userId: string): Promise<void> {
    return this.repo.assertProjectMember(view.project.id, view.project.ownerId, userId);
  }

  private assertColumn(columns: Column[], status: string): void {
    if (!columns.some((c) => c.key === status)) {
      throw new AppError('That column does not exist on this board', 400, 'INVALID_STATUS', {
        allowed: columns.map((c) => c.key),
      });
    }
  }

  private requireContributor(view: ProjectView): void {
    if (!atLeast(view.role, 'CONTRIBUTOR')) {
      throw new AppError('Viewers cannot change tasks', 403, 'FORBIDDEN_PROJECT_ROLE');
    }
  }

  private async findComment(actor: PmActor, taskId: string, commentId: string) {
    const comment = await prisma.pmTaskComment.findFirst({
      where: { id: commentId, taskId, organizationId: actor.organizationId, isDeleted: false },
    });
    if (!comment) throw new AppError('Comment not found', 404, 'COMMENT_NOT_FOUND');
    return comment;
  }

  private diff(
    task: PmTask,
    changes: Record<string, unknown>
  ): Record<string, { from: unknown; to: unknown }> {
    const out: Record<string, { from: unknown; to: unknown }> = {};
    const before = task as unknown as Record<string, unknown>;
    for (const [field, to] of Object.entries(changes)) {
      if (to === undefined) continue;
      const from = before[field];
      const same =
        from instanceof Date && to instanceof Date
          ? from.getTime() === to.getTime()
          : from instanceof Prisma.Decimal
            ? Number(from) === Number(to)
            : from === to;
      if (!same)
        out[field] = {
          from: from instanceof Date ? day(from) : from,
          to: to instanceof Date ? day(to) : to,
        };
    }
    return out;
  }

  private record(tx: TxClient, actor: PmActor, taskId: string, type: string, data: unknown) {
    return tx.pmTaskActivity.create({
      data: {
        organizationId: actor.organizationId,
        taskId,
        actorId: actor.userId,
        type,
        data: data as Prisma.InputJsonValue,
      },
    });
  }

  private notifyAssigned(actor: PmActor, view: ProjectView, task: PmTask) {
    if (!task.assigneeId || task.assigneeId === actor.userId) return Promise.resolve();
    return this.notify(
      actor,
      task.assigneeId,
      'Task assigned to you',
      `${view.project.key}-${task.number}: ${task.title}`
    );
  }

  /** Notifications are a courtesy; a failure must never undo the change that triggered them. */
  private async notify(
    actor: PmActor,
    recipientId: string,
    title: string,
    body: string
  ): Promise<void> {
    try {
      await this.notifications.sendNotification({
        organizationId: actor.organizationId,
        recipientId,
        title,
        body,
        channels: ['in_app'],
      });
    } catch (error) {
      logger.warn('[pm] could not record a notification', { error });
    }
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
      resource: 'pm_task',
      resourceId: id,
      organizationId: actor.organizationId,
      actorId: actor.userId,
      before,
      after,
    });
  }
}
