import { BaseRepository, TxClient } from '../../infrastructure/prisma';
import { Prisma } from '@prisma/client';
import { RoleListQueryDto } from './role.dto';

interface RoleWhere extends Prisma.RoleWhereInput {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Only live groups and users count towards a role's holders. */
const COUNTS = {
  userAssignments: { where: { user: { isDeleted: false } } },
  rolePermissions: true,
  groupRoles: { where: { group: { isDeleted: false } } },
} as const;

export class RoleRepository extends BaseRepository {
  /** Public transaction wrapper so services can orchestrate multi-repo writes. */
  transaction<T>(
    fn: (tx: TxClient) => Promise<T>,
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel; timeoutMs?: number }
  ): Promise<T> {
    return this.withTransaction(fn, options);
  }

  async findById(id: string, tx?: TxClient) {
    // uuid columns reject malformed ids with a 500; treat them as missing.
    if (!UUID.test(id)) return null;
    return this.getDb(tx).role.findFirst({
      where: { id, isDeleted: false },
      include: { _count: { select: COUNTS } },
    });
  }

  async findByIdWithPermissions(id: string, tx?: TxClient) {
    if (!UUID.test(id)) return null;
    return this.getDb(tx).role.findFirst({
      where: { id, isDeleted: false },
      include: {
        rolePermissions: {
          include: { permission: true },
          orderBy: { permission: { name: 'asc' } },
        },
        groupRoles: {
          where: { group: { isDeleted: false } },
          include: {
            group: {
              select: {
                id: true,
                name: true,
                type: true,
                status: true,
                _count: { select: { members: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        userAssignments: {
          where: { user: { isDeleted: false } },
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                employeeCode: true,
                status: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: COUNTS },
      },
    });
  }

  async findByKey(key: string, tx?: TxClient) {
    return this.getDb(tx).role.findUnique({ where: { key } });
  }

  async findByName(name: string, tx?: TxClient) {
    return this.getDb(tx).role.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, isDeleted: false },
    });
  }

  async countBy(field: 'status' | 'scope', tx?: TxClient) {
    return this.getDb(tx).role.groupBy({
      by: [field],
      where: { isDeleted: false },
      _count: { _all: true },
    });
  }

  async countPermissions(ids: string[], tx?: TxClient) {
    return this.getDb(tx).permission.count({ where: { id: { in: ids } } });
  }

  async list(query: RoleListQueryDto, tx?: TxClient) {
    const where: RoleWhere = { isDeleted: false };

    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { key: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.scope?.length) where.scope = { in: query.scope };
    if (query.status?.length) where.status = { in: query.status };
    if (query.organizationId) where.organizationId = query.organizationId;

    const [data, total] = await Promise.all([
      this.getDb(tx).role.findMany({
        where,
        include: {
          _count: { select: COUNTS },
        },
        orderBy: { [query.sort]: query.order },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.getDb(tx).role.count({ where }),
    ]);

    return { data, total };
  }

  async listAll(tx?: TxClient) {
    return this.getDb(tx).role.findMany({
      where: { isDeleted: false },
      include: { _count: { select: COUNTS } },
      orderBy: { name: 'asc' },
    });
  }

  async create(
    data: {
      name: string;
      key: string;
      organizationId?: string | null;
      description?: string | null;
      scope: string;
      status: string;
      isSystem?: boolean;
      createdBy?: string | null;
    },
    tx?: TxClient
  ) {
    return this.getDb(tx).role.create({
      data: {
        name: data.name,
        key: data.key,
        organizationId: data.organizationId ?? null,
        description: data.description ?? null,
        scope: data.scope as never,
        status: data.status as never,
        isSystem: data.isSystem ?? false,
        createdBy: data.createdBy ?? null,
      },
    });
  }

  async update(id: string, data: Record<string, unknown>, tx?: TxClient) {
    return this.getDb(tx).role.update({ where: { id }, data });
  }

  async softDelete(id: string, deletedBy?: string | null, tx?: TxClient) {
    return this.getDb(tx).role.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: deletedBy ?? null,
        // key is a unique column; release it so a new role can reuse it.
        key: `${id}~deleted`,
      },
    });
  }

  async listPermissions(roleId: string, tx?: TxClient) {
    return this.getDb(tx).rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
      orderBy: { permission: { name: 'asc' } },
    });
  }

  /** Replace the role's permission set with the given [permissionId, effect] entries. */
  async replacePermissions(
    roleId: string,
    organizationId: string,
    entries: ReadonlyArray<{ permissionId?: string; effect?: string }>,
    tx: TxClient
  ) {
    const valid = entries.filter(
      (e): e is { permissionId: string; effect: string } => !!e.permissionId && !!e.effect
    );
    await tx.rolePermission.deleteMany({ where: { roleId } });
    if (valid.length > 0) {
      await tx.rolePermission.createMany({
        data: valid.map((e) => ({
          roleId,
          organizationId,
          permissionId: e.permissionId,
          effect: e.effect,
        })),
        skipDuplicates: true,
      });
    }
  }

  /** Merge additional permissions into the role, preserving existing entries. */
  async upsertPermissions(
    roleId: string,
    organizationId: string,
    entries: ReadonlyArray<{ permissionId?: string; effect?: string }>,
    tx: TxClient
  ) {
    for (const e of entries) {
      if (!e.permissionId || !e.effect) continue;
      await tx.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: e.permissionId } },
        update: { effect: e.effect },
        create: { roleId, organizationId, permissionId: e.permissionId, effect: e.effect },
      });
    }
  }

  async copyPermissions(sourceRoleId: string, targetRoleId: string, tx: TxClient) {
    const rows = await tx.rolePermission.findMany({ where: { roleId: sourceRoleId } });
    if (rows.length > 0) {
      await tx.rolePermission.createMany({
        data: rows.map((r) => ({
          roleId: targetRoleId,
          organizationId: r.organizationId,
          permissionId: r.permissionId,
          effect: r.effect,
        })),
        skipDuplicates: true,
      });
    }
  }
}
