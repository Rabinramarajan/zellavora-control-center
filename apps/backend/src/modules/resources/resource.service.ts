import { AppError } from '../../middleware/error';
import { prisma, TxClient } from '../../infrastructure/prisma';
import { AuditService } from '../../infrastructure/audit';
import { cacheGet, cacheSet, cacheDelPattern } from '../../infrastructure/cache';
import { ResourceRepository } from './resource.repository';
import { ResourceMapper } from './resource.mapper';
import {
  CreateResourceDto,
  UpdateResourceDto,
  AddResourceActionDto,
  ResourceListQueryDto,
} from './resource.dto';

const RESOURCE_CACHE_PREFIX = 'iam:resources:';
const PERMISSION_CACHE_PREFIX = 'iam:permission:';

/**
 * RBAC Resources module service.
 *
 * A Resource is a protected entitlement (API, feature, data set, menu, report,
 * integration). Each ResourceAction maps 1:1 to a Permission row (key =
 * `<resource.key>:<action>`), so assigning a permission to a role grants the
 * corresponding capability on that resource. Creating/deleting actions keeps
 * the Permission table in sync (system-managed permissions carry a resource
 * reference).
 */
export class ResourceService {
  private readonly repo: ResourceRepository;

  constructor(repo?: ResourceRepository) {
    this.repo = repo ?? new ResourceRepository();
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  async list(query: ResourceListQueryDto) {
    const { data, total } = await this.repo.list(query);
    const rows = data.map((row) => ResourceMapper.toListItem(row as never));
    const totalPages = Math.ceil(total / query.pageSize);
    return { data: rows, meta: { page: query.page, pageSize: query.pageSize, total, totalPages } };
  }

  async tree() {
    const rows = await this.repo.listTree();
    const mapped = rows.map((row) => ResourceMapper.toListItem(row as never));
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
    const row = await this.repo.findById(id);
    if (!row) {
      throw new AppError('Resource not found', 404, 'RESOURCE_NOT_FOUND');
    }
    // Build the ancestor chain for breadcrumbs.
    const parents: Array<{ id: string; name: string }> = [];
    let current = row.parentId;
    const cache = new Map<string, { id: string; name: string }>();
    while (current) {
      const cached = cache.get(current);
      if (cached) {
        parents.push(cached);
        break;
      }
      const parent = await this.repo.findById(current);
      if (!parent) break;
      parents.push({ id: parent.id, name: parent.name });
      cache.set(current, { id: parent.id, name: parent.name });
      current = parent.parentId;
    }
    return ResourceMapper.toDetail(row as never, parents.reverse());
  }

  async getByKey(key: string) {
    const cached = await cacheGet<{ id: string; name: string; key: string; type: string }>(
      `${PERMISSION_CACHE_PREFIX}${key}`
    );
    if (cached) return cached;
    const row = await this.repo.findByKey(key);
    if (!row) {
      throw new AppError('Resource not found', 404, 'RESOURCE_NOT_FOUND');
    }
    const dto = { id: row.id, name: row.name, key: row.key, type: row.type };
    void cacheSet(`${PERMISSION_CACHE_PREFIX}${key}`, dto, 300);
    return dto;
  }

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  async create(dto: CreateResourceDto, actorId?: string | null) {
    const existing = await this.repo.findByKey(dto.key);
    if (existing) {
      throw new AppError(`Resource key '${dto.key}' already exists`, 409, 'RESOURCE_KEY_EXISTS');
    }
    if (dto.parentId) {
      const parent = await this.repo.findById(dto.parentId);
      if (!parent) {
        throw new AppError('Parent resource not found', 404, 'PARENT_RESOURCE_NOT_FOUND');
      }
    }
    if (dto.actions?.length) {
      const seen = new Set<string>();
      for (const a of dto.actions) {
        if (seen.has(a.action)) {
          throw new AppError(`Duplicate action '${a.action}'`, 400, 'DUPLICATE_ACTION');
        }
        seen.add(a.action);
      }
    }

    const created = await this.repo.transaction(async (tx) => {
      const resource = await this.repo.create(
        {
          name: dto.name,
          key: dto.key,
          type: dto.type,
          category: dto.category,
          description: dto.description,
          parentId: dto.parentId,
          ownerId: dto.ownerId,
          metadata: dto.metadata,
          createdBy: actorId ?? null,
        },
        tx
      );

      if (dto.actions?.length) {
        for (const a of dto.actions) {
          const permission = await this.ensurePermission(
            dto.key,
            a.action,
            resource.name,
            dto.description ?? null,
            tx
          );
          await tx.resourceAction.create({
            data: { resourceId: resource.id, action: a.action, permissionId: permission.id },
          });
        }
      }

      await this.bumpVersion(resource.id, tx);
      return resource;
    });

    await AuditService.log({
      action: 'resource.created',
      resource: 'resource',
      resourceId: created.id,
      severity: 'info',
      metadata: { key: created.key, type: created.type, name: created.name },
    });

    this.invalidate();
    return this.getById(created.id);
  }

  async update(id: string, dto: UpdateResourceDto, actorId?: string | null) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new AppError('Resource not found', 404, 'RESOURCE_NOT_FOUND');
    }
    if (dto.parentId && dto.parentId === id) {
      throw new AppError('A resource cannot be its own parent', 400, 'INVALID_PARENT');
    }
    if (dto.parentId) {
      const parent = await this.repo.findById(dto.parentId);
      if (!parent) {
        throw new AppError('Parent resource not found', 404, 'PARENT_RESOURCE_NOT_FOUND');
      }
    }

