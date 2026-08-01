import { AppError } from '../../middleware/error';
import { AuditService } from '../../infrastructure/audit';
import { cacheDelPattern } from '../../infrastructure/cache';
import { GroupRepository } from './group.repository';
import { GroupMapper } from './group.mapper';
import {
  CreateGroupDto,
  UpdateGroupDto,
  GroupListQueryDto,
  AddGroupMembersDto,
  SetGroupRolesDto,
} from './group.dto';

const GROUP_CACHE_PREFIX = 'iam:groups:';

const slugify = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * IAM Groups module service.
 *
 * Groups provide a second dimension of RBAC: users are assigned to groups, and
 * groups carry roles. Memberships and group roles can be nested via the parent
 * hierarchy, so effective permissions cascade down the tree. Group slugs are
 * globally unique and stable for reference.
 */
export class GroupService {
  private readonly repo: GroupRepository;

  constructor(repo?: GroupRepository) {
    this.repo = repo ?? new GroupRepository();
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  async list(query: GroupListQueryDto) {
    const { data, total } = await this.repo.list(query);
    const rows = data.map((row) => GroupMapper.toListItem(row as never));
    const totalPages = Math.ceil(total / query.pageSize);
    return { data: rows, meta: { page: query.page, pageSize: query.pageSize, total, totalPages } };
  }

  async tree() {
    const rows = await this.repo.listTree();
    const mapped = rows.map((row) => GroupMapper.toListItem(row as never));
    const byParent = new Map<string | null, (typeof mapped)[number][]>();
    for (const node of mapped) {
      const list = byParent.get(node.parentId) ?? [];
      list.push(node);
      byParent.set(node.parentId, list);
    }
    const attach = (parentId: string | null): Array<(typeof mapped)[number] & { children: unknown[] }> =>
      (byParent.get(parentId) ?? []).map((node) => ({
        ...node,
        children: attach(node.id),
      }));
    return attach(null);
  }

  async getById(id: string) {
    const row = await this.repo.findByIdDetail(id);
    if (!row) {
      throw new AppError('Group not found', 404, 'GROUP_NOT_FOUND');
    }
    return GroupMapper.toDetail(row as never);
  }

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  async create(dto: CreateGroupDto, actorId?: string | null) {
    const existingName = await this.repo.findByName(dto.name);
    if (existingName) {
      throw new AppError(`A group named '${dto.name}' already exists`, 409, 'GROUP_NAME_EXISTS');
    }
    const slug = slugify(dto.name);
    if (dto.parentId) {
      const parent = await this.repo.findById(dto.parentId);
      if (!parent) {
        throw new AppError('Parent group not found', 404, 'PARENT_GROUP_NOT_FOUND');
      }
    }
    if (dto.memberIds.length) {
      const existing = await this.repo.countWhere({ id: { in: dto.memberIds } });
      if (existing !== dto.memberIds.length) {
        throw new AppError('One or more member users do not exist', 400, 'INVALID_MEMBER');
      }
    }

    const created = await this.repo.transaction(async (tx) => {
      const group = await this.repo.create(
        {
          name: dto.name,
          slug,
          type: dto.type,
          status: dto.status,
          description: dto.description ?? null,
          parentId: dto.parentId ?? null,
          ownerId: dto.ownerId ?? null,
          createdBy: actorId ?? null,
        },
        tx
      );
      if (dto.memberIds.length) {
        await this.repo.addMembers(group.id, dto.memberIds, tx);
      }
      if (dto.roleIds.length) {
        await this.repo.replaceRoles(group.id, dto.roleIds, tx);
      }
      return group;
    });

    await AuditService.log({
      action: 'group.created',
      resource: 'group',
      resourceId: created.id,
      severity: 'info',
      metadata: { slug, name: dto.name, type: dto.type, members: dto.memberIds.length, roles: dto.roleIds.length },
    });

    this.invalidate();
    return this.getById(created.id);
  }

  async update(id: string, dto: UpdateGroupDto, actorId?: string | null) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new AppError('Group not found', 404, 'GROUP_NOT_FOUND');
    }
    if (existing.isSystem && dto.name && dto.name !== existing.name) {
      throw new AppError('System group names cannot be renamed', 403, 'SYSTEM_GROUP');
    }
    if (dto.name) {
      const dup = await this.repo.findByName(dto.name);
      if (dup && dup.id !== id) {
        throw new AppError(`A group named '${dto.name}' already exists`, 409, 'GROUP_NAME_EXISTS');
      }
    }
    if (dto.parentId === id) {
      throw new AppError('A group cannot be its own parent', 400, 'INVALID_PARENT');
    }
    if (dto.parentId) {
      const parent = await this.repo.findById(dto.parentId);
      if (!parent) {
        throw new AppError('Parent group not found', 404, 'PARENT_GROUP_NOT_FOUND');
      }
    }

