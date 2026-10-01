import { Prisma } from '@prisma/client';
import { BaseRepository, TxClient } from '../../infrastructure/prisma';

export class InvitationRepository extends BaseRepository {
  transaction<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
    return this.withTransaction(fn);
  }

  findUserByEmail(email: string, tx?: TxClient) {
    return this.getDb(tx).user.findUnique({ where: { email } });
  }

  createPendingUser(
    data: {
      email: string;
      firstName: string | null;
      lastName: string | null;
      organizationId: string;
      createdBy: string;
    },
    tx?: TxClient
  ) {
    const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ') || data.email;
    return this.getDb(tx).user.create({
      data: {
        email: data.email,
        emailId: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        fullName,
        tenantId: data.organizationId,
        status: 'PENDING',
        createdBy: data.createdBy,
      },
    });
  }

  findById(id: string, organizationId: string, tx?: TxClient) {
    return this.getDb(tx).invitation.findFirst({
      where: { id, organizationId, isDeleted: false },
    });
  }

  /** Supersedes any outstanding invitation for the same address in the organization. */
  revokePending(email: string, organizationId: string, actorId: string, tx?: TxClient) {
    return this.getDb(tx).invitation.updateMany({
      where: { email, organizationId, status: 'pending' },
      data: { status: 'revoked', updatedBy: actorId },
    });
  }

  create(
    data: {
      email: string;
      tokenHash: string;
      organizationId: string;
      userId: string;
      firstName: string | null;
      lastName: string | null;
      invitedById: string;
      expiresAt: Date;
    },
    tx?: TxClient
  ) {
    return this.getDb(tx).invitation.create({
      data: {
        email: data.email,
        code: data.tokenHash,
        organizationId: data.organizationId,
        userId: data.userId,
        firstName: data.firstName,
        lastName: data.lastName,
        invitedById: data.invitedById,
        createdBy: data.invitedById,
        expiresAt: data.expiresAt,
        status: 'pending',
      },
    });
  }

  revoke(id: string, actorId: string, tx?: TxClient) {
    return this.getDb(tx).invitation.updateMany({
      where: { id, status: 'pending' },
      data: { status: 'revoked', updatedBy: actorId },
    });
  }

  /** `expired` is derived: a pending invitation past its expiry. */
  async list(
    organizationId: string,
    query: {
      q?: string;
      status?: 'pending' | 'accepted' | 'revoked' | 'expired';
      page: number;
      pageSize: number;
    },
    tx?: TxClient
  ) {
    const now = new Date();
    const where: Prisma.InvitationWhereInput = { organizationId, isDeleted: false };
    if (query.status === 'pending')
      Object.assign(where, { status: 'pending', expiresAt: { gt: now } });
    else if (query.status === 'expired')
      Object.assign(where, { status: 'pending', expiresAt: { lte: now } });
    else if (query.status) where.status = query.status;
    if (query.q) {
      where.OR = [
        { email: { contains: query.q, mode: 'insensitive' } },
        { firstName: { contains: query.q, mode: 'insensitive' } },
        { lastName: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.getDb(tx).invitation.findMany({
        where,
        include: { invitedBy: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.getDb(tx).invitation.count({ where }),
    ]);
    return { data, total };
  }

  async statusCounts(organizationId: string, tx?: TxClient) {
    const now = new Date();
    const base = { organizationId, isDeleted: false };
    const db = this.getDb(tx);
    const [pending, expired, accepted, revoked] = await Promise.all([
      db.invitation.count({ where: { ...base, status: 'pending', expiresAt: { gt: now } } }),
      db.invitation.count({ where: { ...base, status: 'pending', expiresAt: { lte: now } } }),
      db.invitation.count({ where: { ...base, status: 'accepted' } }),
      db.invitation.count({ where: { ...base, status: 'revoked' } }),
    ]);
    return { pending, expired, accepted, revoked };
  }

  findActorName(userId: string, tx?: TxClient) {
    return this.getDb(tx).user.findUnique({ where: { id: userId }, select: { fullName: true } });
  }

  findOrganizationName(id: string, tx?: TxClient) {
    return this.getDb(tx).organization.findUnique({ where: { id }, select: { name: true } });
  }
}
