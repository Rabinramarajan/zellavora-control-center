import { AuditService } from '../../infrastructure/audit';
import { prisma } from '../../infrastructure/prisma';
import { AppError } from '../../middleware/error';
import { atLeast, requireCan, type PmActor } from './pm.access';
import { PmRepository } from './pm.repository';
import { TasksService } from './tasks.service';

const DAY = 86_400_000;
const day = (d: Date): string => d.toISOString().slice(0, 10);

export class TimeService {
  constructor(
    private readonly repo = new PmRepository(),
    private readonly tasks = new TasksService()
  ) {}

  async list(actor: PmActor, taskId: string) {
    await this.tasks.load(actor, taskId);
    const rows = await prisma.pmTimeEntry.findMany({
      where: { taskId, organizationId: actor.organizationId, isDeleted: false },
      orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
    const people = await this.repo.names(rows.map((r) => r.userId));
    const total = rows.reduce((sum, r) => sum + Number(r.hours), 0);
    return {
      total: Math.round(total * 100) / 100,
      entries: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        userName: people.find((p) => p.id === r.userId)?.fullName ?? null,
        workDate: day(r.workDate),
        hours: Number(r.hours),
        note: r.note,
        createdAt: r.createdAt,
      })),
    };
  }

  async log(
    actor: PmActor,
    taskId: string,
    input: { hours: number; workDate: Date; note?: string | null }
  ) {
    requireCan(actor, 'pm:tasks:write');
    const { view } = await this.tasks.load(actor, taskId);
    this.assertCanLog(view.role, view.project.status);
    await this.assertDay(actor, input.workDate, input.hours);

    const row = await prisma.pmTimeEntry.create({
      data: {
        organizationId: actor.organizationId,
        projectId: view.project.id,
        taskId,
        userId: actor.userId,
        workDate: input.workDate,
        hours: input.hours,
        note: input.note ?? null,
      },
    });
    await prisma.pmTaskActivity.create({
      data: {
        organizationId: actor.organizationId,
        taskId,
        actorId: actor.userId,
        type: 'time_logged',
        data: { hours: input.hours, workDate: day(input.workDate) },
      },
    });
    await this.audit(actor, 'pm.task.time_logged', taskId, null, {
      hours: input.hours,
      workDate: day(input.workDate),
    });
    return { id: row.id, hours: Number(row.hours), workDate: day(row.workDate) };
  }

  async update(
    actor: PmActor,
    taskId: string,
    entryId: string,
    input: { hours?: number; workDate?: Date; note?: string | null }
  ) {
    requireCan(actor, 'pm:tasks:write');
    const { view } = await this.tasks.load(actor, taskId);
    this.assertCanLog(view.role, view.project.status);
    const entry = await this.find(actor, taskId, entryId);
    if (entry.userId !== actor.userId) {
      throw new AppError('You can only change your own time', 403, 'FORBIDDEN_TIME');
    }
    const hours = input.hours ?? Number(entry.hours);
    const workDate = input.workDate ?? entry.workDate;
    await this.assertDay(actor, workDate, hours, entryId);
    const row = await prisma.pmTimeEntry.update({
      where: { id: entryId },
      data: {
        ...(input.hours !== undefined ? { hours: input.hours } : {}),
        ...(input.workDate !== undefined ? { workDate: input.workDate } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
    });
    await this.audit(
      actor,
      'pm.task.time_changed',
      taskId,
      { hours: Number(entry.hours) },
      { hours: Number(row.hours) }
    );
    return { id: row.id, hours: Number(row.hours), workDate: day(row.workDate) };
  }

  /** Own entries, or any entry for a project lead. */
  async remove(actor: PmActor, taskId: string, entryId: string) {
    requireCan(actor, 'pm:tasks:write');
    const { view } = await this.tasks.load(actor, taskId);
    this.assertCanLog(view.role, view.project.status);
    const entry = await this.find(actor, taskId, entryId);
    if (entry.userId !== actor.userId && !atLeast(view.role, 'PM_LEAD')) {
      throw new AppError('You can only remove your own time', 403, 'FORBIDDEN_TIME');
    }
    await prisma.pmTimeEntry.update({
      where: { id: entryId },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    await this.audit(
      actor,
      'pm.task.time_removed',
      taskId,
      { hours: Number(entry.hours), userId: entry.userId },
      null
    );
  }

  private async find(actor: PmActor, taskId: string, entryId: string) {
    const entry = await prisma.pmTimeEntry.findFirst({
      where: { id: entryId, taskId, organizationId: actor.organizationId, isDeleted: false },
    });
    if (!entry) throw new AppError('Time entry not found', 404, 'TIME_NOT_FOUND');
    return entry;
  }

  private assertCanLog(role: Parameters<typeof atLeast>[0], status: string): void {
    if (!atLeast(role, 'CONTRIBUTOR')) {
      throw new AppError('Viewers cannot log time', 403, 'FORBIDDEN_PROJECT_ROLE');
    }
    if (status === 'ARCHIVED') {
      throw new AppError('This project is archived', 409, 'PROJECT_ARCHIVED');
    }
  }

  /** No time in the future, and no more than 24 hours a day across all tasks. */
  private async assertDay(
    actor: PmActor,
    workDate: Date,
    hours: number,
    ignoreEntryId?: string
  ): Promise<void> {
    if (workDate.getTime() > Date.now() + DAY) {
      throw new AppError('You cannot log time in the future', 400, 'FUTURE_DATE');
    }
    const others = await prisma.pmTimeEntry.aggregate({
      _sum: { hours: true },
      where: {
        organizationId: actor.organizationId,
        userId: actor.userId,
        workDate,
        isDeleted: false,
        ...(ignoreEntryId ? { id: { not: ignoreEntryId } } : {}),
      },
    });
    if (Number(others._sum.hours ?? 0) + hours > 24) {
      throw new AppError('That is more than 24 hours on one day', 400, 'TOO_MANY_HOURS');
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
