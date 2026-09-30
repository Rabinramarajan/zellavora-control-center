import { AppError } from '../../middleware/error';
import { AuditService } from '../../infrastructure/audit';
import { DepartmentsRepository } from './departments.repository';
import { CreateDepartmentDto, DepartmentListQuery, UpdateDepartmentDto } from './departments.dto';

type DepartmentRow = NonNullable<Awaited<ReturnType<DepartmentsRepository['findById']>>>;

const toView = (d: DepartmentRow) => ({
  id: d.id,
  name: d.name,
  code: d.code,
  description: d.description,
  status: d.status as 'active' | 'inactive',
  parentId: d.parentId,
  parentName: d.parent?.name ?? null,
  memberCount: d._count.userTenants,
  childCount: d._count.children,
  createdAt: d.createdAt.toISOString(),
  updatedAt: d.updatedAt.toISOString(),
});

/** Departments form a per-organization tree; members are org memberships. */
export class DepartmentsService {
  constructor(private readonly repo = new DepartmentsRepository()) {}

  async list(organizationId: string, query: DepartmentListQuery) {
    const { data, total } = await this.repo.list(organizationId, query);
    return {
      data: data.map(toView),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async get(organizationId: string, id: string) {
    const [department, members] = await Promise.all([
      this.require(organizationId, id),
      this.repo.listMembers(organizationId, id),
    ]);
    return {
      ...toView(department),
      members: members.map((m) => ({
        userId: m.user.id,
        fullName: m.user.fullName,
        email: m.user.email,
        jobTitle: m.user.jobTitle,
        avatarUrl: m.user.avatarUrl,
        status: m.user.status,
      })),
    };
  }

  async create(organizationId: string, dto: CreateDepartmentDto, actorId: string) {
    await this.assertNameFree(organizationId, dto.name);
    if (dto.parentId) await this.require(organizationId, dto.parentId);
    const created = await this.repo.create({
      organizationId,
      name: dto.name,
      code: dto.code || null,
      description: dto.description ?? null,
      parentId: dto.parentId ?? null,
      status: dto.status,
      createdBy: actorId,
    });
    await this.audit(organizationId, actorId, 'department.created', created.id, { after: dto });
    return this.get(organizationId, created.id);
  }

  async update(organizationId: string, id: string, dto: UpdateDepartmentDto, actorId: string) {
    const existing = await this.require(organizationId, id);
    if (dto.name && dto.name.toLowerCase() !== existing.name.toLowerCase()) {
      await this.assertNameFree(organizationId, dto.name);
    }
    if (dto.parentId) {
      await this.require(organizationId, dto.parentId);
      await this.assertNoCycle(organizationId, id, dto.parentId);
    }
    await this.repo.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.code !== undefined && { code: dto.code || null }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.parentId !== undefined && { parentId: dto.parentId }),
      ...(dto.status !== undefined && { status: dto.status }),
      updatedBy: actorId,
    });
    await this.audit(organizationId, actorId, 'department.updated', id, {
      before: { name: existing.name, parentId: existing.parentId, status: existing.status },
      after: dto,
    });
    return this.get(organizationId, id);
  }

  async remove(organizationId: string, id: string, actorId: string) {
    const existing = await this.require(organizationId, id);
    if (existing._count.children > 0) {
      throw new AppError(
        'Move or delete the sub-departments first.',
        409,
        'DEPARTMENT_HAS_CHILDREN'
      );
    }
    await this.repo.softDelete(id, organizationId, actorId);
    await this.audit(organizationId, actorId, 'department.deleted', id, {
      before: { name: existing.name },
    });
    return { success: true };
  }

  async addMembers(organizationId: string, id: string, userIds: string[], actorId: string) {
    await this.require(organizationId, id);
    const { count } = await this.repo.assignMembers(organizationId, id, userIds);
    if (count === 0) {
      throw new AppError(
        'None of the selected users belong to this organization.',
        400,
        'NO_MEMBERS'
      );
    }
    await this.audit(organizationId, actorId, 'department.members_added', id, {
      metadata: { userIds },
    });
    return this.get(organizationId, id);
  }

  async removeMember(organizationId: string, id: string, userId: string, actorId: string) {
    await this.require(organizationId, id);
    await this.repo.removeMember(organizationId, id, userId);
    await this.audit(organizationId, actorId, 'department.member_removed', id, {
      metadata: { userId },
    });
    return this.get(organizationId, id);
  }

  private async require(organizationId: string, id: string) {
    const department = await this.repo.findById(id, organizationId);
    if (!department) throw new AppError('Department not found', 404, 'DEPARTMENT_NOT_FOUND');
    return department;
  }

  private async assertNameFree(organizationId: string, name: string) {
    if (await this.repo.findByName(organizationId, name)) {
      throw new AppError(`A department named '${name}' already exists.`, 409, 'DEPARTMENT_EXISTS');
    }
  }

  /** Reject a parent that is the department itself or one of its descendants. */
  private async assertNoCycle(organizationId: string, id: string, parentId: string) {
    const parents = new Map(
      (await this.repo.parentMap(organizationId)).map((d) => [d.id, d.parentId])
    );
    let cursor: string | null | undefined = parentId;
    while (cursor) {
      if (cursor === id) {
        throw new AppError(
          'A department cannot be moved under itself or its sub-departments.',
          400,
          'DEPARTMENT_CYCLE'
        );
      }
      cursor = parents.get(cursor);
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
      resource: 'department',
      resourceId,
      before: detail.before as Record<string, unknown> | undefined,
      after: detail.after as Record<string, unknown> | undefined,
      metadata: detail.metadata,
    });
  }
}
