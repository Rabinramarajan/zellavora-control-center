import type { ApprovalMode, OrganizationRole, User } from '@prisma/client';
import { BaseRepository, TxClient } from '../../infrastructure/prisma';

export type AuthChallengePurpose = 'mfa_login' | 'mfa_enrollment';

export class AuthRepository extends BaseRepository {
  transaction<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
    return this.withTransaction(fn);
  }

  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------

  findUserInTenant(email: string, tenantId: string, tx?: TxClient): Promise<User | null> {
    return this.getDb(tx).user.findFirst({ where: { email, tenantId } });
  }

  findUserByEmail(email: string, tx?: TxClient): Promise<User | null> {
    return this.getDb(tx).user.findUnique({ where: { email } });
  }

  findUserById(id: string, tx?: TxClient): Promise<User | null> {
    return this.getDb(tx).user.findUnique({ where: { id } });
  }

  updateUser(id: string, data: Parameters<TxClient['user']['update']>[0]['data'], tx?: TxClient) {
    return this.getDb(tx).user.update({ where: { id }, data });
  }

  createUser(data: Parameters<TxClient['user']['create']>[0]['data'], tx?: TxClient) {
    return this.getDb(tx).user.create({ data });
  }

  ensureMembership(
    userId: string,
    tenantId: string,
    tx?: TxClient,
    role: OrganizationRole = 'member',
    approvalMode: ApprovalMode | null = null
  ) {
    return this.getDb(tx).userTenant.upsert({
      where: { userId_tenantId: { userId, tenantId } },
      create: { userId, tenantId, isDefault: true, role, approvalMode },
      update: {},
    });
  }

  // ---------------------------------------------------------------------------
  // Organizations (self-registration)
  // ---------------------------------------------------------------------------

  /**
   * Registration config for an organization. Returned even when
   * self-registration is off, so the caller can tell "no such organization"
   * apart from "closed to registration" without a second query — the public
   * response never distinguishes them, but the log does.
   */
  findRegistrationTarget(clientCode: string, tx?: TxClient) {
    return this.getDb(tx).organization.findFirst({
      where: { clientCode: clientCode.toLowerCase(), isDeleted: false },
      select: {
        id: true,
        name: true,
        status: true,
        allowSelfRegistration: true,
        allowedRegistrationTypes: true,
        requireAdminApproval: true,
      },
    });
  }

  organizationCodeTaken(clientCode: string, tx?: TxClient) {
    return this.getDb(tx).organization.findUnique({
      where: { clientCode: clientCode.toLowerCase() },
      select: { id: true },
    });
  }

  createOrganization(
    data: Parameters<TxClient['organization']['create']>[0]['data'],
    tx?: TxClient
  ) {
    return this.getDb(tx).organization.create({ data });
  }

  // ---------------------------------------------------------------------------
  // Individual role
  // ---------------------------------------------------------------------------

  /**
   * Assigns the organization's system role of this name, creating it with
   * exactly the given permission keys the first time it is needed.
   */
  async assignOrganizationRole(
    input: {
      userId: string;
      organizationId: string;
      name: string;
      permissionKeys: readonly string[];
    },
    tx?: TxClient
  ) {
    const db = this.getDb(tx);
    const key = `${input.organizationId}_${input.name.toLowerCase()}`;
    let role = await db.role.findUnique({ where: { key } });
    if (!role) {
      const created = await db.role.create({
        data: {
          name: input.name,
          key,
          organizationId: input.organizationId,
          description: 'Personal portfolio, content, projects and sheets only',
          isSystem: true,
        },
      });
      const permissions = await db.permission.findMany({
        where: { key: { in: [...input.permissionKeys] } },
        select: { id: true },
      });
      await db.rolePermission.createMany({
        data: permissions.map((p) => ({
          organizationId: input.organizationId,
          roleId: created.id,
          permissionId: p.id,
          effect: 'allow',
        })),
        skipDuplicates: true,
      });
      role = created;
    }
    await db.userRoleAssignment.create({
      data: {
        userId: input.userId,
        roleId: role.id,
        organizationId: input.organizationId,
        resourceType: 'tenant',
        resourceId: input.organizationId,
      },
    });
    return role;
  }

  // ---------------------------------------------------------------------------
  // Password history
  // ---------------------------------------------------------------------------

  recentPasswordHashes(userId: string, depth: number, tx?: TxClient) {
    return this.getDb(tx).passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: depth,
      select: { passwordHash: true },
    });
  }

  addPasswordHistory(userId: string, passwordHash: string, tx?: TxClient) {
    return this.getDb(tx).passwordHistory.create({ data: { userId, passwordHash } });
  }

  // ---------------------------------------------------------------------------
  // Auth challenges (2FA login, TOTP enrollment)
  // ---------------------------------------------------------------------------

  createChallenge(
    data: {
      tokenHash: string;
      purpose: AuthChallengePurpose;
      userId: string;
      organizationId?: string;
      method?: string;
      payload?: string;
      rememberMe?: boolean;
      expiresAt: Date;
    },
    tx?: TxClient
  ) {
    return this.getDb(tx).authChallenge.create({ data });
  }

  findLiveChallenge(tokenHash: string, purpose: AuthChallengePurpose, tx?: TxClient) {
    return this.getDb(tx).authChallenge.findFirst({
      where: { tokenHash, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  /** Atomically counts an attempt; returns false once the attempt budget is spent. */
  async recordChallengeAttempt(id: string, maxAttempts: number, tx?: TxClient): Promise<boolean> {
    const { count } = await this.getDb(tx).authChallenge.updateMany({
      where: { id, consumedAt: null, attempts: { lt: maxAttempts } },
      data: { attempts: { increment: 1 } },
    });
    return count === 1;
  }

  /** Single-use: only the first caller to consume a challenge gets `true`. */
  async consumeChallenge(id: string, tx?: TxClient): Promise<boolean> {
    const { count } = await this.getDb(tx).authChallenge.updateMany({
      where: { id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    return count === 1;
  }

  discardChallenges(userId: string, purpose: AuthChallengePurpose, tx?: TxClient) {
    return this.getDb(tx).authChallenge.updateMany({
      where: { userId, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  }

  purgeExpiredChallenges(tx?: TxClient) {
    return this.getDb(tx).authChallenge.deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
  }

  // ---------------------------------------------------------------------------
  // Password reset tokens
  // ---------------------------------------------------------------------------

  createPasswordReset(
    data: {
      userId: string;
      email: string;
      tokenHash: string;
      expiresAt: Date;
      ipAddress: string;
      userAgent: string;
    },
    tx?: TxClient
  ) {
    return this.getDb(tx).passwordReset.create({
      data: {
        userId: data.userId,
        email: data.email,
        token: data.tokenHash,
        expiresAt: data.expiresAt,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }

  countRecentPasswordResets(userId: string, since: Date, tx?: TxClient) {
    return this.getDb(tx).passwordReset.count({ where: { userId, createdAt: { gte: since } } });
  }

  findLivePasswordReset(tokenHash: string, tx?: TxClient) {
    return this.getDb(tx).passwordReset.findFirst({
      where: { token: tokenHash, used: false, usedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  /** Burns every outstanding reset token for the user (the used one included). */
  invalidatePasswordResets(userId: string, tx?: TxClient) {
    return this.getDb(tx).passwordReset.updateMany({
      where: { userId, used: false },
      data: { used: true, usedAt: new Date() },
    });
  }

  // ---------------------------------------------------------------------------
  // Email verification tokens
  // ---------------------------------------------------------------------------

  createEmailVerification(
    data: { userId: string; email: string; tokenHash: string; expiresAt: Date },
    tx?: TxClient
  ) {
    return this.getDb(tx).emailVerification.create({
      data: {
        userId: data.userId,
        email: data.email,
        token: data.tokenHash,
        expiresAt: data.expiresAt,
      },
    });
  }

  countRecentEmailVerifications(userId: string, since: Date, tx?: TxClient) {
    return this.getDb(tx).emailVerification.count({
      where: { userId, createdAt: { gte: since } },
    });
  }

  async hasEmailVerificationRecord(userId: string, tx?: TxClient): Promise<boolean> {
    return (await this.getDb(tx).emailVerification.count({ where: { userId } })) > 0;
  }

  findEmailVerification(tokenHash: string, tx?: TxClient) {
    return this.getDb(tx).emailVerification.findUnique({ where: { token: tokenHash } });
  }

  invalidateEmailVerifications(userId: string, tx?: TxClient) {
    return this.getDb(tx).emailVerification.updateMany({
      where: { userId, verified: false },
      data: { verified: true, verifiedAt: new Date() },
    });
  }

  // ---------------------------------------------------------------------------
  // Invitations
  // ---------------------------------------------------------------------------

  findInvitationByTokenHash(tokenHash: string, tx?: TxClient) {
    return this.getDb(tx).invitation.findUnique({
      where: { code: tokenHash },
      include: { organization: { select: { id: true, name: true, clientCode: true } } },
    });
  }

  /** Claims a pending invitation; only one concurrent accept can succeed. */
  async claimInvitation(id: string, tx?: TxClient): Promise<boolean> {
    const { count } = await this.getDb(tx).invitation.updateMany({
      where: { id, status: 'pending', used: false, isDeleted: false },
      data: { status: 'accepted', used: true, usedAt: new Date() },
    });
    return count === 1;
  }

  // ---------------------------------------------------------------------------
  // Security overview
  // ---------------------------------------------------------------------------

  recentSecurityEvents(userId: string, limit: number, tx?: TxClient) {
    return this.getDb(tx).auditLog.findMany({
      where: {
        actorId: userId,
        action: {
          in: [
            'login',
            'logout',
            'password_change',
            'password_reset_completed',
            'mfa_enrolled',
            'mfa_disabled',
            'mfa_recovery_used',
            'mfa_recovery_codes_regenerated',
            'session_revoked',
            'all_sessions_revoked',
            'email_verified',
            'invitation_accepted',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, action: true, ipAddress: true, userAgent: true, createdAt: true },
    });
  }
}
