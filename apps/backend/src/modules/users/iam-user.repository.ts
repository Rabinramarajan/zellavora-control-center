import { BaseRepository, TxClient } from '../../infrastructure/prisma';
import { Prisma } from '@prisma/client';
import { IamUserListQueryDto } from './iam-user.dto';
import { AccountStatus, accountStatusWhere } from './account-status';
import { APPROVED_USER_WHERE } from './approved-user';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 'USR000236', 'usr236' or '236' → 236. */
export function parseUserNo(value: string): number | null {
  const match = /^(?:usr)?0*(\d{1,9})$/i.exec(value.trim());
  return match ? Number(match[1]) : null;
}

// Date-only filters arrive as midnight; widen the upper bound so the whole day is included.
function endOfDay(date?: Date): Date | undefined {
  return date ? new Date(date.getTime() + 86_399_999) : undefined;
}

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
    return this.getDb(tx).user.findFirst({
      where: { id, ...APPROVED_USER_WHERE },
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

  async countByStatus(tx?: TxClient) {
    return this.getDb(tx).user.groupBy({
      by: ['status'],
      where: { isDeleted: false },
      _count: { _all: true },
    });
  }

  async list(query: IamUserListQueryDto, tx?: TxClient) {
    const and: UserWhere[] = [{ isDeleted: false }, APPROVED_USER_WHERE];
    const contains = (value: string) => ({ contains: value, mode: 'insensitive' as const });

    if (query.q) {
      const or: UserWhere[] = [
        { fullName: contains(query.q) },
        { email: contains(query.q) },
        { username: contains(query.q) },
        { employeeCode: contains(query.q) },
        { department: contains(query.q) },
        { jobTitle: contains(query.q) },
      ];
      const userNo = parseUserNo(query.q);
      if (userNo !== null) or.push({ userNo });
      if (UUID.test(query.q)) or.push({ id: query.q });
      and.push({ OR: or });
    }
    if (query.userId) {
      const userNo = parseUserNo(query.userId);
      and.push(
        UUID.test(query.userId)
          ? { id: query.userId }
          : userNo !== null
            ? { userNo }
            : { id: { equals: '00000000-0000-0000-0000-000000000000' } }
      );
    }
    if (query.username) and.push({ username: contains(query.username) });
    if (query.firstName) and.push({ firstName: contains(query.firstName) });
    if (query.lastName) and.push({ lastName: contains(query.lastName) });
    if (query.employeeCode) and.push({ employeeCode: contains(query.employeeCode) });
    if (query.status?.length) {
      const statuses = query.status.flatMap((s) =>
        s === 'PENDING' ? (['INVITED', 'PENDING_VERIFICATION'] as const) : [s]
      );
      and.push(accountStatusWhere(statuses as AccountStatus[]));
    }
    if (query.userType?.length) and.push({ userType: { in: query.userType } });
    if (query.branchId?.length) and.push({ branchId: { in: query.branchId } });
    if (query.departmentId?.length) {
      and.push({ userTenants: { some: { departmentId: { in: query.departmentId } } } });
    }
    if (query.teamId?.length) and.push({ teams: { some: { id: { in: query.teamId } } } });
    if (query.roleId?.length)
      and.push({ roleAssignments: { some: { roleId: { in: query.roleId } } } });
    if (query.groupId?.length)
      and.push({ userGroups: { some: { groupId: { in: query.groupId } } } });
    if (query.emailVerified) and.push({ emailVerified: query.emailVerified === 'true' });
    if (query.mfaEnabled) and.push({ mfaEnabled: query.mfaEnabled === 'true' });
    if (query.department) and.push({ department: query.department });
    if (query.isAccountLocked) and.push({ isAccountLocked: query.isAccountLocked === 'true' });
    if (query.name) and.push({ fullName: contains(query.name) });
    if (query.email) and.push({ email: contains(query.email) });
    if (query.mobile) and.push({ mobile: { contains: query.mobile.replace(/[^\d+]/g, '') } });
    if (query.createdFrom || query.createdTo) {
      and.push({ createdAt: { gte: query.createdFrom, lte: endOfDay(query.createdTo) } });
    }
    if (query.lastLoginFrom || query.lastLoginTo) {
      and.push({
        lastLoginDatetime: { gte: query.lastLoginFrom, lte: endOfDay(query.lastLoginTo) },
      });
    }
    if (query.beginFrom || query.beginTo) {
      and.push({ joiningDate: { gte: query.beginFrom, lte: query.beginTo } });
    }
    if (query.endFrom || query.endTo) {
      and.push({ endDate: { gte: query.endFrom, lte: query.endTo } });
    }
    const where: UserWhere = { AND: and };

    const [data, total] = await Promise.all([
      this.getDb(tx).user.findMany({
        where,
        select: {
          id: true,
          userNo: true,
          email: true,
          username: true,
          fullName: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          mobile: true,
          department: true,
          jobTitle: true,
          employeeCode: true,
          userType: true,
          branchId: true,
          joiningDate: true,
          endDate: true,
          status: true,
          passwordHash: true,
          timezone: true,
          language: true,
          isAccountLocked: true,
          lastLoginDatetime: true,
          emailVerified: true,
          mfaEnabled: true,
          isDeleted: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { roleAssignments: true, userGroups: true } },
          roleAssignments: { take: 1, select: { role: { select: { name: true, key: true } } } },
          userGroups: { take: 1, select: { group: { select: { name: true } } } },
          teams: { take: 1, where: { deletedAt: null }, select: { name: true } },
        },
        orderBy: { [query.sort]: query.order },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.getDb(tx).user.count({ where }),
    ]);

    return { data, total };
  }

  branchNames(ids: string[], tx?: TxClient) {
    if (!ids.length) return Promise.resolve([]);
    return this.getDb(tx).branch.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
  }

  async countInvited(tx?: TxClient) {
    return this.getDb(tx).user.count({
      where: { isDeleted: false, status: 'PENDING', passwordHash: null },
    });
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
      tenantId?: string | null;
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
        tenantId: data.tenantId ?? null,
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

  async replaceRoles(
    userId: string,
    entries: Array<{ roleId: string; organizationId?: string }>,
    tx: TxClient,
    assignedBy: string | null = null
  ) {
    await tx.userRoleAssignment.deleteMany({ where: { userId } });
    if (entries.length > 0) {
      await tx.userRoleAssignment.createMany({
        data: entries.map((e) => ({
          userId,
          roleId: e.roleId,
          organizationId: e.organizationId ?? 'platform',
          assignedBy,
        })),
        skipDuplicates: true,
      });
    }
  }

  async mergeRoles(
    userId: string,
    entries: Array<{ roleId: string; organizationId?: string }>,
    tx: TxClient,
    assignedBy: string | null = null
  ) {
    for (const e of entries) {
      const existing = await tx.userRoleAssignment.findFirst({
        where: { userId, roleId: e.roleId },
      });
      if (!existing) {
        await tx.userRoleAssignment.create({
          data: {
            userId,
            roleId: e.roleId,
            organizationId: e.organizationId ?? 'platform',
            assignedBy,
          },
        });
      }
    }
  }

  async replaceGroups(
    userId: string,
    groupIds: string[],
    tx: TxClient,
    assignedBy: string | null = null
  ) {
    await tx.userGroup.deleteMany({ where: { userId } });
    if (groupIds.length > 0) {
      await tx.userGroup.createMany({
        data: groupIds.map((groupId) => ({ userId, groupId, assignedBy })),
        skipDuplicates: true,
      });
    }
  }

  async mergeGroups(
    userId: string,
    groupIds: string[],
    tx: TxClient,
    assignedBy: string | null = null
  ) {
    for (const groupId of groupIds) {
      await tx.userGroup.upsert({
        where: { userId_groupId: { userId, groupId } },
        update: {},
        create: { userId, groupId, assignedBy },
      });
    }
  }

  async countWhere(where: UserWhere, tx?: TxClient) {
    return this.getDb(tx).user.count({ where });
  }
}
