import { Prisma } from '@prisma/client';
import { BaseRepository, TxClient } from '../../infrastructure/prisma';
import { IamPermissionListQuery } from './permission.dto';

export class PermissionRepository extends BaseRepository {
  async findById(id: string, tx?: TxClient) {
    return this.getDb(tx).permission.findUnique({
      where: { id },
    });
  }

  async listAll(tx?: TxClient) {
    return this.getDb(tx).permission.findMany();
  }

  async create(
    data: {
      name: string;
      key?: string;
      resource?: string | null;
      action?: string | null;
      description?: string | null;
      groupId?: string | null;
    },
    tx?: TxClient
  ) {
    const key = data.key ?? data.name.toLowerCase().replace(/[^a-z0-9]+/g, ':');
    return this.getDb(tx).permission.create({
      data: { ...data, key },
    });
  }

  async assignToRole(
    roleId: string,
    permissionId: string,
    effect: 'allow' | 'deny',
    organizationId: string,
    tx?: TxClient
  ) {
    return this.getDb(tx).rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId, permissionId },
      },
      update: { effect },
      create: { organizationId, roleId, permissionId, effect },
    });
  }

  // ---------------------------------------------------------------------------
  // IAM catalog
  // ---------------------------------------------------------------------------

  async search(query: IamPermissionListQuery, tx?: TxClient) {
    const where: Prisma.PermissionWhereInput = {};
    if (query.resource) where.resource = query.resource;
    if (query.q) {
      where.OR = [
        { key: { contains: query.q, mode: 'insensitive' } },
        { name: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.getDb(tx).permission.findMany({
        where,
        include: {
          group: { select: { id: true, name: true } },
          _count: { select: { rolePermissions: true, resourceActions: true } },
        },
        orderBy: [{ resource: 'asc' }, { action: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.getDb(tx).permission.count({ where }),
    ]);
    return { data, total };
  }

  distinctResources(tx?: TxClient) {
    return this.getDb(tx).permission.findMany({
      where: { resource: { not: null } },
      distinct: ['resource'],
      select: { resource: true },
      orderBy: { resource: 'asc' },
    });
  }

  findByKey(key: string, tx?: TxClient) {
    return this.getDb(tx).permission.findUnique({ where: { key } });
  }

  findWithUsage(id: string, tx?: TxClient) {
    return this.getDb(tx).permission.findUnique({
      where: { id },
      include: {
        group: { select: { id: true, name: true } },
        _count: { select: { rolePermissions: true, resourceActions: true } },
        rolePermissions: {
          include: { role: { select: { id: true, name: true, key: true } } },
          orderBy: { role: { name: 'asc' } },
        },
      },
    });
  }

  update(id: string, data: Prisma.PermissionUncheckedUpdateInput, tx?: TxClient) {
    return this.getDb(tx).permission.update({ where: { id }, data });
  }

  delete(id: string, tx?: TxClient) {
    return this.getDb(tx).permission.delete({ where: { id } });
  }

  listGroups(tx?: TxClient) {
    return this.getDb(tx).permissionGroup.findMany({
      include: { _count: { select: { permissions: true } } },
      orderBy: { name: 'asc' },
    });
  }

  findGroup(id: string, tx?: TxClient) {
    return this.getDb(tx).permissionGroup.findUnique({ where: { id } });
  }

  findGroupByName(name: string, tx?: TxClient) {
    return this.getDb(tx).permissionGroup.findUnique({ where: { name } });
  }

  createGroup(data: { name: string; description: string | null }, tx?: TxClient) {
    return this.getDb(tx).permissionGroup.create({ data });
  }
}
