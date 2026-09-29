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

  findActorName(userId: string, tx?: TxClient) {
    return this.getDb(tx).user.findUnique({ where: { id: userId }, select: { fullName: true } });
  }

  findOrganizationName(id: string, tx?: TxClient) {
    return this.getDb(tx).organization.findUnique({ where: { id }, select: { name: true } });
  }
}