    const updated = await this.repo.update(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
      ...(dto.ownerId !== undefined ? { ownerId: dto.ownerId } : {}),
      updatedBy: actorId ?? null,
    });

    await AuditService.log({
      action: 'group.updated',
      resource: 'group',
      resourceId: id,
      severity: 'info',
      metadata: { slug: existing.slug, name: updated.name },
    });

    this.invalidate();
    return this.getById(id);
  }

  async delete(id: string, actorId?: string | null) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new AppError('Group not found', 404, 'GROUP_NOT_FOUND');
    }
    if (existing.isSystem) {
      throw new AppError('System groups cannot be deleted', 403, 'SYSTEM_GROUP');
    }
    if (existing._count?.children && existing._count.children > 0) {
      throw new AppError('Cannot delete a group with child groups', 409, 'GROUP_HAS_CHILDREN');
    }

    await this.repo.transaction(async (tx) => {
      await tx.userGroup.deleteMany({ where: { groupId: id } });
      await tx.groupRole.deleteMany({ where: { groupId: id } });
      await this.repo.softDelete(id, actorId ?? null, tx);
    });

    await AuditService.log({
      action: 'group.deleted',
      resource: 'group',
      resourceId: id,
      severity: 'warning',
      metadata: { slug: existing.slug, name: existing.name },
    });

    this.invalidate();
    return { success: true };
  }

  async addMembers(id: string, dto: AddGroupMembersDto, actorId?: string | null) {
    const group = await this.repo.findById(id);
    if (!group) {
      throw new AppError('Group not found', 404, 'GROUP_NOT_FOUND');
    }
    await this.repo.transaction(async (tx) => {
      await this.repo.addMembers(id, dto.userIds, tx);
      await tx.group.update({ where: { id }, data: { updatedBy: actorId ?? null } });
    });

    await AuditService.log({
      action: 'group.members.added',
      resource: 'group',
      resourceId: id,
      severity: 'info',
      metadata: { slug: group.slug, added: dto.userIds.length },
    });

    this.invalidate();
    return this.getById(id);
  }

  async removeMember(id: string, userId: string, actorId?: string | null) {
    const group = await this.repo.findById(id);
    if (!group) {
      throw new AppError('Group not found', 404, 'GROUP_NOT_FOUND');
    }
    await this.repo.transaction(async (tx) => {
      await this.repo.removeMember(id, userId, tx);
      await tx.group.update({ where: { id }, data: { updatedBy: actorId ?? null } });
    });

    await AuditService.log({
      action: 'group.members.removed',
      resource: 'group',
      resourceId: id,
      severity: 'info',
      metadata: { slug: group.slug, userId },
    });

    this.invalidate();
    return this.getById(id);
  }

  async setRoles(id: string, dto: SetGroupRolesDto, actorId?: string | null) {
    const group = await this.repo.findById(id);
    if (!group) {
      throw new AppError('Group not found', 404, 'GROUP_NOT_FOUND');
    }
    await this.repo.transaction(async (tx) => {
      if (dto.mode === 'replace') {
        await this.repo.replaceRoles(id, dto.roleIds, tx);
      } else {
        await this.repo.mergeRoles(id, dto.roleIds, tx);
      }
      await tx.group.update({ where: { id }, data: { updatedBy: actorId ?? null } });
    });

    await AuditService.log({
      action: 'group.roles.set',
      resource: 'group',
      resourceId: id,
      severity: dto.mode === 'replace' ? 'warning' : 'info',
      metadata: { slug: group.slug, mode: dto.mode, roles: dto.roleIds.length },
    });

    this.invalidate();
    return this.getById(id);
  }

  private invalidate() {
    void cacheDelPattern(`${GROUP_CACHE_PREFIX}*`);
  }
}
