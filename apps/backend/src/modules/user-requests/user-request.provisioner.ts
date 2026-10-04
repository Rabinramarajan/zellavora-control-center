import { Prisma } from '@prisma/client';
import { AppError } from '../../middleware/error';
import { AuditService } from '../../infrastructure/audit';
import { cacheDelPattern } from '../../infrastructure/cache';
import type { TxClient } from '../../infrastructure/prisma';
import { AccessCalculator, AccessState, applyRequest } from './user-request.access';
import { RequestPayload } from './user-request.dto';
import { UserRequestRepository } from './user-request.repository';
import { RequestType } from './user-request.types';
import { accountStatusOf, recordStatusChange } from '../users/account-status';

export interface ProvisionInput {
  id: string;
  type: RequestType;
  organizationId: string;
  targetUserId: string | null;
  payload: RequestPayload;
}

export interface ProvisionResult {
  userId: string;
  /** NEW_USER: the account exists but the person still has to accept the invitation. */
  awaitingActivation: boolean;
  inviteEmail: string | null;
}

export const composeFullName = (u: RequestPayload['user']): string | null =>
  u.displayName || [u.firstName, u.middleName, u.lastName].filter(Boolean).join(' ') || null;

const defined = <T extends Record<string, unknown>>(obj: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined)
  ) as Partial<T>;

/**
 * Applies an approved request to the directory. Everything runs in a single
 * transaction so a failure leaves the account untouched and the request FAILED.
 */
export class UserRequestProvisioner {
  private readonly access: AccessCalculator;

  constructor(private readonly repo: UserRequestRepository) {
    this.access = new AccessCalculator(repo);
  }

  async provision(input: ProvisionInput, actorId: string): Promise<ProvisionResult> {
    let result: ProvisionResult;
    if (input.type === 'NEW_ORGANIZATION') {
      result = await this.activateOrganization(input, actorId);
    } else if (input.type === 'NEW_USER') {
      // A self-registration request already owns its account, created in
      // PENDING at sign-up. Creating another would collide on the email, so
      // that case activates the existing row instead.
      result = input.targetUserId
        ? await this.activateSelfRegistered(input, actorId)
        : await this.createUser(input, actorId);
    } else {
      result = await this.updateUser(input, actorId);
    }
    void cacheDelPattern('iam:users:*');
    return result;
  }

