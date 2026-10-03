import { config } from '../../config/env';
import { AuditService } from '../../infrastructure/audit';
import { sendPasswordResetEmail } from '../../infrastructure/queue';
import { AppError } from '../../middleware/error';
import { OneTimeTokenService } from '../../services/auth';
import { InvitationService } from '../invitation/invitation.service';
import {
  ORG_WIDE_SESSION_SCOPE,
  SessionsService,
  describeUserAgent,
} from '../sessions/sessions.service';
import {
  STATUS_LABELS,
  TYPE_LABELS,
  RequestStatus,
  RequestType,
} from '../user-requests/user-request.types';
import { ACCOUNT_STATUS_LABELS, AccountStatus, accountStatusOf } from './account-status';
import { formatUserCode } from './iam-user.mapper';
import { allowedUserActions, requestableChanges } from './user-actions';
import { AddUserNoteDto } from './user-admin.dto';
import { UserAdminNotifier } from './user-admin.notifier';
import { UserAdminRepository } from './user-admin.repository';

export interface AdminActor {
  userId: string;
  organizationId: string;
  canManage: boolean;
  /** May raise User Requests (`user-requests:create`); gates the Request Change menu. */
  canRequest: boolean;
  sessionId?: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

const SCOPE_LABELS: Record<string, string> = {
  GLOBAL: 'Global',
  ORGANIZATION: 'Organization',
  ORG: 'Organization',
  BRANCH: 'Branch',
  DEPARTMENT: 'Department',
  TEAM: 'Team',
  OWN: 'Own Records',
  RESOURCE: 'Resource',
};

/**
 * User Details: the current account, profile, access and security state of a
 * provisioned user. Approval history lives in User Requests; this service only
 * links to it (Request History).
 */
export class UserAdminService {
  private readonly notifier: UserAdminNotifier;

  constructor(private readonly repo = new UserAdminRepository()) {
    this.notifier = new UserAdminNotifier(repo);
  }

  // ---------------------------------------------------------------------------
  // Profile (header, overview, personal, employee, contact, organization, security)
  // ---------------------------------------------------------------------------

