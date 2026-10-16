import type { Prisma } from '@prisma/client';
import { AuditService } from '../../infrastructure/audit';
import { prisma } from '../../infrastructure/prisma';
import { AppError } from '../../middleware/error';
import { requireCan, type PmActor } from './pm.access';
import { DEFAULT_COLUMNS, TemplateDefinitionSchema, type TemplateDefinition } from './pm.dto';
import { PmRepository } from './pm.repository';
import { presentProject } from './projects.service';
import { TasksService } from './tasks.service';

const DAY = 86_400_000;
const plusDays = (from: Date, days: number): Date => new Date(from.getTime() + days * DAY);

const present = (row: {
  id: string;
  name: string;
  description: string | null;
  definition: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}) => {
  const definition = TemplateDefinitionSchema.parse(row.definition);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    definition,
    summary: {
      columns: definition.columns.length,
      milestones: definition.milestones.length,
      tasks: definition.tasks.length,
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

export class TemplatesService {
  constructor(
    private readonly repo = new PmRepository(),
    private readonly tasks = new TasksService()
  ) {}

  async list(actor: PmActor) {
    const rows = await prisma.pmTemplate.findMany({
      where: { organizationId: actor.organizationId, isDeleted: false },
      orderBy: { name: 'asc' },
    });
    return rows.map(present);
  }

  async get(actor: PmActor, id: string) {
    return present(await this.find(actor, id));
  }

  async create(
    actor: PmActor,
    input: { name: string; description?: string; definition: TemplateDefinition }
  ) {
    requireCan(actor, 'pm:templates:manage');
    this.assertConsistent(input.definition);
    const row = await prisma.pmTemplate.create({
      data: {
        organizationId: actor.organizationId,
        name: input.name,
        description: input.description ?? null,
        definition: input.definition as unknown as Prisma.InputJsonValue,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
    });
    await this.audit(actor, 'pm.template.created', row.id, null, { name: row.name });
    return present(row);
  }

  async update(
    actor: PmActor,
    id: string,
    input: { name?: string; description?: string; definition?: TemplateDefinition }
  ) {
    requireCan(actor, 'pm:templates:manage');
    const before = await this.find(actor, id);
    if (input.definition) this.assertConsistent(input.definition);
    const row = await prisma.pmTemplate.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.definition !== undefined
          ? { definition: input.definition as unknown as Prisma.InputJsonValue }
          : {}),
        updatedBy: actor.userId,
      },
    });
    await this.audit(actor, 'pm.template.updated', id, { name: before.name }, { name: row.name });
    return present(row);
  }

  async remove(actor: PmActor, id: string) {
    requireCan(actor, 'pm:templates:manage');
    const before = await this.find(actor, id);
    await prisma.pmTemplate.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), updatedBy: actor.userId },
    });
    await this.audit(actor, 'pm.template.deleted', id, { name: before.name }, null);
  }

  /** Snapshot a project's board, milestones and top-level tasks as a reusable template. */
  async fromProject(
    actor: PmActor,
    projectId: string,
    input: { name: string; description?: string }
  ) {
    requireCan(actor, 'pm:templates:manage');
    const view = await this.repo.loadProject(actor, projectId);
    const [milestones, tasks] = await Promise.all([
      prisma.pmMilestone.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } }),
      prisma.pmTask.findMany({
        where: { projectId, isDeleted: false, parentId: null },
        orderBy: [{ status: 'asc' }, { position: 'asc' }],
        take: 500,
      }),
    ]);
    const origin = view.project.startDate ?? view.project.createdAt;
    const offset = (date: Date | null): number | undefined =>
      date ? Math.max(0, Math.round((date.getTime() - origin.getTime()) / DAY)) : undefined;
    const names = new Map(milestones.map((m) => [m.id, m.name]));

    const definition: TemplateDefinition = {
      columns: view.columns,
      milestones: milestones.map((m) => ({ name: m.name, offsetDays: offset(m.dueDate) ?? 0 })),
      tasks: tasks.map((t) => ({
        title: t.title,
        description: t.description ?? undefined,
        priority: t.priority,
        estimateHours: t.estimateHours === null ? undefined : Number(t.estimateHours),
        // A task from a finished column starts in the first column again in the new project.
        column: view.columns.find((c) => c.key === t.status && !c.done)?.key ?? view.columns[0].key,
        milestone: t.milestoneId ? names.get(t.milestoneId) : undefined,
        offsetDays: offset(t.dueDate),
      })),
    };
    return this.create(actor, { ...input, definition });
  }

  /** Create a project, its milestones and its tasks from a template in one transaction. */
  async createProject(
    actor: PmActor,
    input: {
      templateId: string;
      key: string;
      name: string;
      startDate?: Date;
      visibility: 'PRIVATE' | 'TEAM' | 'ORG';
    }
  ) {
    requireCan(actor, 'pm:projects:write');
    if (input.visibility === 'TEAM') {
      throw new AppError(
        'Create it private or organization-wide, then link a team',
        400,
        'TEAM_REQUIRED'
      );
    }
    const template = present(await this.find(actor, input.templateId));
    const { definition } = template;
    const start = input.startDate ?? new Date(new Date().toISOString().slice(0, 10));

    try {
      const project = await this.repo.run(async (tx) => {
        const created = await tx.pmProject.create({
          data: {
            organizationId: actor.organizationId,
            key: input.key,
            name: input.name,
            status: 'PLANNED',
            visibility: input.visibility,
            ownerId: actor.userId,
            startDate: start,
            columns: definition.columns as unknown as Prisma.InputJsonValue,
            createdBy: actor.userId,
            updatedBy: actor.userId,
          },
        });
        await tx.pmProjectMember.create({
          data: { projectId: created.id, userId: actor.userId, role: 'PM_LEAD' },
        });

        const milestoneIds = new Map<string, string>();
        for (const m of definition.milestones) {
          const row = await tx.pmMilestone.create({
            data: {
              organizationId: actor.organizationId,
              projectId: created.id,
              name: m.name,
              dueDate: plusDays(start, m.offsetDays),
            },
          });
          milestoneIds.set(m.name, row.id);
        }

        const view = { project: created, role: 'PM_LEAD' as const, columns: definition.columns };
        for (const t of definition.tasks) {
          const column = definition.columns.some((c) => c.key === t.column)
            ? (t.column as string)
            : definition.columns[0].key;
          await this.tasks.insertTask(tx, actor, view, {
            title: t.title,
            description: t.description,
            status: column,
            priority: t.priority,
            estimateHours: t.estimateHours,
            milestoneId: t.milestone ? (milestoneIds.get(t.milestone) ?? null) : null,
            dueDate: t.offsetDays === undefined ? null : plusDays(start, t.offsetDays),
          });
        }
        return created;
      });
      await this.audit(actor, 'pm.project.created_from_template', project.id, null, {
        templateId: input.templateId,
        tasks: definition.tasks.length,
      });
      return presentProject(project, 'PM_LEAD');
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new AppError('That project key is already used', 409, 'KEY_TAKEN');
      }
      throw error;
    }
  }

  private async find(actor: PmActor, id: string) {
    const row = await prisma.pmTemplate.findFirst({
      where: { id, organizationId: actor.organizationId, isDeleted: false },
    });
    if (!row) throw new AppError('Template not found', 404, 'TEMPLATE_NOT_FOUND');
    return row;
  }

  /** Task columns and milestone names must exist in the template itself. */
  private assertConsistent(definition: TemplateDefinition): void {
    const columns = new Set((definition.columns ?? DEFAULT_COLUMNS).map((c) => c.key));
    const milestones = new Set(definition.milestones.map((m) => m.name));
    for (const task of definition.tasks) {
      if (task.column && !columns.has(task.column)) {
        throw new AppError(
          `Task "${task.title}" uses a column the template does not have`,
          400,
          'INVALID_TEMPLATE'
        );
      }
      if (task.milestone && !milestones.has(task.milestone)) {
        throw new AppError(
          `Task "${task.title}" uses an unknown milestone`,
          400,
          'INVALID_TEMPLATE'
        );
      }
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
      resource: 'pm_template',
      resourceId: id,
      organizationId: actor.organizationId,
      actorId: actor.userId,
      before,
      after,
    });
  }
}
