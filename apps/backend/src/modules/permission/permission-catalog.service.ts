import { AppError } from '../../middleware/error';
import { AuditService } from '../../infrastructure/audit';
import { PermissionRepository } from './permission.repository';
import { MenuService } from '../../services/auth/menu.service';
import {
  CreateIamPermissionDto,
  CreatePermissionGroupDto,
  IamPermissionListQuery,
  UpdateIamPermissionDto,
} from './permission.dto';

type PermissionRow = Awaited<ReturnType<PermissionRepository['search']>>['data'][number];

const toView = (p: PermissionRow) => ({
  id: p.id,
  key: p.key,
  name: p.name,
  resource: p.resource,
  action: p.action,
  description: p.description,
  groupId: p.group?.id ?? null,
  groupName: p.group?.name ?? null,
  roleCount: p._count.rolePermissions,
  resourceActionCount: p._count.resourceActions,
  isWildcard: p.key.includes('*'),
  createdAt: p.createdAt.toISOString(),
});

/**
 * The global permission catalog (`resource:action` keys). Keys are immutable
 * once created because code and role grants reference them; only metadata
 * can change, and a permission can be deleted only while nothing uses it.
 */
export class PermissionCatalogService {
  constructor(private readonly repo = new PermissionRepository()) {}

  async list(query: IamPermissionListQuery) {
    await MenuService.ensureNavigationPermissions();
    const [{ data, total }, resources] = await Promise.all([
      this.repo.search(query),
      this.repo.distinctResources(),
    ]);
    return {
      data: data.map(toView),
      resources: resources.map((r) => r.resource).filter((r): r is string => !!r),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async get(id: string) {
    const row = await this.repo.findWithUsage(id);
    if (!row) throw new AppError('Permission not found', 404, 'PERMISSION_NOT_FOUND');
    return {
      ...toView(row),
      roles: row.rolePermissions.map((rp) => ({
        roleId: rp.role.id,
        roleName: rp.role.name,
        roleKey: rp.role.key,
        effect: rp.effect as 'allow' | 'deny',
      })),
    };
  }

  async create(dto: CreateIamPermissionDto, actorId: string, organizationId: string) {
    const key = `${dto.resource}:${dto.action}`;
    if (await this.repo.findByKey(key)) {
      throw new AppError(`Permission '${key}' already exists.`, 409, 'PERMISSION_EXISTS');
    }
    if (dto.groupId) await this.requireGroup(dto.groupId);
    const created = await this.repo.create({
      name: `${dto.action}:${dto.resource}`,
      key,
      resource: dto.resource,
      action: dto.action,
      description: dto.description ?? null,
      groupId: dto.groupId ?? null,
    });
    await this.audit(organizationId, actorId, 'permission.created', created.id, { after: { key } });
    return this.get(created.id);
  }

  async update(id: string, dto: UpdateIamPermissionDto, actorId: string, organizationId: string) {
    const existing = await this.get(id);
    if (dto.groupId) await this.requireGroup(dto.groupId);
    await this.repo.update(id, {
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.groupId !== undefined && { groupId: dto.groupId }),
    });
    await this.audit(organizationId, actorId, 'permission.updated', id, {
      before: { description: existing.description, groupId: existing.groupId },
      after: dto,
    });
    return this.get(id);
  }

  async remove(id: string, actorId: string, organizationId: string) {
    const existing = await this.get(id);
    if (existing.isWildcard) {
      throw new AppError('Wildcard permissions cannot be deleted.', 403, 'PERMISSION_PROTECTED');
    }
    if (existing.roleCount > 0 || existing.resourceActionCount > 0) {
      throw new AppError(
        `'${existing.key}' is still granted by ${existing.roleCount} role(s). Remove those grants first.`,
        409,
        'PERMISSION_IN_USE'
      );
    }
    await this.repo.delete(id);
    await this.audit(organizationId, actorId, 'permission.deleted', id, {
      before: { key: existing.key },
    });
    return { success: true };
  }

  async listGroups() {
    const groups = await this.repo.listGroups();
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      permissionCount: g._count.permissions,
    }));
  }

  async createGroup(dto: CreatePermissionGroupDto, actorId: string, organizationId: string) {
    if (await this.repo.findGroupByName(dto.name)) {
      throw new AppError(`Group '${dto.name}' already exists.`, 409, 'PERMISSION_GROUP_EXISTS');
    }
    const group = await this.repo.createGroup({
      name: dto.name,
      description: dto.description ?? null,
    });
    await this.audit(organizationId, actorId, 'permission_group.created', group.id, { after: dto });
    return { ...group, createdAt: group.createdAt.toISOString(), permissionCount: 0 };
  }

  private async requireGroup(id: string) {
    if (!(await this.repo.findGroup(id))) {
      throw new AppError('Permission group not found', 404, 'PERMISSION_GROUP_NOT_FOUND');
    }
  }

  private audit(
    organizationId: string,
    actorId: string,
    action: string,
    resourceId: string,
    detail: { before?: object; after?: object }
  ) {
    return AuditService.log({
      organizationId,
      actorId,
      action,
      resource: 'permission',
      resourceId,
      severity: 'warning',
      before: detail.before as Record<string, unknown> | undefined,
      after: detail.after as Record<string, unknown> | undefined,
    });
  }
}