  async profile(id: string, actor: AdminActor) {
    const user = await this.load(id);
    const membership =
      user.userTenants.find((t) => t.tenantId === actor.organizationId) ?? user.userTenants[0];
    const people = [user.reportingManagerId, user.assignedOfficerId].filter(
      (v): v is string => !!v
    );
    const [[branch, department, persons], lastFailed, activeSessions, pendingInvite, access] =
      await Promise.all([
        this.repo.findNames({
          branchId: user.branchId,
          departmentId: membership?.departmentId ?? null,
          people,
        }),
        this.repo.lastFailedLogin(user.email),
        this.repo.countLiveSessions(user.id, actor.organizationId),
        this.repo.findPendingInvitation(user.email, actor.organizationId),
        this.access(id, actor.organizationId),
      ]);
    const requests = await this.repo.listRequests(user.id, actor.organizationId);
    const person = (pid: string | null) => {
      const p = pid ? persons.find((x) => x.id === pid) : null;
      return p ? { id: p.id, name: p.fullName } : null;
    };
    const accountStatus = accountStatusOf(user);

    return {
      id: user.id,
      userCode: formatUserCode(user.userNo),
      accountStatus,
      statusLabel: ACCOUNT_STATUS_LABELS[accountStatus],
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastLoginDatetime: iso(user.currentLoginDatetime ?? user.lastLoginDatetime),
      personal: {
        username: user.username,
        firstName: user.firstName,
        middleName: user.middleName,
        lastName: user.lastName,
        displayName: user.displayName,
        fullName: user.fullName,
        userType: user.userType,
        language: user.language,
        timezone: user.timezone,
        dateOfBirth: day(user.dateOfBirth),
        gender: user.gender,
      },
      family: {
        fatherName: user.fatherName,
        motherName: user.motherName,
        maritalStatus: user.maritalStatus,
        spouseName: user.spouseName,
        spouseDateOfBirth: day(user.spouseDateOfBirth),
      },
      employee: {
        employeeCode: user.employeeCode,
        employmentType: user.employmentType,
        designation: user.jobTitle,
        joiningDate: iso(user.joiningDate),
        endDate: iso(user.endDate),
        company: user.company ?? membership?.tenant.name ?? null,
        workLocation: user.workLocation,
        costCenter: user.costCenter,
      },
      contact: {
        workEmail: user.email,
        mobile: user.mobile,
        alternateEmail: user.alternateEmail,
        alternateMobile: user.alternateMobile,
        addressLine1: user.addressLine1,
        addressLine2: user.addressLine2,
        city: user.city,
        state: user.state,
        country: user.country,
        postalCode: user.postalCode,
      },
      organization: {
        organization: membership
          ? { id: membership.tenant.id, name: membership.tenant.name }
          : null,
        branch,
        department,
        team: user.teams[0] ?? null,
        reportingManager: person(user.reportingManagerId),
        assignedOfficer: person(user.assignedOfficerId),
        costCenter: user.costCenter,
        location: user.workLocation,
        accessScope: user.accessScope,
      },
      // The schema keeps one branch and undated team memberships, so begin/end follow employment.
      branches: branch
        ? [
            {
              ...branch,
              beginDate: iso(user.joiningDate),
              endDate: iso(user.endDate),
              status: user.endDate ? 'Ended' : 'Active',
            },
          ]
        : [],
      teams: user.teams.map((t) => ({
        ...t,
        beginDate: iso(user.joiningDate),
        endDate: iso(user.endDate),
        status: user.endDate ? 'Ended' : 'Active',
      })),
      security: {
        emailVerified: user.emailVerified,
        emailVerifiedAt: iso(user.emailVerifiedAt),
        mfaEnabled: user.mfaEnabled,
        mfaMethod: user.mfaMethod,
        mfaEnrolledAt: iso(user.mfaEnrolledAt),
        isAccountLocked: user.isAccountLocked || user.status === 'LOCKED',
        lockedOn: iso(user.lastLockedDate),
        lockReason: user.lockReason,
        failedLoginAttempts: user.failedLoginAttempts,
        lastFailedLogin: iso(lastFailed?.attemptedAt),
        lastSuccessfulLogin: iso(user.currentLoginDatetime ?? user.lastLoginDatetime),
        passwordChangedAt: iso(user.passwordChangedAt),
        passwordResetRequired: user.passwordResetFlag,
        hasPassword: !!user.passwordHash,
      },
      counts: {
        groups: user._count.userGroups,
        roles: access.roles.length,
        effectivePermissions: access.permissions.length,
        activeSessions,
        requests: requests.length,
      },
      pendingInvitation: pendingInvite
        ? {
            id: pendingInvite.id,
            sentAt: pendingInvite.createdAt.toISOString(),
            expiresAt: pendingInvite.expiresAt.toISOString(),
          }
        : null,
      latestRequest: requests[0] ? { id: requests[0].id, refNo: requests[0].refNo } : null,
      actions: allowedUserActions(
        { accountStatus, mfaEnabled: user.mfaEnabled, activeSessions },
        actor.canManage
      ),
      requestableChanges: requestableChanges(
        { accountStatus, mfaEnabled: user.mfaEnabled, activeSessions },
        actor.canRequest
      ),
    };
  }

  // ---------------------------------------------------------------------------
  // Access: User → Group → Role → Permission
  // ---------------------------------------------------------------------------

