import { AppError } from '../../middleware/error';
import { AuditService } from '../../infrastructure/audit';
import { cacheDelPattern } from '../../infrastructure/cache';
import { RoleRepository } from './role.repository';
import { RoleMapper } from './role.mapper';
import {
  CreateRoleDto,
  UpdateRoleDto,
  RoleListQueryDto,
  SetRolePermissionsDto,
  CopyRoleDto,
} from './role.dto';

const ROLE_CACHE_PREFIX = 'iam:roles:';

const slugify = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

/**
 * IAM Roles module service.
 *
 * Roles group permissions. A role's `key` is globally unique and stable so
 * permission checks (and the RBAC engine) can reference roles by key. Permission
 * assignment is diff-based (`replace`/`merge`) so clients can send the full
 * desired matrix and let the service reconcile the delta.
 */
export class RoleService {
  private readonly repo: RoleRepository;

  constructor(repo?: RoleRepository) {
    this.repo = repo ?? new RoleRepository();
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  async list(query: RoleListQueryDto) {
    const { data, total } = await this.repo.list(query);
    const rows = data.map((row) => RoleMapper.toListItem(row as never));
    const totalPages = Math.ceil(total / query.pageSize);
    return { data: rows, meta: { page: query.page, pageSize: query.pageSize, total, totalPages } };
  }

  async listAll() {
    const rows = await this.repo.listAll();
    return rows.map((row) => RoleMapper.toListItem(row as never));
  }

  async getById(id: string) {
    const row = await this.repo.findByIdWithPermissions(id);
    if (!row) {
      throw new AppError('Role not found', 404, 'ROLE_NOT_FOUND');
    }
    return RoleMapper.toDetail(row as never);
  }

  async listPermissions(roleId: string) {
    const role = await this.repo.findById(roleId);
    if (!role) {
      throw new AppError('Role not found', 404, 'ROLE_NOT_FOUND');
    }
    const rows = await this.repo.listPermissions(roleId);
    return rows.map((rp) => ({
      id: rp.id,
      permissionId: rp.permissionId,
      permissionKey: rp.permission.key,
      permissionName: rp.permission.name,
      resource: rp.permission.resource ?? null,
      action: rp.permission.action ?? null,
      effect: rp.effect as 'allow' | 'deny',
    }));
  }

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  async create(dto: CreateRoleDto, actorId?: string | null) {
    const key = slugify(dto.name);
    const existingKey = await this.repo.findByKey(key);
    if (existingKey) {
      throw new AppError(`A role with key '${key}' already exists`, 409, 'ROLE_KEY_EXISTS');
    }

    const created = await this.repo.create({
      name: dto.name,
      key,
      organizationId: dto.organizationId ?? null,
      description: dto.description ?? null,
      scope: dto.scope,
      status: dto.status,
      isSystem: dto.isSystem,
      createdBy: actorId ?? null,
    });

    await AuditService.log({
      action: 'role.created',
      resource: 'role',
      resourceId: created.id,
      severity: 'info',
      metadata: { key, name: dto.name, scope: dto.scope },
    });

    this.invalidate();
    return this.getById(created.id);
  }

  async update(id: string, dto: UpdateRoleDto, actorId?: string | null) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new AppError('Role not found', 404, 'ROLE_NOT_FOUND');
    }
    if (existing.isSystem && dto.name && dto.name !== existing.name) {
      throw new AppError('System role names cannot be renamed', 403, 'SYSTEM_ROLE');
    }

    const updated = await this.repo.update(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      updatedBy: actorId ?? null,
    });

    await AuditService.log({
      action: 'role.updated',
      resource: 'role',
      resourceId: id,
      severity: 'info',
      metadata: { key: existing.key, name: updated.name },
    });

    this.invalidate();
    return this.getById(id);
  }

  async delete(id: string, actorId?: string | null) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new AppError('Role not found', 404, 'ROLE_NOT_FOUND');
    }
    if (existing.isSystem) {
      throw new AppError('System roles cannot be deleted', 403, 'SYSTEM_ROLE');
    }

    await this.repo.transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.userRoleAssignment.deleteMany({ where: { roleId: id } });
      await tx.groupRole.deleteMany({ where: { roleId: id } });
      await this.repo.softDelete(id, actorId ?? null, tx);
    });

    await AuditService.log({
      action: 'role.deleted',
      resource: 'role',
      resourceId: id,
      severity: 'warning',
      metadata: { key: existing.key, name: existing.name },
    });

    this.invalidate();
    return { success: true };
  }

  async setPermissions(roleId: string, dto: SetRolePermissionsDto, actorId?: string | null) {
    const role = await this.repo.findById(roleId);
    if (!role) {
      throw new AppError('Role not found', 404, 'ROLE_NOT_FOUND');
    }
    if (role.isSystem && dto.mode === 'replace') {
      throw new AppError('System role permissions must be merged, not replaced', 403, 'SYSTEM_ROLE');
    }

    const orgId = role.organizationId ?? 'platform';
    const before = await this.repo.listPermissions(roleId);

    await this.repo.transaction(async (tx) => {
      if (dto.mode === 'replace') {
        await this.repo.replacePermissions(roleId, orgId, dto.permissions, tx);
      } else {
        await this.repo.upsertPermissions(roleId, orgId, dto.permissions, tx);
      }
      await tx.role.update({
        where: { id: roleId },
        data: { updatedBy: actorId ?? null },
      });
    });

    const after = await this.repo.listPermissions(roleId);
    await AuditService.log({
      action: 'role.permissions.set',
      resource: 'role',
      resourceId: roleId,
      severity: dto.mode === 'replace' ? 'warning' : 'info',
      before: { permissionIds: before.map((p) => p.permissionId) },
      after: { permissionIds: after.map((p) => p.permissionId) },
      metadata: { key: role.key, mode: dto.mode, granted: dto.permissions.length },
    });

    this.invalidate();
    return this.listPermissions(roleId);
  }

  async copy(id: string, dto: CopyRoleDto, actorId?: string | null) {
    const source = await this.repo.findById(id);
    if (!source) {
      throw new AppError('Role not found', 404, 'ROLE_NOT_FOUND');
    }

    const key = slugify(dto.name);
    const existingKey = await this.repo.findByKey(key);
    if (existingKey) {
      throw new AppError(`A role with key '${key}' already exists`, 409, 'ROLE_KEY_EXISTS');
    }

    const copy = await this.repo.transaction(async (tx) => {
      const created = await this.repo.create(
        {
          name: dto.name,
          key,
          organizationId: source.organizationId ?? null,
          description: dto.description ?? source.description ?? null,
          scope: source.scope,
          status: source.status,
          createdBy: actorId ?? null,
        },
        tx
      );
      if (dto.includePermissions) {
        await this.repo.copyPermissions(source.id, created.id, tx);
      }
      return created;
    });

    await AuditService.log({
      action: 'role.copied',
      resource: 'role',
      resourceId: copy.id,
      severity: 'info',
      metadata: { sourceKey: source.key, targetKey: key, includePermissions: dto.includePermissions },
    });

    this.invalidate();
    return this.getById(copy.id);
  }

  private invalidate() {
    void cacheDelPattern(`${ROLE_CACHE_PREFIX}*`);
  }
}