  /**
   * Approves a self-registered organization: the organization row and its owner
   * membership already exist from sign-up, both inactive. This activates the
   * pair, which is what "Create Tenant" means once the rows are already there.
   */
  private async activateOrganization(
    input: ProvisionInput,
    actorId: string
  ): Promise<ProvisionResult> {
    const userId = input.targetUserId;
    if (!userId) throw new AppError('Request has no target user', 400, 'TARGET_USER_REQUIRED');
    const existing = await this.repo.findUserForRequest(userId, input.organizationId);
    if (!existing) throw new AppError('Target user no longer exists', 404, 'USER_NOT_FOUND');
    const previousStatus = accountStatusOf(existing);

    await this.repo.transaction(async (tx) => {
      const org = await tx.organization.update({
        where: { id: input.organizationId },
        data: {
          status: 'active',
          isVerified: true,
          verifiedAt: new Date(),
          updatedBy: actorId,
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: { status: 'ACTIVE', updatedBy: actorId },
      });
      // The owner membership was written at sign-up; re-assert the role so an
      // edited request cannot downgrade the only administrator of a new tenant.
      await tx.userTenant.update({
        where: { userId_tenantId: { userId, tenantId: input.organizationId } },
        data: { role: 'owner' },
      });
      await AuditService.log(
        {
          action: 'organization_created',
          resource: 'organization',
          resourceId: input.organizationId,
          organizationId: input.organizationId,
          actorId,
          before: { status: 'pending_verification', ownerStatus: existing.status },
          after: { status: 'active', ownerStatus: 'ACTIVE', clientCode: org.clientCode },
          metadata: { requestId: input.id, selfRegistered: true },
        },
        tx
      );
      await recordStatusChange(
        {
          userId,
          organizationId: input.organizationId,
          from: previousStatus,
          to: 'ACTIVE',
          reason: 'Organization registration approved',
          actorId,
        },
        tx
      );
    });

    return { userId, awaitingActivation: false, inviteEmail: null };
  }

  private async createUser(input: ProvisionInput, actorId: string): Promise<ProvisionResult> {
    const { user, employee, contact, organization, access } = input.payload;
    const email = contact.workEmail;
    if (!email)
      throw new AppError(
        'Work email is required to create the account',
        400,
        'WORK_EMAIL_REQUIRED'
      );
    const conflicts = await this.repo.findConflicts({
      email,
      username: user.username,
      employeeCode: employee.employeeCode,
    });
    if (conflicts.length) {
      throw new AppError(
        'Email, username or employee code is already in use',
        409,
        'USER_CONFLICT'
      );
    }
    const requested = applyRequest(
      {
        branchId: null,
        departmentId: null,
        teamIds: [],
        groupIds: [],
        roleIds: [],
        accessScope: null,
      },
      'NEW_USER',
      input.payload
    );

    const userId = await this.repo.transaction(async (tx) => {
      const departmentName = requested.departmentId
        ? (
            await tx.department.findUnique({
              where: { id: requested.departmentId },
              select: { name: true },
            })
          )?.name
        : null;
      const created = await tx.user.create({
        data: {
          email,
          emailId: email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          displayName: user.displayName,
          fullName: composeFullName(user) ?? email,
          userType: user.userType,
          employeeCode: employee.employeeCode,
          jobTitle: employee.designation,
          department: departmentName ?? null,
          mobile: contact.contactNumber,
          country: contact.country,
          middleName: user.middleName,
          employmentType: employee.employmentType,
          joiningDate: employee.joiningDate,
          company: employee.company,
          workLocation: employee.workLocation ?? organization.location,
          costCenter: organization.costCenter,
          assignedOfficerId: organization.assignedOfficerId,
          accessScope: organization.accessScope,
          alternateEmail: contact.alternateEmail,
          alternateMobile: contact.alternateContactNumber,
          addressLine1: contact.addressLine1,
          addressLine2: contact.addressLine2,
          city: contact.city,
          state: contact.state,
          postalCode: contact.postalCode,
          branchId: requested.branchId,
          reportingManagerId: organization.reportingManagerId,
          tenantId: input.organizationId,
          status: 'PENDING',
          createdBy: actorId,
        },
      });
      await tx.userTenant.create({
        data: {
          userId: created.id,
          tenantId: input.organizationId,
          departmentId: requested.departmentId,
          isDefault: true,
        },
      });
      await this.syncAccess(
        tx,
        created.id,
        input.organizationId,
        { ...requested, roleIds: [], groupIds: [], teamIds: [] },
        requested,
        actorId
      );
      await AuditService.log(
        {
          action: 'user.created',
          resource: 'user',
          resourceId: created.id,
          organizationId: input.organizationId,
          actorId,
          after: {
            email,
            username: user.username,
            employeeCode: employee.employeeCode,
            roles: access.addRoleIds,
            groups: access.addGroupIds,
          },
          metadata: { requestId: input.id },
        },
        tx
      );
      await recordStatusChange(
        {
          userId: created.id,
          organizationId: input.organizationId,
          from: null,
          to: 'INVITED',
          reason: 'Provisioned from user request',
          actorId,
        },
        tx
      );
      return created.id;
    });

    return { userId, awaitingActivation: true, inviteEmail: email };
  }

  /**
   * Approves an account that registered itself: the person already chose a
   * password, so there is no invitation to accept — the account goes straight
   * to ACTIVE and the requested access is applied.
   */
  private async activateSelfRegistered(
    input: ProvisionInput,
    actorId: string
  ): Promise<ProvisionResult> {
    const userId = input.targetUserId;
    if (!userId) throw new AppError('Request has no target user', 400, 'TARGET_USER_REQUIRED');
    const existing = await this.repo.findUserForRequest(userId, input.organizationId);
    if (!existing) throw new AppError('Target user no longer exists', 404, 'USER_NOT_FOUND');

    const current = await this.access.currentAccess(userId, input.organizationId);
    const requested = applyRequest(current, 'NEW_USER', input.payload);
    const previousStatus = accountStatusOf(existing);

    await this.repo.transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { status: 'ACTIVE', updatedBy: actorId },
      });
      await this.syncAccess(tx, userId, input.organizationId, current, requested, actorId);
      await AuditService.log(
        {
          action: 'user.activated',
          resource: 'user',
          resourceId: userId,
          organizationId: input.organizationId,
          actorId,
          before: { status: existing.status },
          after: { status: 'ACTIVE', roles: input.payload.access.addRoleIds },
          metadata: { requestId: input.id, selfRegistered: true },
        },
        tx
      );
      await recordStatusChange(
        {
          userId,
          organizationId: input.organizationId,
          from: previousStatus,
          to: 'ACTIVE',
          reason: 'Self-registration approved',
          actorId,
        },
        tx
      );
    });

    return { userId, awaitingActivation: false, inviteEmail: null };
  }

  private async updateUser(input: ProvisionInput, actorId: string): Promise<ProvisionResult> {
    const userId = input.targetUserId;
    if (!userId) throw new AppError('Request has no target user', 400, 'TARGET_USER_REQUIRED');
    const existing = await this.repo.findUserForRequest(userId, input.organizationId);
    if (!existing) throw new AppError('Target user no longer exists', 404, 'USER_NOT_FOUND');

    const current = await this.access.currentAccess(userId, input.organizationId);
    const requested = applyRequest(current, input.type, input.payload);
    const { user, employee, contact, organization } = input.payload;

    await this.repo.transaction(async (tx) => {
      const data: Prisma.UserUncheckedUpdateInput = { updatedBy: actorId };
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      const set = (field: keyof typeof existing & string, value: unknown) => {
        if (value === null || value === undefined || existing[field] === value) return;
        before[field] = existing[field];
        after[field] = value;
        (data as Record<string, unknown>)[field] = value;
      };

      switch (input.type) {
        case 'UPDATE_USER': {
          const fullName =
            user.firstName || user.lastName || user.displayName
              ? composeFullName({
                  ...user,
                  firstName: user.firstName ?? existing.firstName,
                  lastName: user.lastName ?? existing.lastName,
                })
              : null;
          const conflicts = await this.repo.findConflicts({
            email: contact.workEmail,
            username: user.username,
            employeeCode: employee.employeeCode,
            excludeUserId: userId,
          });
          if (conflicts.length)
            throw new AppError(
              'Email, username or employee code is already in use',
              409,
              'USER_CONFLICT'
            );
          Object.entries(
            defined({
              username: user.username,
              firstName: user.firstName,
              lastName: user.lastName,
              displayName: user.displayName,
              fullName,
              userType: user.userType,
              employeeCode: employee.employeeCode,
              jobTitle: employee.designation,
              mobile: contact.contactNumber,
              country: contact.country,
              email: contact.workEmail,
              reportingManagerId: organization.reportingManagerId,
              middleName: user.middleName,
              employmentType: employee.employmentType,
              joiningDate: employee.joiningDate,
              company: employee.company,
              workLocation: employee.workLocation,
              alternateEmail: contact.alternateEmail,
              alternateMobile: contact.alternateContactNumber,
              addressLine1: contact.addressLine1,
              addressLine2: contact.addressLine2,
              city: contact.city,
              state: contact.state,
              postalCode: contact.postalCode,
            })
          ).forEach(([k, v]) => set(k as keyof typeof existing & string, v));
          break;
        }
        case 'TRANSFER':
          set('reportingManagerId', organization.reportingManagerId);
          set('assignedOfficerId', organization.assignedOfficerId);
          set('costCenter', organization.costCenter);
          set('workLocation', organization.location);
          set('accessScope', organization.accessScope);
          break;
        case 'ACTIVATE_USER':
          set('status', 'ACTIVE');
          set('isAccountLocked', false);
          data.failedLoginAttempts = 0;
          break;
        case 'DEACTIVATE_USER':
          set('status', 'INACTIVE');
          break;
        case 'UNLOCK_ACCOUNT':
          set('isAccountLocked', false);
          if (existing.status === 'LOCKED') set('status', 'ACTIVE');
          data.failedLoginAttempts = 0;
          data.lastLockedDate = null;
          break;
        case 'RESET_MFA':
          before['mfaEnabled'] = existing.mfaEnabled;
          after['mfaEnabled'] = false;
          Object.assign(data, {
            mfaEnabled: false,
            enable2fa: false,
            mfaMethod: null,
            mfaSecret: null,
            mfaEnrolledAt: null,
            mfaLastUsedCounter: null,
            recoveryCodes: Prisma.DbNull,
          });
          break;
        default:
          break;
      }

      if (requested.branchId !== current.branchId) {
        before['branchId'] = current.branchId;
        after['branchId'] = requested.branchId;
        data.branchId = requested.branchId;
      }
      if (requested.departmentId !== current.departmentId) {
        const dept = requested.departmentId
          ? await tx.department.findUnique({
              where: { id: requested.departmentId },
              select: { name: true },
            })
          : null;
        before['departmentId'] = current.departmentId;
        after['departmentId'] = requested.departmentId;
        data.department = dept?.name ?? null;
        await tx.userTenant.upsert({
          where: { userId_tenantId: { userId, tenantId: input.organizationId } },
          create: { userId, tenantId: input.organizationId, departmentId: requested.departmentId },
          update: { departmentId: requested.departmentId },
        });
      }

      await tx.user.update({ where: { id: userId }, data });
      await recordStatusChange(
        {
          userId,
          organizationId: input.organizationId,
          from: accountStatusOf(existing),
          to: accountStatusOf({
            ...existing,
            status: (data.status as string | undefined) ?? existing.status,
            isAccountLocked:
              (data.isAccountLocked as boolean | undefined) ?? existing.isAccountLocked,
          }),
          reason: 'Provisioned from user request',
          actorId,
        },
        tx
      );
      const accessChanges = await this.syncAccess(
        tx,
        userId,
        input.organizationId,
        current,
        requested,
        actorId
      );

      await AuditService.log(
        {
          action: `user.${input.type.toLowerCase()}`,
          resource: 'user',
          resourceId: userId,
          organizationId: input.organizationId,
          actorId,
          severity:
            input.type === 'DEACTIVATE_USER' || input.type === 'RESET_MFA' ? 'warning' : 'info',
          before: { ...before, ...accessChanges.before },
          after: { ...after, ...accessChanges.after },
          metadata: { requestId: input.id },
        },
        tx
      );
    });

    return { userId, awaitingActivation: false, inviteEmail: null };
  }

  /** Brings roles, groups and team membership from `current` to `requested`. */
  private async syncAccess(
    tx: TxClient,
    userId: string,
    organizationId: string,
    current: AccessState,
    requested: AccessState,
    actorId: string
  ) {
    const added = (a: string[], b: string[]) => b.filter((id) => !a.includes(id));
    const addRoles = added(current.roleIds, requested.roleIds);
    const removeRoles = added(requested.roleIds, current.roleIds);
    const addGroups = added(current.groupIds, requested.groupIds);
    const removeGroups = added(requested.groupIds, current.groupIds);
    const addTeams = added(current.teamIds, requested.teamIds);
    const removeTeams = added(requested.teamIds, current.teamIds);

    if (removeRoles.length) {
      await tx.userRoleAssignment.deleteMany({
        where: { userId, organizationId, roleId: { in: removeRoles } },
      });
    }
    if (addRoles.length) {
      await tx.userRoleAssignment.createMany({
        data: addRoles.map((roleId) => ({ userId, roleId, organizationId, assignedBy: actorId })),
      });
    }
    if (removeGroups.length)
      await tx.userGroup.deleteMany({ where: { userId, groupId: { in: removeGroups } } });
    if (addGroups.length) {
      await tx.userGroup.createMany({
        data: addGroups.map((groupId) => ({ userId, groupId, assignedBy: actorId })),
        skipDuplicates: true,
      });
    }
    if (addTeams.length || removeTeams.length) {
      await tx.user.update({
        where: { id: userId },
        data: {
          teams: {
            connect: addTeams.map((id) => ({ id })),
            disconnect: removeTeams.map((id) => ({ id })),
          },
        },
      });
      for (const teamId of [...addTeams, ...removeTeams]) {
        const count = await tx.user.count({ where: { teams: { some: { id: teamId } } } });
        await tx.team.update({ where: { id: teamId }, data: { memberCount: count } });
      }
    }

    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    if (addRoles.length || removeRoles.length) {
      before['roleIds'] = current.roleIds;
      after['roleIds'] = requested.roleIds;
    }
    if (addGroups.length || removeGroups.length) {
      before['groupIds'] = current.groupIds;
      after['groupIds'] = requested.groupIds;
    }
    if (addTeams.length || removeTeams.length) {
      before['teamIds'] = current.teamIds;
      after['teamIds'] = requested.teamIds;
    }
    return { before, after };
  }
}
