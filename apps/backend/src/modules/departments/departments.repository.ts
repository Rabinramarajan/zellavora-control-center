import { Prisma } from '@prisma/client';
import { BaseRepository, TxClient } from '../../infrastructure/prisma';
import { DepartmentListQuery } from './departments.dto';

const withCounts = {
  parent: { select: { id: true, name: true } },
  _count: {
    select: {
      userTenants: true,
      children: { where: { isDeleted: false } },
    },
  },
} satisfies Prisma.DepartmentInclude;

export class DepartmentsRepository extends BaseRepository {
  async list(organizationId: string, query: DepartmentListQuery, tx?: TxClient) {
    const where: Prisma.DepartmentWhereInput = { organizationId, isDeleted: false };
    if (query.status) where.status = query.status;
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { code: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.getDb(tx).department.findMany({
        where,
        include: withCounts,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.getDb(tx).department.count({ where }),
    ]);
    return { data, total };
  }

  findById(id: string, organizationId: string, tx?: TxClient) {
    return this.getDb(tx).department.findFirst({
      where: { id, organizationId, isDeleted: false },
      include: withCounts,
    });
  }

  findByName(organizationId: string, name: string, tx?: TxClient) {
    return this.getDb(tx).department.findFirst({
      where: { organizationId, isDeleted: false, name: { equals: name, mode: 'insensitive' } },
    });
  }

  /** Parent map of every live department, for cycle detection. */
  parentMap(organizationId: string, tx?: TxClient) {
    return this.getDb(tx).department.findMany({
      where: { organizationId, isDeleted: false },
      select: { id: true, parentId: true },
    });
  }

  create(data: Prisma.DepartmentUncheckedCreateInput, tx?: TxClient) {
    return this.getDb(tx).department.create({ data });
  }

  update(id: string, data: Prisma.DepartmentUncheckedUpdateInput, tx?: TxClient) {
    return this.getDb(tx).department.update({
      where: { id },
      data: { ...data, version: { increment: 1 } },
    });
  }

  async softDelete(id: string, organizationId: string, actorId: string, tx?: TxClient) {
    const db = this.getDb(tx);
    await db.userTenant.updateMany({
      where: { tenantId: organizationId, departmentId: id },
      data: { departmentId: null },
    });
    return db.department.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), deletedBy: actorId },
    });
  }

  listMembers(organizationId: string, departmentId: string, tx?: TxClient) {
    return this.getDb(tx).userTenant.findMany({
      where: { tenantId: organizationId, departmentId, user: { isDeleted: false } },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            jobTitle: true,
            avatarUrl: true,
            status: true,
          },
        },
      },
      orderBy: { user: { fullName: 'asc' } },
    });
  }

  assignMembers(
    organizationId: string,
    departmentId: string | null,
    userIds: string[],
    tx?: TxClient
  ) {
    return this.getDb(tx).userTenant.updateMany({
      where: { tenantId: organizationId, userId: { in: userIds } },
      data: { departmentId },
    });
  }

  removeMember(organizationId: string, departmentId: string, userId: string, tx?: TxClient) {
    return this.getDb(tx).userTenant.updateMany({
      where: { tenantId: organizationId, departmentId, userId },
      data: { departmentId: null },
    });
  }
}
