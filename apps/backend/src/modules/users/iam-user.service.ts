import { AppError } from '../../middleware/error';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
import { AuditService } from '../../infrastructure/audit';
import { cacheDelPattern } from '../../infrastructure/cache';
import { IamUserRepository } from './iam-user.repository';
import { IamUserMapper } from './iam-user.mapper';
import { UserAdminService } from './user-admin.service';
import {
  ACCOUNT_STATUSES,
  AccountStatus,
  accountStatusOf,
  accountStatusWhere,
  recordStatusChange,
} from './account-status';
import { IamUserListQueryDto, LockUserDto } from './iam-user.dto';

const USER_CACHE_PREFIX = 'iam:users:';

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
    const branchIds = [...new Set(data.map((r) => r.branchId).filter((v): v is string => !!v))];
    const branches = new Map((await this.repo.branchNames(branchIds)).map((b) => [b.id, b.name]));
    const rows = data.map((row) =>
      IamUserMapper.toListItem(
        row as never,
        row.branchId ? (branches.get(row.branchId) ?? null) : null
      )
    );
    const totalPages = Math.ceil(total / query.pageSize);
    return { data: rows, meta: { page: query.page, pageSize: query.pageSize, total, totalPages } };
  }

  /** Counts per account status (Invited, Active, Locked, ...), matching the list filter. */
  async stats() {
    const counts = await Promise.all(
      ACCOUNT_STATUSES.map((s) =>
        this.repo.countWhere({ isDeleted: false, ...accountStatusWhere([s]) })
      )
    );
    const byStatus = Object.fromEntries(ACCOUNT_STATUSES.map((s, i) => [s, counts[i]])) as Record<
      AccountStatus,
      number
    >;
    const total = await this.repo.countWhere({ isDeleted: false });
    return { total, byStatus };
  }

  async getById(id: string) {
    // Prisma throws a 500 on non-UUID input for @db.Uuid columns; treat it as a missing user.
    if (!UUID_PATTERN.test(id)) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    const row = await this.repo.findByIdDetail(id);
    if (!row) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    return IamUserMapper.toDetail(row as never);
  }

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  async lock(id: string, dto: LockUserDto, actorId?: string | null) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    if (existing.isAccountLocked || existing.status === 'LOCKED') {
      throw new AppError('This account is already locked', 409, 'ALREADY_LOCKED');
    }
    await this.repo.transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          isAccountLocked: true,
          lastLockedDate: new Date(),
          lockReason: dto.reason ?? null,
          status: 'LOCKED',
          updatedBy: actorId ?? null,
        },
      });
      await recordStatusChange(
        { userId: id, from: accountStatusOf(existing), to: 'LOCKED', reason: dto.reason, actorId },
        tx
      );
    });

    await AuditService.log({
      action: 'user.locked',
      resource: 'user',
      resourceId: id,
      severity: 'warning',
      before: { status: existing.status, isAccountLocked: false },
      after: { status: 'LOCKED', isAccountLocked: true },
      metadata: { email: existing.email, reason: dto.reason ?? null },
    });
    await new UserAdminService().notifyStatusChange(id, 'LOCKED', dto.reason ?? null);

    this.invalidate();
    return this.getById(id);
  }

  private invalidate() {
    void cacheDelPattern(`${USER_CACHE_PREFIX}*`);
  }
}
