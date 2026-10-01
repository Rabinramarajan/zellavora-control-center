/**
 * InvitationService — admin-driven onboarding, the default way users join ZCC.
 *
 * Invite -> email link -> /auth/accept-invitation -> set password -> sign in.
 * Tokens are single-use, purpose-bound (invitations table) and stored hashed.
 */
import { config } from '../../config/env';
import { AppError } from '../../middleware/error';
import { addQueueJob } from '../../infrastructure/queue';
import { AuditService, OneTimeTokenService } from '../../services/auth';
import { InvitationRepository } from './invitation.repository';

export interface InviteActor {
  userId: string;
  organizationId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface InviteInput {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

export class InvitationService {
  constructor(private readonly repo = new InvitationRepository()) {}

  /** Invite a new person: creates the pending account when needed, then sends the link. */
  async invite(input: InviteInput, actor: InviteActor) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.repo.findUserByEmail(email);
    if (existing && existing.status !== 'PENDING') {
      throw new AppError(
        'A user with this email already has an active account.',
        409,
        'USER_EMAIL_EXISTS'
      );
    }
    if (existing && existing.tenantId && existing.tenantId !== actor.organizationId) {
      throw new AppError('A user with this email already exists.', 409, 'USER_EMAIL_EXISTS');
    }
    const userId =
      existing?.id ??
      (
        await this.repo.createPendingUser({
          email,
          firstName: input.firstName ?? null,
          lastName: input.lastName ?? null,
          organizationId: actor.organizationId,
          createdBy: actor.userId,
        })
      ).id;

    return this.issueForUser(
      {
        userId,
        email,
        firstName: input.firstName ?? existing?.firstName ?? null,
        lastName: input.lastName ?? existing?.lastName ?? null,
      },
      actor
    );
  }

  /** Issue (or re-issue) an invitation for an existing pending user. */
  async issueForUser(
    user: { userId: string; email: string; firstName: string | null; lastName: string | null },
    actor: InviteActor
  ) {
    const { token, hash } = OneTimeTokenService.generate();
    const expiresAt = new Date(Date.now() + config.invitationTokenExpiryHours * 60 * 60 * 1000);

    const invitation = await this.repo.transaction(async (tx) => {
      await this.repo.revokePending(user.email, actor.organizationId, actor.userId, tx);
      return this.repo.create(
        {
          email: user.email,
          tokenHash: hash,
          organizationId: actor.organizationId,
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          invitedById: actor.userId,
          expiresAt,
        },
        tx
      );
    });

    const [inviter, organization] = await Promise.all([
      this.repo.findActorName(actor.userId),
      this.repo.findOrganizationName(actor.organizationId),
    ]);
    await addQueueJob('send-user-invitation', {
      email: user.email,
      invitationLink: `${config.appUrl}/auth/accept-invitation?token=${encodeURIComponent(token)}`,
      invitedBy: inviter?.fullName ?? 'Your administrator',
      tenantName: organization?.name ?? 'Zellavora Control Center',
    });
    await AuditService.log({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      action: 'invitation_sent',
      resourceType: 'invitation',
      resourceId: invitation.id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      metadata: { email: user.email },
    });

    return { id: invitation.id, email: invitation.email, status: invitation.status, expiresAt };
  }

  async list(
    organizationId: string,
    query: {
      q?: string;
      status?: 'pending' | 'accepted' | 'revoked' | 'expired';
      page: number;
      pageSize: number;
    }
  ) {
    const [{ data, total }, counts] = await Promise.all([
      this.repo.list(organizationId, query),
      this.repo.statusCounts(organizationId),
    ]);
    const now = Date.now();
    return {
      data: data.map((inv) => ({
        id: inv.id,
        email: inv.email,
        firstName: inv.firstName,
        lastName: inv.lastName,
        userId: inv.userId,
        status: inv.status === 'pending' && inv.expiresAt.getTime() <= now ? 'expired' : inv.status,
        invitedById: inv.invitedBy?.id ?? null,
        invitedByName: inv.invitedBy?.fullName ?? null,
        expiresAt: inv.expiresAt.toISOString(),
        usedAt: inv.usedAt?.toISOString() ?? null,
        createdAt: inv.createdAt.toISOString(),
      })),
      counts,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async resend(invitationId: string, actor: InviteActor) {
    const invitation = await this.repo.findById(invitationId, actor.organizationId);
    if (!invitation?.userId)
      throw new AppError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
    if (invitation.status === 'accepted') {
      throw new AppError('This invitation has already been accepted.', 409, 'INVITATION_USED');
    }
    return this.issueForUser(
      {
        userId: invitation.userId,
        email: invitation.email,
        firstName: invitation.firstName,
        lastName: invitation.lastName,
      },
      actor
    );
  }

  async revoke(invitationId: string, actor: InviteActor) {
    const invitation = await this.repo.findById(invitationId, actor.organizationId);
    if (!invitation) throw new AppError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
    const { count } = await this.repo.revoke(invitation.id, actor.userId);
    if (count === 0) {
      throw new AppError('Only pending invitations can be revoked.', 409, 'INVITATION_NOT_PENDING');
    }
    return { ok: true };
  }
}
