import { Prisma } from '@prisma/client';
import { BaseRepository, TxClient } from '../../infrastructure/prisma';
import { UserRequestListQueryDto } from './user-request.dto';
import { AppError } from '../../middleware/error';

const userSummary = { select: { id: true, fullName: true, email: true } } as const;

export const requestDetailInclude = {
  requestedBy: userSummary,
  targetUser: {
    select: { id: true, fullName: true, email: true, employeeCode: true, status: true },
  },
  approvals: { orderBy: [{ createdAt: 'asc' }, { level: 'asc' }] },
  events: { orderBy: { createdAt: 'asc' } },
  notes: { orderBy: { createdAt: 'desc' } },
  emails: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.UserRequestInclude;

export type UserRequestDetailRow = Prisma.UserRequestGetPayload<{
  include: typeof requestDetailInclude;
}>;

export class UserRequestRepository extends BaseRepository {
  transaction<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
    return this.withTransaction(fn, { timeoutMs: 20000 });
  }

  async nextRefNo(tx?: TxClient): Promise<string> {
    const [row] = await this.getDb(tx).$queryRaw<
      Array<{ n: bigint }>
    >`SELECT nextval('user_request_ref_seq') AS n`;
    return `UR-${new Date().getFullYear()}-${String(row.n).padStart(6, '0')}`;
  }

  async list(organizationId: string, query: UserRequestListQueryDto) {
    const where: Prisma.UserRequestWhereInput = { organizationId, isDeleted: false };
    const and: Prisma.UserRequestWhereInput[] = [];

    if (query.refNo) where.refNo = { contains: query.refNo, mode: 'insensitive' };
    if (query.type?.length) where.type = { in: query.type };
    if (query.status?.length) where.status = { in: query.status };
    if (query.name) where.subjectName = { contains: query.name, mode: 'insensitive' };
    if (query.employeeCode)
      where.employeeCode = { contains: query.employeeCode, mode: 'insensitive' };
    if (query.email) where.subjectEmail = { contains: query.email, mode: 'insensitive' };
    if (query.requestedById) where.requestedById = query.requestedById;
    if (query.branchId?.length) where.branchId = { in: query.branchId };
    if (query.departmentId?.length) where.departmentId = { in: query.departmentId };
    if (query.teamId?.length) where.teamId = { in: query.teamId };
    if (query.groupId?.length) and.push({ groupIds: { hasSome: query.groupId } });
    if (query.roleId?.length) and.push({ roleIds: { hasSome: query.roleId } });
    if (query.from || query.to) {
      const to = query.to ? new Date(query.to.getTime() + 24 * 60 * 60 * 1000 - 1) : undefined;
      where.createdAt = { ...(query.from ? { gte: query.from } : {}), ...(to ? { lte: to } : {}) };
    }
    if (and.length) where.AND = and;

    const [data, total] = await Promise.all([
      this.getDb().userRequest.findMany({
        where,
        include: { requestedBy: userSummary },
        orderBy: { [query.sort]: query.order },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.getDb().userRequest.count({ where }),
    ]);
    return { data, total };
  }

  async statusCounts(organizationId: string) {
    return this.getDb().userRequest.groupBy({
      by: ['status'],
      where: { organizationId, isDeleted: false },
      _count: { _all: true },
    });
  }

  async findDetail(id: string, organizationId: string, tx?: TxClient) {
    return this.getDb(tx).userRequest.findFirst({
      where: { id, organizationId, isDeleted: false },
      include: requestDetailInclude,
    });
  }

  async findProvisioningForUser(userId: string, tx?: TxClient) {
    return this.getDb(tx).userRequest.findMany({
      where: { targetUserId: userId, type: 'NEW_USER', status: 'PROVISIONING', isDeleted: false },
    });
  }

  create(data: Prisma.UserRequestUncheckedCreateInput, tx?: TxClient) {
    return this.getDb(tx).userRequest.create({ data });
  }

  update(id: string, data: Prisma.UserRequestUncheckedUpdateInput, tx?: TxClient) {
    return this.getDb(tx).userRequest.update({
      where: { id },
      data: { ...data, version: { increment: 1 } },
    });
  }

  /**
   * Optimistic concurrency guard. Atomically bumps the version only if the request still
   * has the status and version the caller decided on; otherwise another actor changed it
   * first (e.g. a second approver), and the action must not proceed.
   */
  async claim(id: string, seen: { status: string; version: number }, tx: TxClient) {
    const { count } = await tx.userRequest.updateMany({
      where: { id, status: seen.status, version: seen.version },
      data: { version: { increment: 1 } },
    });
    if (count === 0) {
      throw new AppError(
        'This request has changed. Refresh to view the latest status.',
        409,
        'REQUEST_CHANGED'
      );
    }
  }

  addEvent(data: Prisma.UserRequestEventUncheckedCreateInput, tx?: TxClient) {
    return this.getDb(tx).userRequestEvent.create({ data });
  }

  addNote(data: Prisma.UserRequestNoteUncheckedCreateInput, tx?: TxClient) {
    return this.getDb(tx).userRequestNote.create({ data });
  }

  createApprovals(data: Prisma.UserRequestApprovalCreateManyInput[], tx?: TxClient) {
    return this.getDb(tx).userRequestApproval.createMany({ data });
  }

  updateApproval(id: string, data: Prisma.UserRequestApprovalUncheckedUpdateInput, tx?: TxClient) {
    return this.getDb(tx).userRequestApproval.update({ where: { id }, data });
  }

  closeOpenApprovals(requestId: string, status: string, tx?: TxClient) {
    return this.getDb(tx).userRequestApproval.updateMany({
      where: { requestId, status: { in: ['WAITING', 'PENDING'] } },
      data: { status },
    });
  }

  createEmail(data: Prisma.UserRequestEmailUncheckedCreateInput, tx?: TxClient) {
    return this.getDb(tx).userRequestEmail.create({ data });
  }

  updateEmail(id: string, data: Prisma.UserRequestEmailUncheckedUpdateInput) {
    return this.getDb().userRequestEmail.update({ where: { id }, data });
  }

  findEmail(id: string, requestId: string) {
    return this.getDb().userRequestEmail.findFirst({ where: { id, requestId } });
  }

  listAudit(requestId: string, targetUserId: string | null) {
    const or: Prisma.AuditLogWhereInput[] = [{ resource: 'user_request', resourceId: requestId }];
    if (targetUserId) {
      or.push({
        resource: 'user',
        resourceId: targetUserId,
        metadata: { path: ['requestId'], equals: requestId },
      });
    }
    return this.getDb().auditLog.findMany({
      where: { OR: or },
      include: { actor: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  // ---------------------------------------------------------------------------
  // Directory lookups
  // ---------------------------------------------------------------------------

  findUserName(id: string) {
    return this.getDb().user.findUnique({
      where: { id },
      select: { id: true, fullName: true, email: true },
    });
  }

  findUserForRequest(id: string, organizationId: string, tx?: TxClient) {
    return this.getDb(tx).user.findFirst({
      where: {
        id,
        isDeleted: false,
        OR: [{ tenantId: organizationId }, { userTenants: { some: { tenantId: organizationId } } }],
      },
      include: {
        userTenants: { where: { tenantId: organizationId }, select: { departmentId: true } },
        teams: { where: { organizationId, deletedAt: null }, select: { id: true, name: true } },
        roleAssignments: {
          where: { organizationId },
          include: { role: { select: { id: true, name: true, key: true, scope: true } } },
        },
        userGroups: { include: { group: { select: { id: true, name: true } } } },
      },
    });
  }

  findUsersByIds(ids: string[]) {
    if (!ids.length) return Promise.resolve([]);
    return this.getDb().user.findMany({
      where: { id: { in: ids } },
      select: { id: true, fullName: true, email: true },
    });
  }

  async findConflicts(input: {
    email?: string | null;
    username?: string | null;
    employeeCode?: string | null;
    excludeUserId?: string | null;
  }) {
    const or: Prisma.UserWhereInput[] = [];
    if (input.email) or.push({ email: { equals: input.email, mode: 'insensitive' } });
    if (input.username) or.push({ username: input.username });
    if (input.employeeCode)
      or.push({ employeeCode: { equals: input.employeeCode, mode: 'insensitive' } });
    if (!or.length) return [];
    return this.getDb().user.findMany({
      where: {
        OR: or,
        isDeleted: false,
        ...(input.excludeUserId ? { id: { not: input.excludeUserId } } : {}),
      },
      select: { email: true, username: true, employeeCode: true },
    });
  }

  lookups(organizationId: string) {
    const db = this.getDb();
    return Promise.all([
      db.branch.findMany({
        where: { organizationId, isDeleted: false },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      db.department.findMany({
        where: { organizationId, isDeleted: false },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      db.team.findMany({
        where: { organizationId, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      db.group.findMany({
        where: { isDeleted: false, status: 'ACTIVE' },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      db.role.findMany({
        where: {
          isDeleted: false,
          status: 'ACTIVE',
          OR: [{ organizationId }, { organizationId: null }],
        },
        select: { id: true, name: true, key: true, scope: true },
        orderBy: { name: 'asc' },
      }),
    ]);
  }

  rolesWithPermissions(roleIds: string[]) {
    if (!roleIds.length) return Promise.resolve([]);
    return this.getDb().role.findMany({
      where: { id: { in: roleIds } },
      select: {
        id: true,
        name: true,
        key: true,
        scope: true,
        isSystem: true,
        rolePermissions: {
          where: { effect: 'allow' },
          select: { permission: { select: { key: true, resource: true, action: true } } },
        },
      },
    });
  }

  groupsWithRoles(groupIds: string[]) {
    if (!groupIds.length) return Promise.resolve([]);
    return this.getDb().group.findMany({
      where: { id: { in: groupIds } },
      select: { id: true, name: true, groupRoles: { select: { roleId: true } } },
    });
  }

  namesFor(ids: { branchIds: string[]; departmentIds: string[]; teamIds: string[] }) {
    const db = this.getDb();
    return Promise.all([
      ids.branchIds.length
        ? db.branch.findMany({
            where: { id: { in: ids.branchIds } },
            select: { id: true, name: true },
          })
        : [],
      ids.departmentIds.length
        ? db.department.findMany({
            where: { id: { in: ids.departmentIds } },
            select: { id: true, name: true },
          })
        : [],
      ids.teamIds.length
        ? db.team.findMany({ where: { id: { in: ids.teamIds } }, select: { id: true, name: true } })
        : [],
    ]);
  }

  async countExisting(model: 'branch' | 'department' | 'team' | 'group' | 'role', ids: string[]) {
    if (!ids.length) return 0;
    const where = { id: { in: ids } };
    switch (model) {
      case 'branch':
        return this.getDb().branch.count({ where });
      case 'department':
        return this.getDb().department.count({ where });
      case 'team':
        return this.getDb().team.count({ where });
      case 'group':
        return this.getDb().group.count({ where });
      case 'role':
        return this.getDb().role.count({ where });
    }
  }
}
