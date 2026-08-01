import { BaseRepository, TxClient } from '../../infrastructure/prisma';
import { Prisma } from '@prisma/client';
import { IamUserListQueryDto } from './iam-user.dto';

interface UserWhere extends Prisma.UserWhereInput {}

export class IamUserRepository extends BaseRepository {
  /** Public transaction wrapper so services can orchestrate multi-repo writes. */
  transaction<T>(
    fn: (tx: TxClient) => Promise<T>,
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel; timeoutMs?: number }
  ): Promise<T> {
    return this.withTransaction(fn, options);
  }

  async findById(id: string, tx?: TxClient) {
    return this.getDb(tx).user.findUnique({ where: { id } });
  }

  async findByIdDetail(id: string, tx?: TxClient) {
    return this.getDb(tx).user.findUnique({
      where: { id },
      include: {
        roleAssignments: {
          include: { role: true },
          orderBy: { id: 'asc' },
        },
        userGroups: {
          include: { group: true },
          orderBy: { id: 'asc' },
        },
      },
    });
  }

  async findByEmail(email: string, tx?: TxClient) {
    return this.getDb(tx).user.findUnique({ where: { email } });
  }

  async findByUsername(username: string, tx?: TxClient) {
    return this.getDb(tx).user.findUnique({ where: { username } });
  }

  async list(query: IamUserListQueryDto, tx?: TxClient) {
    const where: UserWhere = { isDeleted: false };

    if (query.q) {
      where.OR = [
        { fullName: { contains: query.q, mode: 'insensitive' } },
        { email: { contains: query.q, mode: 'insensitive' } },
        { username: { contains: query.q, mode: 'insensitive' } },
        { department: { contains: query.q, mode: 'insensitive' } },
        { jobTitle: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.status?.length) where.status = { in: query.status };
    if (query.department) where.department = query.department;
    if (query.isAccountLocked) where.isAccountLocked = query.isAccountLocked === 'true';
    if (query.roleId) where.roleAssignments = { some: { roleId: query.roleId } };
    if (query.groupId) where.userGroups = { some: { groupId: query.groupId } };

    const [data, total] = await Promise.all([
      this.getDb(tx).user.findMany({
        where,
        select: {
          id: true,
          email: true,
          username: true,
          fullName: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          mobile: true,
          department: true,
          jobTitle: true,
          status: true,
          timezone: true,
          language: true,
          isAccountLocked: true,
          lastLoginDatetime: true,
          emailVerified: true,
          isDeleted: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { roleAssignments: true, userGroups: true } },
        },
        orderBy: { [query.sort]: query.order },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.getDb(tx).user.count({ where }),
    ]);

    return { data, total };
  }

  async create(
    data: {
      email: string;
      emailId?: string | null;
      username: string;
      fullName: string;
      firstName?: string | null;
      lastName?: string | null;
      mobile?: string | null;
      passwordHash?: string | null;
      department?: string | null;
      jobTitle?: string | null;
      timezone?: string | null;
      language?: string;
      status?: string;
      createdBy?: string | null;
    },
    tx?: TxClient
  ) {
    return this.getDb(tx).user.create({
      data: {
        email: data.email,
        emailId: data.emailId ?? data.email,
        username: data.username,
        fullName: data.fullName,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        mobile: data.mobile ?? null,
        passwordHash: data.passwordHash ?? null,
        department: data.department ?? null,
        jobTitle: data.jobTitle ?? null,
        timezone: data.timezone ?? null,
        language: data.language ?? 'en',
        status: (data.status as never) ?? 'ACTIVE',
        createdBy: data.createdBy ?? null,
      },
    });
  }

  async update(id: string, data: Record<string, unknown>, tx?: TxClient) {
    return this.getDb(tx).user.update({ where: { id }, data });
  }

  async softDelete(id: string, deletedBy?: string | null, tx?: TxClient) {
    return this.getDb(tx).user.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), deletedBy: deletedBy ?? null },
    });
  }

  async replaceRoles(userId: string, entries: Array<{ roleId: string; organizationId?: string }>, tx: TxClient) {
    await tx.userRoleAssignment.deleteMany({ where: { userId } });
    if (entries.length > 0) {
      await tx.userRoleAssignment.createMany({
        data: entries.map((e) => ({
          userId,
          roleId: e.roleId,
          organizationId: e.organizationId ?? 'platform',
        })),
        skipDuplicates: true,
      });
    }
  }

  async mergeRoles(userId: string, entries: Array<{ roleId: string; organizationId?: string }>, tx: TxClient) {
    for (const e of entries) {
      const existing = await tx.userRoleAssignment.findFirst({
        where: { userId, roleId: e.roleId },
      });
      if (!existing) {
        await tx.userRoleAssignment.create({
          data: { userId, roleId: e.roleId, organizationId: e.organizationId ?? 'platform' },
        });
      }
    }
  }

  async replaceGroups(userId: string, groupIds: string[], tx: TxClient) {
    await tx.userGroup.deleteMany({ where: { userId } });
    if (groupIds.length > 0) {
      await tx.userGroup.createMany({
        data: groupIds.map((groupId) => ({ userId, groupId })),
        skipDuplicates: true,
      });
    }
  }

  async mergeGroups(userId: string, groupIds: string[], tx: TxClient) {
    for (const groupId of groupIds) {
      await tx.userGroup.upsert({
        where: { userId_groupId: { userId, groupId } },
        update: {},
        create: { userId, groupId },
      });
    }
  }

  async countWhere(where: UserWhere, tx?: TxClient) {
    return this.getDb(tx).user.count({ where });
  }
}
