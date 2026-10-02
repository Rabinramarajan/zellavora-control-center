import { Prisma } from '@prisma/client';
import { config } from '../../config/env';
import { AuditService } from '../../infrastructure/audit';
import { cacheDelPattern } from '../../infrastructure/cache';
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
import {
  ACCOUNT_STATUS_LABELS,
  AccountStatus,
  accountStatusOf,
  recordStatusChange,
} from './account-status';
import { formatUserCode } from './iam-user.mapper';
import { allowedUserActions } from './user-actions';
import { AddUserNoteDto, UpdateUserProfileDto } from './user-admin.dto';
import { UserAdminNotifier } from './user-admin.notifier';
import { UserAdminRepository } from './user-admin.repository';

export interface AdminActor {
  userId: string;
  organizationId: string;
  canManage: boolean;
  sessionId?: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

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
      },
      employee: {
        employeeCode: user.employeeCode,
        employmentType: user.employmentType,
        designation: user.jobTitle,
        joiningDate: iso(user.joiningDate),
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
        {
          accountStatus,
          mfaEnabled: user.mfaEnabled,
          activeSessions,
          passwordResetRequired: user.passwordResetFlag,
        },
        actor.canManage
      ),
    };
  }

  async updateProfile(id: string, dto: UpdateUserProfileDto, actor: AdminActor) {
    const user = await this.load(id);
    const { personal, employee, contact, organization: org } = dto;

    const conflicts = await this.repo.findConflicts(id, {
      email: contact?.workEmail,
      username: personal?.username,
      employeeCode: employee?.employeeCode,
    });
    for (const c of conflicts) {
      if (contact?.workEmail && c.email.toLowerCase() === contact.workEmail) {
        throw new AppError(
          'Work Email is already used by another account',
          409,
          'USER_EMAIL_EXISTS'
        );
      }
      if (personal?.username && c.username === personal.username) {
        throw new AppError('Username is already taken', 409, 'USERNAME_TAKEN');
      }
      if (
        employee?.employeeCode &&
        c.employeeCode?.toLowerCase() === employee.employeeCode.toLowerCase()
      ) {
        throw new AppError('Employee Code is already in use', 409, 'EMPLOYEE_CODE_EXISTS');
      }
    }
    const refs: Array<
      ['branch' | 'department' | 'team' | 'user', string | null | undefined, string]
    > = [
      ['branch', org?.branchId, 'Branch'],
      ['department', org?.departmentId, 'Department'],
      ['team', org?.teamId, 'Team'],
      ['user', org?.reportingManagerId, 'Reporting Manager'],
      ['user', org?.assignedOfficerId, 'Assigned Officer'],
    ];
    for (const [model, refId, label] of refs) {
      if (refId && !(await this.repo.countExisting(model, refId))) {
        throw new AppError(`${label} not found`, 400, 'INVALID_REFERENCE');
      }
    }
    if (org?.reportingManagerId === id) {
      throw new AppError('A user cannot report to themselves', 400, 'INVALID_REFERENCE');
    }

    const changes: Record<string, unknown> = {
      username: personal?.username,
      firstName: personal?.firstName,
      middleName: personal?.middleName,
      lastName: personal?.lastName,
      displayName: personal?.displayName,
      userType: personal?.userType,
      avatarUrl: personal?.avatarUrl,
      language: personal?.language,
      timezone: personal?.timezone,
      employeeCode: employee?.employeeCode,
      employmentType: employee?.employmentType,
      jobTitle: employee?.designation,
      joiningDate: employee?.joiningDate,
      company: employee?.company,
      workLocation: employee?.workLocation,
      costCenter: employee?.costCenter,
      email: contact?.workEmail,
      mobile: contact?.mobile,
      alternateEmail: contact?.alternateEmail,
      alternateMobile: contact?.alternateMobile,
      addressLine1: contact?.addressLine1,
      addressLine2: contact?.addressLine2,
      city: contact?.city,
      state: contact?.state,
      country: contact?.country,
      postalCode: contact?.postalCode,
      branchId: org?.branchId,
      reportingManagerId: org?.reportingManagerId,
      assignedOfficerId: org?.assignedOfficerId,
      accessScope: org?.accessScope,
    };
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    const data: Prisma.UserUncheckedUpdateInput = { updatedBy: actor.userId };
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) continue;
      const current = (user as Record<string, unknown>)[key];
      const same =
        current instanceof Date && value instanceof Date
          ? current.getTime() === value.getTime()
          : current === value;
      if (same) continue;
      before[key] = current ?? null;
      after[key] = value;
      (data as Record<string, unknown>)[key] = value;
    }
    if (
      personal &&
      ('firstName' in after ||
        'middleName' in after ||
        'lastName' in after ||
        'displayName' in after)
    ) {
      const first = (after['firstName'] as string | undefined) ?? user.firstName;
      const middle =
        'middleName' in after ? (after['middleName'] as string | null) : user.middleName;
      const last = (after['lastName'] as string | undefined) ?? user.lastName;
      const display =
        'displayName' in after ? (after['displayName'] as string | null) : user.displayName;
      data.fullName = display || [first, middle, last].filter(Boolean).join(' ') || user.fullName;
    }
    if ('email' in after) data.emailId = after['email'] as string;

    const membership = user.userTenants.find((t) => t.tenantId === actor.organizationId);
    const departmentChanged =
      org &&
      org.departmentId !== undefined &&
      org.departmentId !== (membership?.departmentId ?? null);
    const currentTeam = user.teams[0]?.id ?? null;
    const teamChanged = org && org.teamId !== undefined && org.teamId !== currentTeam;
    if (departmentChanged) {
      before['departmentId'] = membership?.departmentId ?? null;
      after['departmentId'] = org!.departmentId;
    }
    if (teamChanged) {
      before['teamId'] = currentTeam;
      after['teamId'] = org!.teamId;
    }
    if (!Object.keys(after).length) return this.profile(id, actor);

    await this.repo.transaction(async (tx) => {
      if (departmentChanged) {
        const dept = org!.departmentId
          ? await tx.department.findUnique({
              where: { id: org!.departmentId },
              select: { name: true },
            })
          : null;
        data.department = dept?.name ?? null;
        await tx.userTenant.upsert({
          where: { userId_tenantId: { userId: id, tenantId: actor.organizationId } },
          create: {
            userId: id,
            tenantId: actor.organizationId,
            departmentId: org!.departmentId ?? null,
          },
          update: { departmentId: org!.departmentId ?? null },
        });
      }
      await tx.user.update({ where: { id }, data });
      if (teamChanged) {
        await tx.user.update({
          where: { id },
          data: {
            teams: {
              disconnect: user.teams.map((t) => ({ id: t.id })),
              ...(org!.teamId ? { connect: [{ id: org!.teamId }] } : {}),
            },
          },
        });
        for (const teamId of [currentTeam, org!.teamId].filter((v): v is string => !!v)) {
          const count = await tx.user.count({ where: { teams: { some: { id: teamId } } } });
          await tx.team.update({ where: { id: teamId }, data: { memberCount: count } });
        }
      }
    });

    const sections = Object.entries({ personal, employee, contact, organization: org })
      .filter(([, v]) => v)
      .map(([k]) => k);
    await AuditService.log({
      action:
        org && (departmentChanged || teamChanged || 'branchId' in after)
          ? 'user.organization_changed'
          : 'user.profile_updated',
      resource: 'user',
      resourceId: id,
      organizationId: actor.organizationId,
      actorId: actor.userId,
      before,
      after,
      metadata: { sections },
    });
    void cacheDelPattern('iam:users:*');
    return this.profile(id, actor);
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

  /** Blocks sign-in until the password is changed through a reset link, which is sent now. */
  async requirePasswordChange(id: string, actor: AdminActor) {
    this.assertManage(actor);
    const user = await this.load(id);
    if (accountStatusOf(user) !== 'ACTIVE' || !user.passwordHash) {
      throw new AppError(
        'Only active accounts can be required to change password',
        409,
        'RESET_NOT_ALLOWED'
      );
    }
    if (user.passwordResetFlag)
      throw new AppError('A password change is already required', 409, 'ALREADY_REQUIRED');
    await this.repo.transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { passwordResetFlag: true, updatedBy: actor.userId },
      });
    });
    await new SessionsService().revokeAllForUser(
      actor.organizationId,
      id,
      actor.userId,
      ORG_WIDE_SESSION_SCOPE,
      actor.sessionId
    );
    await this.issuePasswordReset(user, 'Admin: require password change');
    await AuditService.log({
      action: 'user.password_change_required',
      resource: 'user',
      resourceId: id,
      organizationId: actor.organizationId,
      actorId: actor.userId,
      severity: 'warning',
      before: { passwordResetRequired: false },
      after: { passwordResetRequired: true },
    });
    return this.profile(id, actor);
  }

  async resetMfa(id: string, actor: AdminActor) {
    this.assertManage(actor);
    const user = await this.load(id);
    if (!user.mfaEnabled)
      throw new AppError('MFA is not enabled for this user', 409, 'MFA_NOT_ENABLED');
    await this.repo.transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          mfaEnabled: false,
          enable2fa: false,
          mfaMethod: null,
          mfaSecret: null,
          mfaEnrolledAt: null,
          mfaLastUsedCounter: null,
          recoveryCodes: Prisma.DbNull,
          updatedBy: actor.userId,
        },
      });
    });
    await AuditService.log({
      action: 'user.mfa_reset',
      resource: 'user',
      resourceId: id,
      organizationId: actor.organizationId,
      actorId: actor.userId,
      severity: 'warning',
      before: { mfaEnabled: true, mfaMethod: user.mfaMethod },
      after: { mfaEnabled: false, mfaMethod: null },
    });
    await this.notifier.send(
      user,
      'MFA_CHANGED',
      'Your multi-factor authentication was reset',
      'An administrator reset multi-factor authentication on your account. You will be asked to enrol again the next time MFA is required.',
      'Admin: reset MFA'
    );
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

  async cancelInvitation(id: string, reason: string | null, actor: AdminActor) {
    this.assertManage(actor);
    const user = await this.load(id);
    const status = accountStatusOf(user);
    if (status !== 'INVITED' && status !== 'PENDING_VERIFICATION') {
      throw new AppError('Only pending invitations can be cancelled', 409, 'NOT_INVITED');
    }
    await this.repo.transaction(async (tx) => {
      await this.repo.revokePendingInvitations(user.email, actor.organizationId, actor.userId, tx);
      await tx.user.update({
        where: { id },
        data: { status: 'DISABLED', updatedBy: actor.userId },
      });
      await recordStatusChange(
        {
          userId: id,
          organizationId: actor.organizationId,
          from: status,
          to: 'DISABLED',
          reason: reason ?? 'Invitation cancelled',
          actorId: actor.userId,
        },
        tx
      );
    });
    await AuditService.log({
      action: 'user.invitation_cancelled',
      resource: 'user',
      resourceId: id,
      organizationId: actor.organizationId,
      actorId: actor.userId,
      severity: 'warning',
      before: { status: user.status },
      after: { status: 'DISABLED' },
      metadata: { reason },
    });
    void cacheDelPattern('iam:users:*');
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
