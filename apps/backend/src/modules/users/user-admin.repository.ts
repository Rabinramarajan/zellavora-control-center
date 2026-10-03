import { Prisma } from '@prisma/client';
import { BaseRepository, TxClient } from '../../infrastructure/prisma';
import { APPROVED_USER_WHERE } from './approved-user';

/** Actions written by the auth module on the user's own behalf (sign-in, MFA, password). */
const SELF_SERVICE_ACTIONS = [
  'login',
  'logout',
  'login_failed',
  'lockout',
  'password_change',
  'password_reset_requested',
  'password_reset_completed',
  'email_verified',
  'mfa_enrolled',
  'mfa_disabled',
  'mfa_recovery_used',
  'invitation_accepted',
  'session_revoked',
  'all_sessions_revoked',
];

export class UserAdminRepository extends BaseRepository {
  transaction<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
    return this.withTransaction(fn);
  }

  findUser(id: string, tx?: TxClient) {
    return this.getDb(tx).user.findFirst({
      where: { id, isDeleted: false, ...APPROVED_USER_WHERE },
      include: {
        userTenants: { include: { tenant: { select: { id: true, name: true } } } },
        teams: { where: { deletedAt: null }, select: { id: true, name: true } },
        _count: { select: { roleAssignments: true, userGroups: true } },
      },
    });
  }

  findNames(ids: { branchId: string | null; departmentId: string | null; people: string[] }) {
    const db = this.getDb();
    return Promise.all([
      ids.branchId
        ? db.branch.findUnique({ where: { id: ids.branchId }, select: { id: true, name: true } })
        : null,
      ids.departmentId
        ? db.department.findUnique({
            where: { id: ids.departmentId },
            select: { id: true, name: true },
          })
        : null,
      ids.people.length
        ? db.user.findMany({
            where: { id: { in: ids.people } },
            select: { id: true, fullName: true },
          })
        : [],
    ]);
  }

  findConflicts(
    userId: string,
    input: { email?: string; username?: string; employeeCode?: string }
  ) {
    const or: Prisma.UserWhereInput[] = [];
    if (input.email) or.push({ email: { equals: input.email, mode: 'insensitive' } });
    if (input.username) or.push({ username: input.username });
    if (input.employeeCode)
      or.push({ employeeCode: { equals: input.employeeCode, mode: 'insensitive' } });
    if (!or.length) return Promise.resolve([]);
    return this.getDb().user.findMany({
      where: { id: { not: userId }, isDeleted: false, OR: or },
      select: { email: true, username: true, employeeCode: true },
    });
  }

  countExisting(model: 'branch' | 'department' | 'team' | 'user', id: string) {
    const where = { id };
    switch (model) {
      case 'branch':
        return this.getDb().branch.count({ where });
      case 'department':
        return this.getDb().department.count({ where });
      case 'team':
        return this.getDb().team.count({ where: { id, deletedAt: null } });
      case 'user':
        return this.getDb().user.count({ where: { id, isDeleted: false } });
    }
  }

  lastFailedLogin(email: string) {
    return this.getDb().loginAttempt.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, success: false },
      orderBy: { attemptedAt: 'desc' },
      select: { attemptedAt: true, failureReason: true },
    });
  }

  countLiveSessions(userId: string, organizationId: string) {
    return this.getDb().session.count({
      where: { userId, organizationId, isActive: true, expiresAt: { gt: new Date() } },
    });
  }

  listLiveSessions(userId: string, organizationId: string) {
    return this.getDb().session.findMany({
      where: { userId, organizationId, isActive: true, expiresAt: { gt: new Date() } },
      orderBy: { lastActivityAt: 'desc' },
    });
  }

  findPendingInvitation(email: string, organizationId: string) {
    return this.getDb().invitation.findFirst({
      where: { email, organizationId, status: 'pending', isDeleted: false },
      orderBy: { createdAt: 'desc' },
      select: { id: true, expiresAt: true, createdAt: true },
    });
  }

  revokePendingInvitations(email: string, organizationId: string, actorId: string, tx?: TxClient) {
    return this.getDb(tx).invitation.updateMany({
      where: { email, organizationId, status: 'pending' },
      data: { status: 'revoked', updatedBy: actorId },
    });
  }

  // ---------------------------------------------------------------------------
  // Access
  // ---------------------------------------------------------------------------

  listGroups(userId: string) {
    return this.getDb().userGroup.findMany({
      where: { userId },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            type: true,
            groupRoles: {
              select: { role: { select: { id: true, name: true, key: true, scope: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  listDirectRoles(userId: string, organizationId: string) {
    return this.getDb().userRoleAssignment.findMany({
      where: { userId, organizationId },
      include: { role: { select: { id: true, name: true, key: true, scope: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  rolePermissions(roleIds: string[]) {
    if (!roleIds.length) return Promise.resolve([]);
    return this.getDb().rolePermission.findMany({
      where: { roleId: { in: roleIds }, effect: 'allow' },
      select: { roleId: true, permission: { select: { key: true, resource: true, action: true } } },
    });
  }

  userNames(ids: string[]) {
    if (!ids.length) return Promise.resolve([]);
    return this.getDb().user.findMany({
      where: { id: { in: ids } },
      select: { id: true, fullName: true },
    });
  }

  // ---------------------------------------------------------------------------
  // History
  // ---------------------------------------------------------------------------

  listNotes(userId: string) {
    return this.getDb().userNote.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  addNote(data: Prisma.UserNoteUncheckedCreateInput) {
    return this.getDb().userNote.create({ data });
  }

  listStatusHistory(userId: string) {
    return this.getDb().userStatusHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  listRequests(userId: string, organizationId: string) {
    return this.getDb().userRequest.findMany({
      where: { targetUserId: userId, organizationId, isDeleted: false },
      include: { requestedBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  listEmailLogs(userId: string) {
    return this.getDb().userEmailLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  listRequestEmails(userId: string) {
    return this.getDb().userRequestEmail.findMany({
      where: { request: { targetUserId: userId } },
      include: { request: { select: { refNo: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  createEmailLog(data: Prisma.UserEmailLogUncheckedCreateInput) {
    return this.getDb().userEmailLog.create({ data });
  }

  updateEmailLog(id: string, data: Prisma.UserEmailLogUncheckedUpdateInput) {
    return this.getDb().userEmailLog.update({ where: { id }, data });
  }

  listAudit(userId: string) {
    return this.getDb().auditLog.findMany({
      where: {
        OR: [
          { resource: 'user', resourceId: userId },
          { actorId: userId, action: { in: SELF_SERVICE_ACTIONS } },
        ],
      },
      include: { actor: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  createPasswordReset(data: { userId: string; email: string; tokenHash: string; expiresAt: Date }) {
    return this.getDb().passwordReset.create({
      data: {
        userId: data.userId,
        email: data.email,
        token: data.tokenHash,
        expiresAt: data.expiresAt,
      },
    });
  }
}
