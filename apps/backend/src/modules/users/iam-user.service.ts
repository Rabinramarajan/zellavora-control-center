import { AppError } from '../../middleware/error';
import { AuditService } from '../../infrastructure/audit';
import { cacheDelPattern } from '../../infrastructure/cache';
import { IamUserRepository } from './iam-user.repository';
import { IamUserMapper } from './iam-user.mapper';
import {
  CreateIamUserDto,
  UpdateIamUserDto,
  IamUserListQueryDto,
  SetUserRolesDto,
  SetUserGroupsDto,
  SetUserStatusDto,
  LockUserDto,
} from './iam-user.dto';

const USER_CACHE_PREFIX = 'iam:users:';

const slugifyUsername = (fullName: string): string =>
  fullName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 32);

const VALID_STATUSES = ['ACTIVE', 'INACTIVE', 'LOCKED', 'PENDING', 'SUSPENDED'] as const;

/**
 * IAM Users module service.
 *
 * Manages the directory of users within the admin console: profile metadata,
 * account status/locking, and assignment of roles and groups. Roles and groups
 * are the two RBAC dimensions; assignments are diff-based (`replace`/`merge`).
 */
export class IamUserService {
  private readonly repo: IamUserRepository;

  constructor(repo?: IamUserRepository) {
    this.repo = repo ?? new IamUserRepository();
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  async list(query: IamUserListQueryDto) {
    const { data, total } = await this.repo.list(query);
    const rows = data.map((row) => IamUserMapper.toListItem(row as never));
    const totalPages = Math.ceil(total / query.pageSize);
    return { data: rows, meta: { page: query.page, pageSize: query.pageSize, total, totalPages } };
  }

  async getById(id: string) {
    const row = await this.repo.findByIdDetail(id);
    if (!row) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    return IamUserMapper.toDetail(row as never);
  }

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  async create(dto: CreateIamUserDto, actorId?: string | null) {
    const existingEmail = await this.repo.findByEmail(dto.email);
    if (existingEmail) {
      throw new AppError(`A user with email '${dto.email}' already exists`, 409, 'USER_EMAIL_EXISTS');
    }
    const username = dto.username ?? slugifyUsername(dto.fullName);
    const existingUsername = await this.repo.findByUsername(username);
    if (existingUsername) {
      throw new AppError(`Username '${username}' is taken`, 409, 'USERNAME_TAKEN');
    }

    const created = await this.repo.transaction(async (tx) => {
      const user = await this.repo.create(
        {
          email: dto.email,
          username,
          fullName: dto.fullName,
          firstName: dto.firstName ?? null,
          lastName: dto.lastName ?? null,
          mobile: dto.mobile ?? null,
          department: dto.department ?? null,
          jobTitle: dto.jobTitle ?? null,
          timezone: dto.timezone ?? null,
          language: dto.language,
          status: dto.sendInvite ? 'PENDING' : 'ACTIVE',
          createdBy: actorId ?? null,
        },
        tx
      );
      if (dto.roleIds.length) {
        await this.repo.replaceRoles(user.id, dto.roleIds.map((roleId) => ({ roleId })), tx);
      }
      if (dto.groupIds.length) {
        await this.repo.replaceGroups(user.id, dto.groupIds, tx);
      }
      return user;
    });

    await AuditService.log({
      action: dto.sendInvite ? 'user.invited' : 'user.created',
      resource: 'user',
      resourceId: created.id,
      severity: 'info',
      metadata: { email: created.email, username, sendInvite: dto.sendInvite, roles: dto.roleIds.length, groups: dto.groupIds.length },
    });

    this.invalidate();
    return this.getById(created.id);
  }

  async update(id: string, dto: UpdateIamUserDto, actorId?: string | null) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const updated = await this.repo.update(id, {
      ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
      ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
      ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
      ...(dto.mobile !== undefined ? { mobile: dto.mobile } : {}),
      ...(dto.department !== undefined ? { department: dto.department } : {}),
      ...(dto.jobTitle !== undefined ? { jobTitle: dto.jobTitle } : {}),
      ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
      ...(dto.language !== undefined ? { language: dto.language } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      updatedBy: actorId ?? null,
    });

    await AuditService.log({
      action: 'user.updated',
      resource: 'user',
      resourceId: id,
      severity: 'info',
      metadata: { email: existing.email, changed: Object.keys(dto).filter((k) => dto[k] !== undefined) },
    });

    this.invalidate();
    return this.getById(id);
  }

  async setStatus(id: string, dto: SetUserStatusDto, actorId?: string | null) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    if (!VALID_STATUSES.includes(dto.status)) {
      throw new AppError(`Invalid status '${dto.status}'`, 400, 'INVALID_STATUS');
    }

    await this.repo.update(id, {
      status: dto.status,
      ...(dto.status === 'LOCKED' ? { isAccountLocked: true, lastLockedDate: new Date() } : {}),
      ...(dto.status === 'ACTIVE' ? { isAccountLocked: false, lastLockedDate: null, failedLoginAttempts: 0 } : {}),
      updatedBy: actorId ?? null,
    });

    await AuditService.log({
      action: 'user.status_changed',
      resource: 'user',
      resourceId: id,
      severity: dto.status === 'LOCKED' || dto.status === 'SUSPENDED' ? 'warning' : 'info',
      before: { status: existing.status },
      after: { status: dto.status },
      metadata: { email: existing.email, reason: dto.reason ?? null },
    });

    this.invalidate();
    return this.getById(id);
  }