  async access(id: string, organizationId: string) {
    const user = await this.load(id);
    const [groups, direct] = await Promise.all([
      this.repo.listGroups(id),
      this.repo.listDirectRoles(id, organizationId),
    ]);
    const assignerIds = [
      ...new Set([...groups, ...direct].map((a) => a.assignedBy).filter((v): v is string => !!v)),
    ];
    const assigners = new Map(
      (await this.repo.userNames(assignerIds)).map((u) => [u.id, u.fullName])
    );
    const assignedBy = (idOrNull: string | null) =>
      idOrNull ? (assigners.get(idOrNull) ?? 'Unknown') : 'System';
    const scopeOf = (roleScope: string) =>
      SCOPE_LABELS[user.accessScope ?? ''] ?? SCOPE_LABELS[roleScope] ?? roleScope;

    const roles = [
      ...direct.map((a) => ({
        roleId: a.role.id,
        name: a.role.name,
        key: a.role.key,
        source: 'Direct',
        sourceType: 'DIRECT' as const,
        groupId: null as string | null,
        scope: scopeOf(a.role.scope),
        assignedBy: assignedBy(a.assignedBy),
        assignedOn: a.createdAt.toISOString(),
        assignmentId: a.id,
      })),
      ...groups.flatMap((g) =>
        g.group.groupRoles.map(({ role }) => ({
          roleId: role.id,
          name: role.name,
          key: role.key,
          source: `Group: ${g.group.name}`,
          sourceType: 'GROUP' as const,
          groupId: g.group.id,
          scope: scopeOf(role.scope),
          assignedBy: assignedBy(g.assignedBy),
          assignedOn: g.createdAt.toISOString(),
          assignmentId: null as string | null,
        }))
      ),
    ];

    const perms = await this.repo.rolePermissions([...new Set(roles.map((r) => r.roleId))]);
    const byKey = new Map<
      string,
      { resource: string; action: string; sources: Set<string>; scopes: Set<string> }
    >();
    for (const role of roles) {
      for (const p of perms.filter((x) => x.roleId === role.roleId)) {
        const [resource, ...rest] = p.permission.key.split(':');
        const entry = byKey.get(p.permission.key) ?? {
          resource: p.permission.resource ?? resource,
          action: p.permission.action ?? rest.join(':'),
          sources: new Set<string>(),
          scopes: new Set<string>(),
        };
        entry.sources.add(
          role.sourceType === 'DIRECT' ? role.name : `${role.name} (${role.source})`
        );
        entry.scopes.add(role.scope);
        byKey.set(p.permission.key, entry);
      }
    }

    return {
      groups: groups.map((g) => ({
        groupId: g.group.id,
        name: g.group.name,
        type: g.group.type,
        rolesInherited: g.group.groupRoles.length,
        scope: SCOPE_LABELS[user.accessScope ?? ''] ?? 'Organization',
        assignedOn: g.createdAt.toISOString(),
        assignedBy: assignedBy(g.assignedBy),
      })),
      roles,
      permissions: [...byKey.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, e]) => ({
          key,
          resource: e.resource,
          permission: e.action,
          source: [...e.sources].join(', '),
          scope: [...e.scopes].join(', '),
        })),
    };
  }

  // ---------------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------------

  async sessions(id: string, actor: AdminActor) {
    await this.load(id);
    const rows = await this.repo.listLiveSessions(id, actor.organizationId);
    return rows.map((s) => {
      const ua = describeUserAgent(s.userAgent);
      return {
        id: s.id,
        device: ua.platform ?? 'Unknown device',
        browser: ua.browser ?? 'Unknown browser',
        isMobile: ua.isMobile,
        ipAddress: s.ipAddress,
        loginAt: s.createdAt.toISOString(),
        lastActivityAt: s.lastActivityAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        isCurrent: s.id === actor.sessionId,
      };
    });
  }

  async revokeSession(id: string, sessionId: string, actor: AdminActor) {
    this.assertManage(actor);
    await this.load(id);
    await new SessionsService().revoke(
      actor.organizationId,
      sessionId,
      actor.userId,
      ORG_WIDE_SESSION_SCOPE,
      actor.sessionId
    );
    return this.sessions(id, actor);
  }

  /** Revokes every session of the user; when admins revoke their own, the current one is kept. */
  async revokeAllSessions(id: string, actor: AdminActor) {
    this.assertManage(actor);
    await this.load(id);
    const result = await new SessionsService().revokeAllForUser(
      actor.organizationId,
      id,
      actor.userId,
      ORG_WIDE_SESSION_SCOPE,
      actor.sessionId
    );
    return { ...result, sessions: await this.sessions(id, actor) };
  }

  // ---------------------------------------------------------------------------
  // Security actions
  // ---------------------------------------------------------------------------

  async sendPasswordReset(id: string, actor: AdminActor) {
    this.assertManage(actor);
    const user = await this.load(id);
    const status = accountStatusOf(user);
    if (!user.passwordHash || (status !== 'ACTIVE' && status !== 'LOCKED')) {
      throw new AppError(
        'Password reset is only available for activated accounts',
        409,
        'RESET_NOT_ALLOWED'
      );
    }
    await this.issuePasswordReset(user, 'Admin: send password reset');
    await AuditService.log({
      action: 'user.password_reset_sent',
      resource: 'user',
      resourceId: id,
      organizationId: actor.organizationId,
      actorId: actor.userId,
      severity: 'warning',
    });
    return this.profile(id, actor);
  }

  async resendInvitation(id: string, actor: AdminActor) {
    this.assertManage(actor);
    const user = await this.load(id);
    const status = accountStatusOf(user);
    if (status !== 'INVITED' && status !== 'PENDING_VERIFICATION') {
      throw new AppError('Only invited users can be sent a new invitation', 409, 'NOT_INVITED');
    }
    await this.notifier.track(
      user,
      'INVITATION',
      'You have been invited to Zellavora Control Center',
      'Admin: resend invitation',
      async () => {
        await new InvitationService().issueForUser(
          {
            userId: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          { userId: actor.userId, organizationId: actor.organizationId }
        );
        return undefined;
      }
    );
    await AuditService.log({
      action: 'user.invitation_resent',
      resource: 'user',
      resourceId: id,
      organizationId: actor.organizationId,
      actorId: actor.userId,
    });
    return this.profile(id, actor);
  }

  /** Emails the user after an account-state change made through the status/lock endpoints. */
  async notifyStatusChange(id: string, to: AccountStatus, reason: string | null) {
    const user = await this.repo.findUser(id);
    if (!user) return;
    const messages: Partial<
      Record<AccountStatus, [Parameters<UserAdminNotifier['send']>[1], string, string]>
    > = {
      ACTIVE: [
        'ACCOUNT_ACTIVATED',
        'Your account is active',
        'Your Zellavora Control Center account has been activated. You can sign in now.',
      ],
      LOCKED: [
        'ACCOUNT_LOCKED',
        'Your account has been locked',
        `An administrator locked your account.${reason ? ` Reason: ${reason}` : ''}`,
      ],
      INACTIVE: [
        'ACCOUNT_DEACTIVATED',
        'Your account has been deactivated',
        'An administrator deactivated your account. Contact them if you need access.',
      ],
      DISABLED: [
        'ACCOUNT_DEACTIVATED',
        'Your account has been disabled',
        'An administrator disabled your account.',
      ],
    };
    const message = messages[to];
    if (message)
      await this.notifier.send(
        user,
        message[0],
        message[1],
        message[2],
        `Account status changed to ${ACCOUNT_STATUS_LABELS[to]}`
      );
  }

  // ---------------------------------------------------------------------------
  // Notes & history
  // ---------------------------------------------------------------------------

  async notes(id: string) {
    await this.load(id);
    const rows = await this.repo.listNotes(id);
    return rows.map((n) => ({
      id: n.id,
      noteType: n.noteType,
      visibility: n.visibility,
      body: n.body,
      attachmentUrl: n.attachmentUrl,
      authorName: n.authorName ?? 'System',
      createdAt: n.createdAt.toISOString(),
    }));
  }

  async addNote(id: string, dto: AddUserNoteDto, actor: AdminActor) {
    await this.load(id);
    const author = (await this.repo.userNames([actor.userId]))[0];
    const note = await this.repo.addNote({
      userId: id,
      organizationId: actor.organizationId,
      noteType: dto.noteType,
      visibility: dto.visibility,
      body: dto.body,
      attachmentUrl: dto.attachmentUrl ?? null,
      authorId: actor.userId,
      authorName: author?.fullName ?? null,
    });
    await AuditService.log({
      action: 'user.note_added',
      resource: 'user',
      resourceId: id,
      organizationId: actor.organizationId,
      actorId: actor.userId,
      metadata: { noteId: note.id, noteType: dto.noteType },
    });
    return this.notes(id);
  }

  async requestHistory(id: string, organizationId: string) {
    await this.load(id);
    const rows = await this.repo.listRequests(id, organizationId);
    return rows.map((r) => ({
      id: r.id,
      refNo: r.refNo,
      type: r.type,
      typeLabel: TYPE_LABELS[r.type as RequestType] ?? r.type,
      requestedBy: r.requestedBy?.fullName ?? null,
      createdAt: r.createdAt.toISOString(),
      status: r.status,
      statusLabel: STATUS_LABELS[r.status as RequestStatus] ?? r.status,
    }));
  }

  async statusHistory(id: string) {
    await this.load(id);
    const rows = await this.repo.listStatusHistory(id);
    const label = (s: string | null) =>
      s ? (ACCOUNT_STATUS_LABELS[s as AccountStatus] ?? s) : null;
    return rows.map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus,
      fromLabel: label(h.fromStatus),
      toStatus: h.toStatus,
      toLabel: label(h.toStatus),
      reason: h.reason,
      actorName: h.actorName ?? 'System',
      createdAt: h.createdAt.toISOString(),
    }));
  }

  async emailHistory(id: string) {
    await this.load(id);
    const [logs, requestEmails] = await Promise.all([
      this.repo.listEmailLogs(id),
      this.repo.listRequestEmails(id),
    ]);
    return [
      ...logs.map((m) => ({
        id: m.id,
        type: m.type,
        recipient: m.recipient,
        subject: m.subject,
        trigger: m.trigger,
        sentOn: iso(m.sentAt ?? m.createdAt),
        deliveryStatus: m.deliveryStatus,
        attempts: m.attempts,
        lastError: m.lastError,
        requestRef: null as string | null,
      })),
      ...requestEmails.map((m) => ({
        id: m.id,
        type: m.template,
        recipient: m.recipient,
        subject: m.subject,
        trigger: m.trigger,
        sentOn: iso(m.sentAt ?? m.createdAt),
        deliveryStatus: m.deliveryStatus,
        attempts: m.attempts,
        lastError: m.lastError,
        requestRef: m.request.refNo,
      })),
    ].sort((a, b) => (b.sentOn ?? '').localeCompare(a.sentOn ?? ''));
  }

  async audit(id: string) {
    await this.load(id);
    const rows = await this.repo.listAudit(id);
    return rows.map((log) => {
      const meta = (log.metadata ?? {}) as Record<string, unknown>;
      const { before, after, ...rest } = meta;
      return {
        id: log.id,
        timestamp: log.createdAt.toISOString(),
        actor: log.actor?.fullName ?? 'System',
        action: log.action,
        module: 'IAM',
        targetUser: id,
        before: (before as Record<string, unknown> | null) ?? null,
        after: (after as Record<string, unknown> | null) ?? null,
        result:
          log.severity === 'error' || log.severity === 'critical' || log.action === 'login_failed'
            ? 'Failed'
            : 'Success',
        correlationId: log.requestId,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        metadata: rest,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async load(id: string) {
    if (!UUID_PATTERN.test(id)) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    const user = await this.repo.findUser(id);
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    return user;
  }

  private assertManage(actor: AdminActor) {
    if (!actor.canManage)
      throw new AppError('Insufficient permission', 403, 'FORBIDDEN_PERMISSION');
  }

  private async issuePasswordReset(
    user: { id: string; email: string; fullName: string },
    trigger: string
  ) {
    const { token, hash } = OneTimeTokenService.generate();
    await this.repo.createPasswordReset({
      userId: user.id,
      email: user.email,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + config.passwordResetTokenExpiryMinutes * 60 * 1000),
    });
    const link = `${config.appUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;
    await this.notifier.track(user, 'PASSWORD_RESET', 'Reset your password', trigger, async () =>
      (await sendPasswordResetEmail(user.email, link, config.passwordResetTokenExpiryMinutes))
        ? null
        : 'Password reset email could not be delivered'
    );
  }
}