    const updated = await this.repo.update(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.category !== undefined ? { category: dto.category } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
      ...(dto.ownerId !== undefined ? { ownerId: dto.ownerId } : {}),
      ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
      updatedBy: actorId ?? null,
    });

    await this.bumpVersion(id);
    await AuditService.log({
      action: 'resource.updated',
      resource: 'resource',
      resourceId: id,
      severity: 'info',
      metadata: { key: existing.key, name: updated.name },
    });

    this.invalidate();
    return this.getById(id);
  }

  async addAction(id: string, dto: AddResourceActionDto, actorId?: string | null) {
    const resource = await this.repo.findById(id);
    if (!resource) {
      throw new AppError('Resource not found', 404, 'RESOURCE_NOT_FOUND');
    }
    const duplicate = resource.actions?.find((a) => a.action === dto.action);
    if (duplicate) {
      throw new AppError(`Action '${dto.action}' already exists`, 409, 'DUPLICATE_ACTION');
    }

    const { actionRow } = await this.repo.transaction(async (tx) => {
      const permission = await this.ensurePermission(
        resource.key,
        dto.action,
        resource.name,
        resource.description,
        tx
      );
      const actionRow = await tx.resourceAction.create({
        data: { resourceId: id, action: dto.action, permissionId: permission.id },
      });
      await this.bumpVersion(id, tx);
      return { actionRow };
    });

    await AuditService.log({
      action: 'resource.action_added',
      resource: 'resource',
      resourceId: id,
      severity: 'info',
      metadata: { key: resource.key, action: dto.action },
    });

    this.invalidate();
    return actionRow;
  }

  async removeAction(resourceId: string, actionId: string, actorId?: string | null) {
    const resource = await this.repo.findById(resourceId);
    if (!resource) {
      throw new AppError('Resource not found', 404, 'RESOURCE_NOT_FOUND');
    }
    const action = resource.actions?.find((a) => a.id === actionId);
    if (!action) {
      throw new AppError('Action not found', 404, 'ACTION_NOT_FOUND');
    }

    await this.repo.transaction(async (tx) => {
      // Delete the mapped system permission so role grants based on it no
      // longer resolve. Permissions that are referenced elsewhere still get
      // deleted (role_permissions cascade) — acceptable for resource-scoped
      // system permissions.
      if (action.permissionId) {
        await tx.permission.deleteMany({ where: { id: action.permissionId } });
      }
      await tx.resourceAction.delete({ where: { id: actionId } });
      await this.bumpVersion(resourceId, tx);
    });

    await AuditService.log({
      action: 'resource.action_removed',
      resource: 'resource',
      resourceId,
      severity: 'warning',
      metadata: { key: resource.key, action: action.action },
    });

    this.invalidate();
  }

  async delete(id: string, actorId?: string | null) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new AppError('Resource not found', 404, 'RESOURCE_NOT_FOUND');
    }
    if (existing.isSystem) {
      throw new AppError('System resources cannot be deleted', 403, 'SYSTEM_RESOURCE');
    }

    await this.repo.transaction(async (tx) => {
      // Release the mapped permissions for this resource's actions.
      const actionIds = existing.actions?.map((a) => a.permissionId).filter(Boolean) ?? [];
      if (actionIds.length) {
        await tx.permission.deleteMany({ where: { id: { in: actionIds } } });
      }
      await this.repo.softDelete(id, actorId ?? null, tx);
      await this.bumpVersion(id, tx);
    });

    await AuditService.log({
      action: 'resource.deleted',
      resource: 'resource',
      resourceId: id,
      severity: 'warning',
      metadata: { key: existing.key, name: existing.name },
    });

    this.invalidate();
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Upsert the Permission row backing a `<resourceKey>:<action>`. */
  private async ensurePermission(
    resourceKey: string,
    action: string,
    resourceName: string,
    resourceDescription: string | null,
    tx: TxClient
  ) {
    const key = `${resourceKey}:${action}`;
    const name = `${resourceName} — ${action}`;
    const existing = await tx.permission.findUnique({ where: { key } });
    if (existing) return existing;
    return tx.permission.create({
      data: {
        key,
        name,
        resource: resourceKey,
        action,
        description: resourceDescription ?? null,
      },
    });
  }

  private async bumpVersion(id: string, tx?: TxClient) {
    return this.getDb(tx).resource.update({
      where: { id },
      data: { version: { increment: 1 } },
    });
  }

  private getDb(tx?: TxClient) {
    return tx ?? prisma;
  }

  private invalidate() {
    void cacheDelPattern(`${RESOURCE_CACHE_PREFIX}*`);
    void cacheDelPattern(`${PERMISSION_CACHE_PREFIX}*`);
  }
}
