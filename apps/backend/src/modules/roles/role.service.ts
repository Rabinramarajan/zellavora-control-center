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

  /** Role counts per status and scope, for the list screen's quick filters. */
  async stats() {
    const [byStatus, byScope] = await Promise.all([
      this.repo.countBy('status'),
      this.repo.countBy('scope'),
    ]);
    const toMap = (
      rows: Array<Record<string, unknown> & { _count: { _all: number } }>,
      key: string
    ) => Object.fromEntries(rows.map((r) => [String(r[key]), r._count._all]));
    const status = toMap(byStatus as never, 'status');
    return {
      total: Object.values(status).reduce((sum, n) => sum + n, 0),
      byStatus: status,
      byScope: toMap(byScope as never, 'scope'),
    };
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

  /** System roles are seeded only; they cannot be created through the API. */
  async create(dto: CreateRoleDto, actorId?: string | null, actorOrgId?: string | null) {
    await this.assertNameFree(dto.name);
    const key = await this.uniqueKey(dto.name);

    const created = await this.repo.create({
      name: dto.name,
      key,
      organizationId: dto.organizationId ?? actorOrgId ?? null,
      description: dto.description ?? null,
      scope: dto.scope,
      status: dto.status,
      isSystem: false,
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
    if (existing.isSystem && dto.scope && dto.scope !== existing.scope) {
      throw new AppError('System role scope cannot be changed', 403, 'SYSTEM_ROLE');
    }
    if (dto.name) await this.assertNameFree(dto.name, id);

    const updated = await this.repo.update(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.scope !== undefined ? { scope: dto.scope } : {}),
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

  async setPermissions(
    roleId: string,
    dto: SetRolePermissionsDto,
    actorId?: string | null,
    actorOrgId?: string | null
  ) {
    const role = await this.repo.findById(roleId);
    if (!role) {
      throw new AppError('Role not found', 404, 'ROLE_NOT_FOUND');
    }
    if (role.isSystem && dto.mode === 'replace') {
      throw new AppError(
        'System role permissions must be merged, not replaced',
        403,
        'SYSTEM_ROLE'
      );
    }
    // role_permissions.organization_id is a required uuid; platform roles take the caller's org.
    const orgId = role.organizationId ?? actorOrgId;
    if (!orgId) {
      throw new AppError('No organization to scope these permissions to', 400, 'NO_ORGANIZATION');
    }
    const permissionIds = [...new Set(dto.permissions.map((p) => p.permissionId))];
    if (
      permissionIds.length &&
      (await this.repo.countPermissions(permissionIds)) !== permissionIds.length
    ) {
      throw new AppError('One or more permissions do not exist', 400, 'INVALID_PERMISSION');
    }

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
    await this.assertNameFree(dto.name);
    const key = await this.uniqueKey(dto.name);

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
      metadata: {
        sourceKey: source.key,
        targetKey: key,
        includePermissions: dto.includePermissions,
      },
    });

    this.invalidate();
    return this.getById(copy.id);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async assertNameFree(name: string, exceptId?: string): Promise<void> {
    const dup = await this.repo.findByName(name);
    if (dup && dup.id !== exceptId) {
      throw new AppError(`A role named '${name}' already exists`, 409, 'ROLE_NAME_EXISTS');
    }
  }

  /** Keys stay unique even when different names slugify alike (e.g. "HR Admin" / "HR-Admin"). */
  private async uniqueKey(name: string): Promise<string> {
    const base = slugify(name) || 'role';
    let key = base;
    for (let n = 2; await this.repo.findByKey(key); n++) key = `${base}_${n}`;
    return key;
  }

  private invalidate() {
    void cacheDelPattern(`${ROLE_CACHE_PREFIX}*`);
  }
}
