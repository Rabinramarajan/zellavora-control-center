import { Prisma } from '@prisma/client';
import type { TxClient } from '../../infrastructure/prisma';
import { prisma } from '../../infrastructure/prisma';
import { getRequestContext } from '../../infrastructure/request-context';

/**
 * Account lifecycle as admins see it. INVITED and PENDING_VERIFICATION are both
 * stored as PENDING and told apart by whether the person has set a password.
 * Request workflow states (Pending Approval, ...) never appear here.
 */
export const ACCOUNT_STATUSES = [
  'INVITED',
  'PENDING_VERIFICATION',
  'ACTIVE',
  'INACTIVE',
  'LOCKED',
  'SUSPENDED',
  'DISABLED',
] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  INVITED: 'Invited',
  PENDING_VERIFICATION: 'Pending Verification',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  LOCKED: 'Locked',
  SUSPENDED: 'Suspended',
  DISABLED: 'Disabled',
};

export function accountStatusOf(user: {
  status: string;
  isAccountLocked?: boolean;
  passwordHash?: string | null;
  hasPassword?: boolean;
}): AccountStatus {
  if (user.status === 'PENDING') {
    const hasPassword = user.hasPassword ?? !!user.passwordHash;
    return hasPassword ? 'PENDING_VERIFICATION' : 'INVITED';
  }
  if (user.isAccountLocked && user.status === 'ACTIVE') return 'LOCKED';
  return (ACCOUNT_STATUSES as readonly string[]).includes(user.status)
    ? (user.status as AccountStatus)
    : 'INACTIVE';
}

/** Prisma filter matching any of the given account statuses. */
export function accountStatusWhere(statuses: AccountStatus[]): Prisma.UserWhereInput {
  const or: Prisma.UserWhereInput[] = [];
  const stored = statuses.filter(
    (s) => s !== 'INVITED' && s !== 'PENDING_VERIFICATION' && s !== 'LOCKED'
  );
  if (stored.length) or.push({ status: { in: stored as never[] } });
  if (statuses.includes('LOCKED'))
    or.push({ OR: [{ status: 'LOCKED' }, { isAccountLocked: true }] });
  if (statuses.includes('INVITED')) or.push({ status: 'PENDING', passwordHash: null });
  if (statuses.includes('PENDING_VERIFICATION'))
    or.push({ status: 'PENDING', passwordHash: { not: null } });
  return { OR: or };
}

/**
 * Records an account status transition. Called from every place that changes
 * status (admin actions, provisioning, invitation acceptance) so the Status
 * History timeline is complete.
 */
export async function recordStatusChange(
  input: {
    userId: string;
    organizationId?: string | null;
    from: string | null;
    to: string;
    reason?: string | null;
    actorId?: string | null;
  },
  tx?: TxClient
): Promise<void> {
  if (input.from === input.to) return;
  const db = tx ?? prisma;
  const actor = input.actorId
    ? await db.user.findUnique({ where: { id: input.actorId }, select: { fullName: true } })
    : null;
  await db.userStatusHistory.create({
    data: {
      userId: input.userId,
      organizationId: input.organizationId ?? getRequestContext().organizationId ?? null,
      fromStatus: input.from,
      toStatus: input.to,
      reason: input.reason ?? null,
      actorId: input.actorId ?? null,
      actorName: actor?.fullName ?? (input.actorId ? null : 'System'),
    },
  });
}