  async lock(id: string, dto: LockUserDto, actorId?: string | null) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    await this.repo.update(id, {
      isAccountLocked: true,
      lastLockedDate: new Date(),
      status: 'LOCKED',
      updatedBy: actorId ?? null,
    });

    await AuditService.log({
      action: 'user.locked',
      resource: 'user',
      resourceId: id,
      severity: 'warning',
      metadata: { email: existing.email, reason: dto.reason ?? null },
    });

    this.invalidate();
    return this.getById(id);
  }

  async unlock(id: string, actorId?: string | null) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    await this.repo.update(id, {
      isAccountLocked: false,
      lastLockedDate: null,
      failedLoginAttempts: 0,
      status: 'ACTIVE',
      updatedBy: actorId ?? null,
    });

    await AuditService.log({
      action: 'user.unlocked',
      resource: 'user',
      resourceId: id,
      severity: 'info',
      metadata: { email: existing.email },
    });

    this.invalidate();
    return this.getById(id);
  }

  async setRoles(id: string, dto: SetUserRolesDto, actorId?: string | null) {
    const user = await this.repo.findById(id);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    const entries = dto.roleIds.map((roleId) => ({ roleId, organizationId: dto.organizationId }));

    await this.repo.transaction(async (tx) => {
      if (dto.mode === 'replace') {
        await this.repo.replaceRoles(id, entries, tx);
      } else {
        await this.repo.mergeRoles(id, entries, tx);
      }
      await tx.user.update({ where: { id }, data: { updatedBy: actorId ?? null } });
    });

    await AuditService.log({
      action: 'user.roles.set',
      resource: 'user',
      resourceId: id,
      severity: dto.mode === 'replace' ? 'warning' : 'info',
      metadata: { email: user.email, mode: dto.mode, roles: dto.roleIds.length },
    });

    this.invalidate();
    return this.getById(id);
  }

  async setGroups(id: string, dto: SetUserGroupsDto, actorId?: string | null) {
    const user = await this.repo.findById(id);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    await this.repo.transaction(async (tx) => {
      if (dto.mode === 'replace') {
        await this.repo.replaceGroups(id, dto.groupIds, tx);
      } else {
        await this.repo.mergeGroups(id, dto.groupIds, tx);
      }
      await tx.user.update({ where: { id }, data: { updatedBy: actorId ?? null } });
    });

    await AuditService.log({
      action: 'user.groups.set',
      resource: 'user',
      resourceId: id,
      severity: dto.mode === 'replace' ? 'warning' : 'info',
      metadata: { email: user.email, mode: dto.mode, groups: dto.groupIds.length },
    });

    this.invalidate();
    return this.getById(id);
  }

  async delete(id: string, actorId?: string | null) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    if (existing.email === 'admin@zellavora.com') {
      throw new AppError('The platform owner cannot be deleted', 403, 'SYSTEM_USER');
    }

    await this.repo.transaction(async (tx) => {
      await tx.userRoleAssignment.deleteMany({ where: { userId: id } });
      await tx.userGroup.deleteMany({ where: { userId: id } });
      await this.repo.softDelete(id, actorId ?? null, tx);
    });

    await AuditService.log({
      action: 'user.deleted',
      resource: 'user',
      resourceId: id,
      severity: 'warning',
      metadata: { email: existing.email },
    });

    this.invalidate();
    return { success: true };
  }

  private invalidate() {
    void cacheDelPattern(`${USER_CACHE_PREFIX}*`);
  }
}
