/**
 * AuthService — login, 2FA, session lifecycle, onboarding (invitation / optional
 * self-registration), email verification, password recovery and account security.
 *
 * Enumeration resistance: login failures share one message; forgot-password,
 * resend-verification and registration return the same response whether or not
 * the account exists. Status-specific errors (unverified, locked, disabled) are
 * only revealed after the password has been proven.
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { User } from '@prisma/client';
import { config } from '../../config/env';
import { AppError } from '../../middleware/error';
import { addQueueJob } from '../../infrastructure/queue';
import { logger } from '../../infrastructure/logger';
import type { TxClient } from '../../infrastructure/prisma';
import {
  AuditService,
  EncryptionService,
  MenuService,
  MfaService,
  OneTimeTokenService,
  PasswordService,
  PermissionService,
  RateLimitService,
  SessionService,
  TenantService,
  TokenService,
  type AuditAction,
  type Tenant,
} from '../../services/auth';
import { SecurityPolicyService, ipInRanges } from '../security-policy/security-policy.service';
import { UserRequestService } from '../user-requests/user-request.service';
import { recordStatusChange } from '../users/account-status';
import type { LoginPolicy } from '../security-policy/security-policy.dto';
import { AuthRepository } from './auth.repository';
import { INDIVIDUAL_PERMISSIONS, INDIVIDUAL_ROLE_NAME } from './individual-role';
import { ApprovalModeService } from '../approval-mode/approval-mode.service';
import type {
  AcceptInvitationDto,
  LoginDto,
  RegisterDto,
  SelfServiceRegistrationType,
} from './auth.dto';
import type {
  AuthenticatedActor,
  InvitationState,
  LoginResult,
  LoginSuccess,
  MfaChallenge,
  RequestMeta,
  TenantView,
} from './auth.types';

const GENERIC_LOGIN_ERROR = 'Invalid email or password.';
const RESEND_WINDOW_MS = 15 * 60 * 1000;
const MAX_EMAILS_PER_WINDOW = 3;
const MFA_ENROLLMENT_TTL_MS = 10 * 60 * 1000;

// Verifying against a real hash keeps the unknown-user path as slow as a wrong password.
let timingDummyHash: Promise<string> | undefined;
const dummyHash = (): Promise<string> =>
  (timingDummyHash ??= bcrypt.hash(crypto.randomBytes(16).toString('hex'), config.bcryptRounds));

const appLink = (path: string, token: string): string =>
  `${config.appUrl}${path}?token=${encodeURIComponent(token)}`;

const toTenantView = (tenant: Tenant): TenantView => ({
  id: tenant.id,
  name: tenant.name,
  clientCode: tenant.clientCode,
  logoUrl: tenant.logoUrl,
});

export class AuthService {
  constructor(private readonly repo = new AuthRepository()) {}

  // ===========================================================================
  // Public configuration
  // ===========================================================================

  getPublicConfig() {
    return {
      selfRegistrationEnabled: config.selfRegistrationEnabled,
      // Empty when registration is off, so the client never renders a chooser
      // for a flow it cannot complete.
      registrationTypes: config.selfRegistrationEnabled ? config.registrationTypes : [],
      requireEmailVerification: config.requireEmailVerification,
      supportEmail: config.supportEmail,
      passwordPolicy: {
        minLength: 12,
        maxLength: 128,
        requireUppercase: true,
        requireLowercase: true,
        requireDigit: true,
        requireSymbol: true,
      },
    };
  }

  async listTenants() {
    return TenantService.listActive();
  }

  /**
   * The registration picker's list. Separate from `listTenants` on purpose:
   * this one is only the organizations that opted in, so turning on
   * self-registration does not publish the customer list.
   */
  async listOrganizationsOpenToRegistration() {
    if (!config.selfRegistrationEnabled) return [];
    return TenantService.listOpenToRegistration();
  }

  /**
   * Whether an organization code is free. Only reachable while
   * CREATE_ORGANIZATION registration is on, and it answers about organizations
   * the registrant is about to create rather than about accounts, so it
   * discloses nothing a failed submit would not.
   */
  async checkOrganizationCode(code: string): Promise<{ code: string; available: boolean }> {
    const normalized = code.trim().toLowerCase();
    if (
      !config.selfRegistrationEnabled ||
      !config.registrationTypes.includes('CREATE_ORGANIZATION')
    ) {
      throw new AppError('Registration is not available.', 404, 'REGISTRATION_DISABLED');
    }
    const taken = await this.repo.organizationCodeTaken(normalized);
    return { code: normalized, available: !taken };
  }

  // ===========================================================================
  // Login
  // ===========================================================================

  async login(dto: LoginDto, meta: RequestMeta): Promise<LoginResult> {
    await RateLimitService.assertIpAllowed(meta.ipAddress);

    const tenant = await TenantService.findByClientCode(
      dto.clientCode ?? config.defaultOrganizationCode
    );
    const { login: loginPolicy } = await SecurityPolicyService.forOrganization(tenant?.id);
    await RateLimitService.assertAccountAllowed(dto.email, loginPolicy);

    const user = tenant ? await this.repo.findUserInTenant(dto.email, tenant.id) : null;

    const passwordless = !!user && config.devPasswordlessEmails.includes(user.email.toLowerCase());
    if (passwordless) logger.warn(`Dev passwordless login used for ${user.email}`);
    const passwordOk =
      passwordless ||
      (await PasswordService.verify(dto.password, user?.passwordHash ?? (await dummyHash())));

    if (!tenant || !user || !user.passwordHash || user.isDeleted || !passwordOk) {
      await this.recordLoginFailure(
        dto,
        meta,
        tenant?.id ?? null,
        user ? 'invalid_password' : 'unknown_user',
        loginPolicy
      );
      throw new AppError(GENERIC_LOGIN_ERROR, 401, 'INVALID_CREDENTIALS');
    }

    // Credentials are proven from here on, so status-specific errors leak nothing.
    this.assertAccountUsable(user);
    await this.assertIpAllowedByPolicy(loginPolicy, tenant.id, user.id, meta);
    // Accounts created before verification existed have no verification record;
    // they are grandfathered rather than locked out.
    if (
      config.requireEmailVerification &&
      !user.emailVerified &&
      (await this.repo.hasEmailVerificationRecord(user.id))
    ) {
      throw new AppError(
        'Please verify your email address before signing in.',
        403,
        'EMAIL_NOT_VERIFIED'
      );
    }

    if (user.mfaEnabled && config.enableTwoFactor) {
      return this.issueMfaChallenge(user, tenant, dto.rememberMe);
    }

    return this.completeLogin(user, tenant, dto.rememberMe, meta);
  }

  /**
   * INDIVIDUAL accounts join the default organization with the Individual role,
   * which carries only personal-workspace permissions.
   */
  private async joinDefaultOrganization(userId: string, tx: TxClient): Promise<string> {
    const org = await this.repo.organizationCodeTaken(config.defaultOrganizationCode, tx);
    if (!org) {
      throw new AppError(
        'Individual registration is not available right now.',
        503,
        'DEFAULT_ORGANIZATION_MISSING'
      );
    }
    await this.repo.updateUser(userId, { tenantId: org.id, role: INDIVIDUAL_ROLE_NAME }, tx);
    // Nobody reviews an individual's sheets, so submitting finalizes them.
    await this.repo.ensureMembership(userId, org.id, tx, 'member', 'NONE');
    await this.repo.assignOrganizationRole(
      {
        userId,
        organizationId: org.id,
        name: INDIVIDUAL_ROLE_NAME,
        permissionKeys: INDIVIDUAL_PERMISSIONS,
      },
      tx
    );
    return org.id;
  }

  async verifyMfa(mfaToken: string, code: string, meta: RequestMeta): Promise<LoginSuccess> {
    const challenge = await this.loadMfaChallenge(mfaToken);
    let ok: boolean;
    if (challenge.method === 'email_otp') {
      const expected = challenge.payload ? EncryptionService.decrypt(challenge.payload) : '';
      ok =
        expected.length === code.length &&
        crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code));
    } else {
      ok = await MfaService.verifyTotp(challenge.userId, code);
    }

    if (!ok) {
      await this.audit('login_failed', challenge.organizationId, challenge.userId, meta, 'warn', {
        reason: 'mfa_failed',
      });
      throw new AppError('The verification code is invalid or expired.', 401, 'MFA_INVALID_CODE');
    }
    return this.finishMfaChallenge(challenge, meta);
  }

  async verifyRecoveryCode(
    mfaToken: string,
    code: string,
    meta: RequestMeta
  ): Promise<LoginSuccess> {
    const challenge = await this.loadMfaChallenge(mfaToken);
    const remaining = await MfaService.consumeRecoveryCode(challenge.userId, code);
    if (remaining === null) {
      await this.audit('login_failed', challenge.organizationId, challenge.userId, meta, 'warn', {
        reason: 'recovery_code_failed',
      });
      throw new AppError(
        'The recovery code is invalid or has already been used.',
        401,
        'RECOVERY_CODE_INVALID'
      );
    }
    await this.audit(
      'mfa_recovery_used',
      challenge.organizationId,
      challenge.userId,
      meta,
      'warn',
      {
        remaining,
      }
    );
    const result = await this.finishMfaChallenge(challenge, meta);
    return { ...result, recoveryCodesRemaining: remaining };
  }

  async refresh(refreshToken: string) {
    const claims = TokenService.verifyRefresh(refreshToken);
    const session = await SessionService.findByRefreshTokenHash(
      TokenService.hashRefresh(refreshToken)
    );

    if (session.id !== claims.sid || new Date(session.expires_at) <= new Date()) {
      await SessionService.revoke(session.id);
      throw new AppError('Session expired. Please sign in again.', 401, 'REFRESH_TOKEN_REUSE');
    }

    const user = await this.repo.findUserById(session.user_id);
    if (!user || user.isDeleted) {
      await SessionService.revoke(session.id);
      throw new AppError('Session expired. Please sign in again.', 401, 'SESSION_REVOKED');
    }
    try {
      this.assertAccountUsable(user);
    } catch (e) {
      await SessionService.revoke(session.id);
      throw e;
    }

    // The session's organization is authoritative: it is the tenant the user
    // authenticated against. users.tenant_id may be stale for multi-tenant users.
    const role = await TenantService.assertMembership(user.id, session.organization_id);
    return TokenService.issue({
      userId: user.id,
      tenantId: session.organization_id,
      role,
      email: user.email,
      sessionId: session.id,
    });
  }

  async logout(actor: AuthenticatedActor): Promise<void> {
    await SessionService.revoke(actor.sessionId);
    await this.audit('logout', actor.tenantId, actor.userId, actor);
  }

  async logoutAll(actor: AuthenticatedActor, password: string): Promise<void> {
    await this.assertPassword(actor.userId, password);
    await TokenService.revokeAllForUser(actor.userId);
    await this.audit('all_sessions_revoked', actor.tenantId, actor.userId, actor, 'warn');
  }

  // ===========================================================================
  // Current user
  // ===========================================================================

  async me(actor: AuthenticatedActor) {
    const [user, tenant, permissions, approval] = await Promise.all([
      this.repo.findUserById(actor.userId),
      TenantService.getById(actor.tenantId),
      PermissionService.loadForUser(actor.userId, actor.tenantId),
      ApprovalModeService.view(actor.userId, actor.tenantId),
    ]);
    if (!user || user.isDeleted) throw new AppError('Session expired', 401, 'SESSION_REVOKED');
    if (!tenant) throw new AppError('Organization not found', 404, 'TENANT_NOT_FOUND');
    // A reviewer who finalizes their own sheets may still review a team's.
    const reviewQueue = approval.organizationMode !== 'NONE' || approval.effectiveMode !== 'NONE';
    const menu = await MenuService.loadForUserWithPerms(actor.userId, actor.tenantId, permissions, {
      reviewQueue,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        emailVerified: user.emailVerified,
        mfaEnabled: user.mfaEnabled,
        mfaEnrolledAt: user.mfaEnrolledAt,
        lastLoginAt: user.lastLoginDatetime,
        createdAt: user.createdAt,
      },
      tenant: { ...toTenantView(tenant), plan: tenant.plan, enforce2fa: tenant.enforce2fa },
      mfaSetupRequired: tenant.enforce2fa && !user.mfaEnabled,
      permissions: Array.from(permissions),
      approval: { ...approval, reviewQueue },
      menu,
    };
  }

  async listUserTenants(userId: string) {
    return TenantService.listForUser(userId);
  }

  async switchTenant(actor: AuthenticatedActor, organizationId: string) {
    const role = await TenantService.assertMembership(actor.userId, organizationId);
    const tenant = await TenantService.getById(organizationId);
    if (!tenant) throw new AppError('Organization not found', 404, 'TENANT_NOT_FOUND');
    const { login: loginPolicy } = await SecurityPolicyService.forOrganization(organizationId);
    await this.assertIpAllowedByPolicy(loginPolicy, organizationId, actor.userId, actor);

    const { sessionId } = await SessionService.create({
      userId: actor.userId,
      organizationId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      ...(await this.sessionCapsFor(organizationId)),
    });
    const tokens = await TokenService.issue({
      userId: actor.userId,
      tenantId: organizationId,
      role,
      email: actor.email,
      sessionId,
    });
    await this.audit('tenant_switched', organizationId, actor.userId, actor);
    return { tenant: toTenantView(tenant), ...tokens };
  }

  async updateAvatar(actor: AuthenticatedActor, avatar: string | null) {
    await this.repo.updateUser(actor.userId, { avatarUrl: avatar });
    await this.audit('user_updated', actor.tenantId, actor.userId, actor, 'info', {
      description: avatar ? 'Profile picture updated' : 'Profile picture removed',
    });
    return { avatarUrl: avatar };
  }

  // ===========================================================================
  // Self-registration (disabled unless ALLOW_SELF_REGISTRATION=true)
  // ===========================================================================

  /**
   * Public registration. Routes on registration type; each handler owns its own
   * account shape and approval path. Every branch returns the same shape of
   * response whether or not the target exists, so the endpoint stays
   * enumeration-resistant.
   */
  async register(dto: RegisterDto, meta: RequestMeta) {
    if (!config.selfRegistrationEnabled) {
      throw new AppError('Registration is not available.', 404, 'REGISTRATION_DISABLED');
    }
    if (!config.registrationTypes.includes(dto.registrationType)) {
      throw new AppError(
        'That kind of registration is not available.',
        404,
        'REGISTRATION_TYPE_DISABLED'
      );
    }

    switch (dto.registrationType) {
      case 'ORGANIZATION_MEMBER':
        return this.registerOrganizationMember(dto, meta);
      case 'INDIVIDUAL':
        return this.registerIndividual(dto, meta);
      case 'CREATE_ORGANIZATION':
        return this.registerOrganizationOwner(dto, meta);
    }
  }

  /**
   * Joins an existing organization. The account is PENDING until an
   * administrator approves the auto-raised User Request, which provisions
   * department, branch, role and groups.
   */
  private async registerOrganizationMember(
    dto: Extract<RegisterDto, { registrationType: 'ORGANIZATION_MEMBER' }>,
    meta: RequestMeta
  ) {
    const response = {
      ok: true,
      registrationType: 'ORGANIZATION_MEMBER' as const,
      outcome: 'PENDING_APPROVAL' as const,
      message:
        'Your registration has been submitted and is awaiting administrator approval. ' +
        'You will be notified once your account is approved.',
    };

    const target = await this.repo.findRegistrationTarget(dto.clientCode);
    // Both "no such organization" and "closed to registration" answer the same,
    // so a stranger cannot probe which tenants exist or which are open.
    if (!target) {
      logger.info('[auth] registration attempted for an unknown organization');
      return response;
    }
    if (!this.organizationAccepts(target, 'ORGANIZATION_MEMBER')) {
      logger.info(`[auth] organization ${target.id} is closed to member self-registration`);
      return response;
    }

    const existing = await this.repo.findUserByEmail(dto.email);
    if (existing) {
      logger.info('[auth] registration attempted for an existing account');
      return response;
    }

    await this.assertPasswordPolicy(target.id, dto.password, dto.email);
    const passwordHash = await PasswordService.hash(dto.password);
    const user = await this.repo.transaction(async (tx) => {
      const created = await this.repo.createUser(
        {
          ...this.registrantFields(dto, passwordHash),
          registrationType: 'ORGANIZATION_MEMBER',
          tenantId: target.id,
          // PENDING blocks sign-in (see assertAccountUsable) until an
          // administrator approves the account from User Requests. Approval
          // flips this to ACTIVE.
          status: 'PENDING',
        },
        tx
      );
      await this.repo.ensureMembership(created.id, target.id, tx);
      await this.repo.addPasswordHistory(created.id, passwordHash, tx);
      return created;
    });

    await this.audit('user_registered', target.id, user.id, meta);

    // Raise the approval request outside the account transaction: a failure
    // here must not roll back a user who has already been told they registered,
    // and the request can be reconciled from the PENDING account.
    await new UserRequestService()
      .onSelfRegistration({
        userId: user.id,
        organizationId: target.id,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        fullName: `${dto.firstName} ${dto.lastName}`,
      })
      .catch((e) =>
        logger.error(`[auth] self-registration request failed: ${(e as Error).message}`)
      );

    await this.sendVerificationEmail(user).catch((e) =>
      logger.error(`[auth] verification email failed: ${(e as Error).message}`)
    );
    return response;
  }

  /**
   * A personal account in the default organization with the Individual role, no approval.
   * Created ACTIVE — the email-verification gate in `login` is what withholds
   * access until the address is proven, so status stays a statement about the
   * account rather than a stand-in for verification.
   */
  private async registerIndividual(
    dto: Extract<RegisterDto, { registrationType: 'INDIVIDUAL' }>,
    meta: RequestMeta
  ) {
    const response = {
      ok: true,
      registrationType: 'INDIVIDUAL' as const,
      outcome: config.requireEmailVerification
        ? ('PENDING_EMAIL_VERIFICATION' as const)
        : ('ACTIVE' as const),
      message: config.requireEmailVerification
        ? 'Check your inbox — open the link we sent to activate your account.'
        : 'Your account is ready. You can sign in now.',
    };

    const existing = await this.repo.findUserByEmail(dto.email);
    if (existing) {
      logger.info('[auth] individual registration attempted for an existing account');
      return response;
    }

    // No tenant, so the global password policy applies.
    await this.assertPasswordPolicy(null, dto.password, dto.email);
    const passwordHash = await PasswordService.hash(dto.password);
    const user = await this.repo.transaction(async (tx) => {
      const created = await this.repo.createUser(
        {
          ...this.registrantFields(dto, passwordHash),
          registrationType: 'INDIVIDUAL',
          tenantId: null,
          status: 'ACTIVE',
        },
        tx
      );
      await this.repo.addPasswordHistory(created.id, passwordHash, tx);
      const organizationId = await this.joinDefaultOrganization(created.id, tx);
      return { ...created, tenantId: organizationId };
    });

    await this.audit('user_registered', user.tenantId, user.id, meta);
    await this.sendVerificationEmail(user).catch((e) =>
      logger.error(`[auth] verification email failed: ${(e as Error).message}`)
    );
    return response;
  }

  /**
   * Creates a new organization and its first administrator. The organization is
   * written immediately with status `pending_verification` so the membership and
   * the approval request have something real to point at, and is activated by
   * platform approval — `TenantService.listActive` already excludes it, so an
   * unapproved organization is not a sign-in target.
   */
  private async registerOrganizationOwner(
    dto: Extract<RegisterDto, { registrationType: 'CREATE_ORGANIZATION' }>,
    meta: RequestMeta
  ) {
    const response = {
      ok: true,
      registrationType: 'CREATE_ORGANIZATION' as const,
      outcome: 'PENDING_APPROVAL' as const,
      message:
        'Your organization has been submitted for review. Verify your email address ' +
        'in the meantime — we will be in touch once it is approved.',
    };

    const clientCode = dto.organization.code.toLowerCase();
    if (await this.repo.organizationCodeTaken(clientCode)) {
      // The code is shown to the user and must be unique, so unlike the email
      // this is a real field error rather than a generic response.
      throw new AppError('That organization code is already taken.', 409, 'ORG_CODE_TAKEN', {
        fields: { 'organization.code': 'That organization code is already taken.' },
      });
    }

    const existing = await this.repo.findUserByEmail(dto.email);
    if (existing) {
      logger.info('[auth] organization registration attempted for an existing account');
      return response;
    }

    await this.assertPasswordPolicy(null, dto.password, dto.email);
    const passwordHash = await PasswordService.hash(dto.password);

    const { user, organizationId } = await this.repo.transaction(async (tx) => {
      const org = await this.repo.createOrganization(
        {
          name: dto.organization.name,
          clientCode,
          email: dto.organization.businessEmail,
          country: dto.organization.country,
          status: 'pending_verification',
          isVerified: false,
          registrationSource: 'organic',
          // The owner registers through the public form, so the organization
          // starts closed to further self-registration; its admin opens it.
          allowSelfRegistration: false,
          termsAccepted: true,
          termsAcceptedAt: new Date(),
          privacyAccepted: true,
          privacyAcceptedAt: new Date(),
        },
        tx
      );
      const created = await this.repo.createUser(
        {
          ...this.registrantFields(dto, passwordHash),
          registrationType: 'CREATE_ORGANIZATION',
          tenantId: org.id,
          timezone: dto.organization.timezone,
          country: dto.organization.country,
          status: 'PENDING',
        },
        tx
      );
      await this.repo.ensureMembership(created.id, org.id, tx, 'owner');
      await this.repo.addPasswordHistory(created.id, passwordHash, tx);
      return { user: created, organizationId: org.id };
    });

    await this.audit('user_registered', organizationId, user.id, meta);

    await new UserRequestService()
      .onOrganizationRegistration({
        userId: user.id,
        organizationId,
        organizationName: dto.organization.name,
        clientCode,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        fullName: `${dto.firstName} ${dto.lastName}`,
      })
      .catch((e) =>
        logger.error(`[auth] organization registration request failed: ${(e as Error).message}`)
      );

    await this.sendVerificationEmail(user).catch((e) =>
      logger.error(`[auth] verification email failed: ${(e as Error).message}`)
    );
    return response;
  }

  /** Account fields every registration type writes identically. */
  private registrantFields(
    dto: Extract<
      RegisterDto,
      { registrationType: 'ORGANIZATION_MEMBER' | 'INDIVIDUAL' | 'CREATE_ORGANIZATION' }
    >,
    passwordHash: string
  ) {
    const now = new Date();
    return {
      email: dto.email,
      emailId: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      fullName: `${dto.firstName} ${dto.lastName}`,
      passwordHash,
      passwordChangedAt: now,
      emailVerified: false,
      termsAccepted: true,
      termsAcceptedAt: now,
      privacyAccepted: true,
      privacyAcceptedAt: now,
    };
  }

  /**
   * Per-organization gate on top of the global flag. A null
   * `allowedRegistrationTypes` means ORGANIZATION_MEMBER only, which is what
   * every organization accepted before types existed.
   */
  private organizationAccepts(
    target: { allowSelfRegistration: boolean; allowedRegistrationTypes: unknown; status: string },
    type: SelfServiceRegistrationType
  ): boolean {
    if (!target.allowSelfRegistration || target.status !== 'active') return false;
    const allowed = target.allowedRegistrationTypes;
    if (allowed === null || allowed === undefined) return type === 'ORGANIZATION_MEMBER';
    return Array.isArray(allowed) && allowed.includes(type);
  }

  // ===========================================================================
  // Invitations
  // ===========================================================================

  async previewInvitation(token: string) {
    const { state, invitation } = await this.resolveInvitation(token);
    if (state !== 'valid' || !invitation) return { state };
    return {
      state,
      email: invitation.email,
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      organizationName: invitation.organization?.name ?? null,
    };
  }

  async acceptInvitation(dto: AcceptInvitationDto, meta: RequestMeta) {
    const { state, invitation } = await this.resolveInvitation(dto.token);
    if (state !== 'valid' || !invitation || !invitation.organizationId) {
      throw this.invitationError(state);
    }
    const organizationId = invitation.organizationId;
    await this.assertPasswordPolicy(organizationId, dto.password, invitation.email);
    const passwordHash = await PasswordService.hash(dto.password);

    const userId = await this.repo.transaction(async (tx) => {
      if (!(await this.repo.claimInvitation(invitation.id, tx))) {
        throw this.invitationError('used');
      }
      const existing = invitation.userId
        ? await this.repo.findUserById(invitation.userId, tx)
        : await this.repo.findUserByEmail(invitation.email, tx);

      if (existing?.passwordHash && existing.status !== 'PENDING') {
        throw new AppError(
          'This account is already active. Sign in or reset your password.',
          409,
          'ACCOUNT_ALREADY_ACTIVE'
        );
      }

      const profile = {
        firstName: dto.firstName,
        lastName: dto.lastName,
        fullName: `${dto.firstName} ${dto.lastName}`,
        passwordHash,
        passwordChangedAt: new Date(),
        tenantId: organizationId,
        status: 'ACTIVE' as const,
        // The invitation link was delivered to this address, proving ownership.
        emailVerified: true,
        emailVerifiedAt: new Date(),
      };
      const user = existing
        ? await this.repo.updateUser(existing.id, profile, tx)
        : await this.repo.createUser(
            { email: invitation.email, emailId: invitation.email, ...profile },
            tx
          );

      await this.repo.ensureMembership(user.id, organizationId, tx);
      await this.repo.addPasswordHistory(user.id, passwordHash, tx);
      return user.id;
    });

    await this.audit('invitation_accepted', organizationId, userId, meta);
    await recordStatusChange({
      userId,
      organizationId,
      from: 'INVITED',
      to: 'ACTIVE',
      reason: 'Invitation accepted; email verified',
      actorId: userId,
    });
    await new UserRequestService().onInvitationAccepted(userId);
    return { ok: true, clientCode: invitation.organization?.clientCode ?? null };
  }

  // ===========================================================================
  // Email verification
  // ===========================================================================

  async verifyEmail(token: string, meta: RequestMeta) {
    const row = await this.repo.findEmailVerification(OneTimeTokenService.hash(token));
    if (!row?.userId) {
      throw new AppError(
        'This verification link is invalid or has expired.',
        400,
        'INVALID_VERIFICATION_TOKEN'
      );
    }
    const user = await this.repo.findUserById(row.userId);
    if (!user || user.isDeleted) {
      throw new AppError(
        'This verification link is invalid or has expired.',
        400,
        'INVALID_VERIFICATION_TOKEN'
      );
    }
    if (user.emailVerified) return { ok: true, alreadyVerified: true };
    if (row.verified || row.expiresAt <= new Date()) {
      throw new AppError(
        'This verification link is invalid or has expired.',
        400,
        'VERIFICATION_TOKEN_EXPIRED'
      );
    }

    await this.repo.transaction(async (tx) => {
      await this.repo.updateUser(user.id, { emailVerified: true, emailVerifiedAt: new Date() }, tx);
      await this.repo.invalidateEmailVerifications(user.id, tx);
    });
    if (user.tenantId) await this.audit('email_verified', user.tenantId, user.id, meta);
    return { ok: true, alreadyVerified: false };
  }

  async resendVerification(email: string) {
    const user = await this.repo.findUserByEmail(email);
    if (user && !user.isDeleted && !user.emailVerified) {
      const recent = await this.repo.countRecentEmailVerifications(
        user.id,
        new Date(Date.now() - RESEND_WINDOW_MS)
      );
      if (recent < MAX_EMAILS_PER_WINDOW) await this.sendVerificationEmail(user);
    }
    return { ok: true, message: 'If verification is required, instructions will be sent.' };
  }

  // ===========================================================================
  // Password recovery
  // ===========================================================================

  async forgotPassword(email: string, meta: RequestMeta) {
    const user = await this.repo.findUserByEmail(email);
    if (user && this.isEligibleForReset(user)) {
      const recent = await this.repo.countRecentPasswordResets(
        user.id,
        new Date(Date.now() - RESEND_WINDOW_MS)
      );
      if (recent < MAX_EMAILS_PER_WINDOW) {
        const { token, hash } = OneTimeTokenService.generate();
        await this.repo.createPasswordReset({
          userId: user.id,
          email: user.email,
          tokenHash: hash,
          expiresAt: new Date(Date.now() + config.passwordResetTokenExpiryMinutes * 60 * 1000),
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        });
        await addQueueJob('send-password-reset', {
          email: user.email,
          resetLink: appLink('/auth/reset-password', token),
          expiryMinutes: config.passwordResetTokenExpiryMinutes,
        });
        if (user.tenantId)
          await this.audit('password_reset_requested', user.tenantId, user.id, meta);
      }
    }
    return { ok: true, message: 'If an account is eligible, reset instructions will be sent.' };
  }

  async validateResetToken(token: string) {
    const row = await this.repo.findLivePasswordReset(OneTimeTokenService.hash(token));
    return { valid: !!row?.userId };
  }

  async resetPassword(token: string, newPassword: string, meta: RequestMeta) {
    const invalid = () =>
      new AppError(
        'This reset link is invalid or has expired. Request a new one.',
        400,
        'INVALID_RESET_TOKEN'
      );

    const row = await this.repo.findLivePasswordReset(OneTimeTokenService.hash(token));
    if (!row?.userId) throw invalid();
    const user = await this.repo.findUserById(row.userId);
    if (!user || !this.isEligibleForReset(user)) throw invalid();

    const passwordHash = await this.hashNewPassword(user.id, newPassword);
    await this.repo.transaction(async (tx) => {
      await this.repo.updateUser(
        user.id,
        {
          passwordHash,
          passwordChangedAt: new Date(),
          passwordResetFlag: false,
          // Completing a reset proves control of the mailbox.
          emailVerified: true,
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        },
        tx
      );
      await this.repo.addPasswordHistory(user.id, passwordHash, tx);
      await this.repo.invalidatePasswordResets(user.id, tx);
    });

    await RateLimitService.clearForEmail(user.email);
    if (config.revokeSessionsOnPasswordChange) await TokenService.revokeAllForUser(user.id);
    if (user.tenantId)
      await this.audit('password_reset_completed', user.tenantId, user.id, meta, 'warn');
    await this.sendSecurityAlert(user.email, 'Password reset');
    return { ok: true };
  }

  async changePassword(actor: AuthenticatedActor, currentPassword: string, newPassword: string) {
    const user = await this.repo.findUserById(actor.userId);
    if (!user || !(await PasswordService.verify(currentPassword, user.passwordHash ?? ''))) {
      throw new AppError('Current password is incorrect.', 400, 'INVALID_CURRENT_PASSWORD', {
        field: 'currentPassword',
      });
    }

    const passwordHash = await this.hashNewPassword(user.id, newPassword);
    await this.repo.transaction(async (tx) => {
      await this.repo.updateUser(
        user.id,
        { passwordHash, passwordChangedAt: new Date(), passwordResetFlag: false },
        tx
      );
      await this.repo.addPasswordHistory(user.id, passwordHash, tx);
      await this.repo.invalidatePasswordResets(user.id, tx);
    });

    const revokedSessions = config.revokeSessionsOnPasswordChange
      ? await SessionService.revokeAllExcept(user.id, actor.sessionId)
      : 0;
    await this.audit('password_change', actor.tenantId, actor.userId, actor, 'warn', {
      revokedSessions,
    });
    await this.sendSecurityAlert(user.email, 'Password changed');
    return { ok: true, revokedSessions };
  }

  // ===========================================================================
  // Security area: 2FA, recovery codes, sessions
  // ===========================================================================

  async securityOverview(actor: AuthenticatedActor) {
    const user = await this.repo.findUserById(actor.userId);
    if (!user) throw new AppError('Session expired', 401, 'SESSION_REVOKED');
    const tenant = await TenantService.getById(actor.tenantId);
    const [recoveryCodesRemaining, events] = await Promise.all([
      user.mfaEnabled ? MfaService.remainingRecoveryCodes(user.id) : Promise.resolve(0),
      this.repo.recentSecurityEvents(user.id, 10),
    ]);
    return {
      emailVerified: user.emailVerified,
      passwordChangedAt: user.passwordChangedAt,
      mfaEnabled: user.mfaEnabled,
      mfaEnrolledAt: user.mfaEnrolledAt,
      mfaRequiredByOrganization: tenant?.enforce2fa ?? false,
      recoveryCodesRemaining,
      recentEvents: events.map((e) => ({
        id: e.id,
        action: e.action,
        ipAddress: e.ipAddress,
        userAgent: e.userAgent,
        createdAt: e.createdAt,
      })),
    };
  }

  async startMfaEnrollment(actor: AuthenticatedActor, password: string) {
    const user = await this.assertPassword(actor.userId, password);
    if (user.mfaEnabled) {
      throw new AppError(
        'Two-factor authentication is already enabled.',
        409,
        'MFA_ALREADY_ENABLED'
      );
    }
    const tenant = await TenantService.getById(actor.tenantId);
    const enrollment = await MfaService.startEnrollment(user.email, tenant?.name ?? 'ZCC');

    const { token, hash } = OneTimeTokenService.generate();
    await this.repo.discardChallenges(user.id, 'mfa_enrollment');
    await this.repo.createChallenge({
      tokenHash: hash,
      purpose: 'mfa_enrollment',
      userId: user.id,
      organizationId: actor.tenantId,
      payload: EncryptionService.encrypt(enrollment.secret),
      expiresAt: new Date(Date.now() + MFA_ENROLLMENT_TTL_MS),
    });
    return {
      enrollmentToken: token,
      otpauth: enrollment.otpauth,
      qrCodeDataUrl: enrollment.qrCodeDataUrl,
      secret: enrollment.secret,
    };
  }

  async confirmMfaEnrollment(actor: AuthenticatedActor, enrollmentToken: string, code: string) {
    const challenge = await this.repo.findLiveChallenge(
      OneTimeTokenService.hash(enrollmentToken),
      'mfa_enrollment'
    );
    if (!challenge || challenge.userId !== actor.userId || !challenge.payload) {
      throw new AppError(
        'Setup session expired. Please start again.',
        400,
        'MFA_ENROLLMENT_EXPIRED'
      );
    }
    if (!(await this.repo.recordChallengeAttempt(challenge.id, config.mfaMaxAttempts))) {
      await this.repo.consumeChallenge(challenge.id);
      throw new AppError('Too many attempts. Please start again.', 429, 'MFA_TOO_MANY_ATTEMPTS');
    }

    const recoveryCodes = await MfaService.confirmEnrollment(
      actor.userId,
      EncryptionService.decrypt(challenge.payload),
      code
    );
    await this.repo.consumeChallenge(challenge.id);
    await this.audit('mfa_enrolled', actor.tenantId, actor.userId, actor, 'warn');
    await this.sendSecurityAlert(actor.email, 'Two-factor authentication enabled');
    return { ok: true, recoveryCodes };
  }

  async disableMfa(actor: AuthenticatedActor, password: string, code: string) {
    const user = await this.assertPassword(actor.userId, password);
    if (!user.mfaEnabled) return { ok: true };

    const tenant = await TenantService.getById(actor.tenantId);
    if (tenant?.enforce2fa) {
      throw new AppError(
        'Your organization requires two-factor authentication.',
        403,
        'MFA_REQUIRED_BY_ORG'
      );
    }
    const secondFactorOk = /^\d{6}$/.test(code)
      ? await MfaService.verifyTotp(user.id, code)
      : (await MfaService.consumeRecoveryCode(user.id, code)) !== null;
    if (!secondFactorOk) {
      throw new AppError('The verification code is invalid or expired.', 400, 'MFA_INVALID_CODE', {
        field: 'code',
      });
    }

    await MfaService.disable(user.id);
    await this.audit('mfa_disabled', actor.tenantId, actor.userId, actor, 'critical');
    await this.sendSecurityAlert(user.email, 'Two-factor authentication disabled');
    return { ok: true };
  }

  async regenerateRecoveryCodes(actor: AuthenticatedActor, password: string) {
    const user = await this.assertPassword(actor.userId, password);
    if (!user.mfaEnabled) {
      throw new AppError('Enable two-factor authentication first.', 409, 'MFA_NOT_ENABLED');
    }
    const recoveryCodes = await MfaService.regenerateRecoveryCodes(user.id);
    await this.audit('mfa_recovery_codes_regenerated', actor.tenantId, actor.userId, actor, 'warn');
    return { recoveryCodes };
  }

  async listSessions(actor: AuthenticatedActor) {
    const rows = await SessionService.listForUser(actor.userId);
    return {
      sessions: rows.map((s) => ({
        id: s.id,
        browser: parseBrowser(s.user_agent),
        os: parseOs(s.user_agent),
        ipAddress: s.ip_address || null,
        createdAt: s.created_at,
        lastActivityAt: s.last_activity_at,
        expiresAt: s.expires_at,
        isCurrent: s.id === actor.sessionId,
      })),
    };
  }

  async revokeSession(actor: AuthenticatedActor, sessionId: string) {
    if (!(await SessionService.revokeOwned(sessionId, actor.userId))) {
      throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
    }
    await this.audit('session_revoked', actor.tenantId, actor.userId, actor, 'info', { sessionId });
    return { ok: true, current: sessionId === actor.sessionId };
  }

  async revokeOtherSessions(actor: AuthenticatedActor) {
    const revoked = await SessionService.revokeAllExcept(actor.userId, actor.sessionId);
    await this.audit('all_sessions_revoked', actor.tenantId, actor.userId, actor, 'warn', {
      revoked,
      keptCurrent: true,
    });
    return { ok: true, revoked };
  }

  // ===========================================================================
  // Internals
  // ===========================================================================

  /** Admin locks and account status. Temporary lockout is enforced by RateLimitService. */
  private assertAccountUsable(user: User): void {
    if (user.status === 'SUSPENDED' || user.status === 'INACTIVE' || user.status === 'DISABLED') {
      throw new AppError(
        'This account is disabled. Contact your administrator.',
        403,
        'ACCOUNT_DISABLED'
      );
    }
    if (user.status === 'PENDING') {
      throw new AppError(GENERIC_LOGIN_ERROR, 401, 'INVALID_CREDENTIALS');
    }
    if (user.status === 'LOCKED' || user.isAccountLocked) {
      throw new AppError('This account is locked.', 423, 'ACCOUNT_LOCKED');
    }
    if (user.passwordResetFlag) {
      throw new AppError(
        'Your administrator requires a password change. Use the reset link sent to your email, or choose "Forgot password".',
        403,
        'PASSWORD_CHANGE_REQUIRED'
      );
    }
  }

  private isEligibleForReset(user: User): boolean {
    return (
      !user.isDeleted &&
      !!user.passwordHash &&
      user.status !== 'SUSPENDED' &&
      user.status !== 'INACTIVE' &&
      user.status !== 'DISABLED' &&
      user.status !== 'PENDING'
    );
  }

  private async recordLoginFailure(
    dto: LoginDto,
    meta: RequestMeta,
    organizationId: string | null,
    reason: string,
    loginPolicy: LoginPolicy
  ): Promise<void> {
    await RateLimitService.record({
      email: dto.email,
      clientCode: dto.clientCode,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      success: false,
      failureReason: reason,
    });
    await AuditService.logLoginFailure({
      organizationId,
      email: dto.email,
      reason,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    try {
      await RateLimitService.assertAccountAllowed(dto.email, loginPolicy);
    } catch (e) {
      // This failure tipped the account into lockout.
      if (organizationId) {
        await AuditService.log({
          organizationId,
          actorId: null,
          action: 'lockout',
          severity: 'warn',
          description: `Temporary lockout after repeated failures for ${dto.email}`,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        });
      }
      throw e;
    }
  }

  private async assertIpAllowedByPolicy(
    loginPolicy: LoginPolicy,
    organizationId: string,
    userId: string,
    meta: RequestMeta
  ): Promise<void> {
    if (!loginPolicy.allowedIpRanges.length) return;
    if (ipInRanges(meta.ipAddress, loginPolicy.allowedIpRanges)) return;
    await this.audit('login_blocked_ip', organizationId, userId, meta, 'warn', {
      ipAddress: meta.ipAddress,
    });
    throw new AppError(
      'Sign-in is not allowed from this network. Contact your administrator.',
      403,
      'IP_NOT_ALLOWED'
    );
  }

  /** Applies the org password policy on top of the global DTO rules. */
  private async assertPasswordPolicy(
    organizationId: string | null | undefined,
    password: string,
    email: string | null | undefined
  ): Promise<void> {
    const { password: policy } = await SecurityPolicyService.forOrganization(organizationId);
    SecurityPolicyService.assertPasswordAllowed(policy, password, email);
  }

  private async sessionCapsFor(organizationId: string) {
    const { login } = await SecurityPolicyService.forOrganization(organizationId);
    return {
      maxLifetimeDays: login.sessionLifetimeDays,
      maxConcurrentSessions: login.maxConcurrentSessions,
    };
  }

  private async issueMfaChallenge(
    user: User,
    tenant: Tenant,
    rememberMe: boolean
  ): Promise<MfaChallenge> {
    const method: MfaChallenge['mfaMethod'] = user.mfaMethod === 'email_otp' ? 'email_otp' : 'totp';
    const { token, hash } = OneTimeTokenService.generate();
    const expiresAt = new Date(Date.now() + config.mfaChallengeTtlMinutes * 60 * 1000);

    let payload: string | undefined;
    if (method === 'email_otp') {
      const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
      payload = EncryptionService.encrypt(code);
      await addQueueJob('send-2fa-code', {
        email: user.email,
        code,
        expiryMinutes: config.mfaChallengeTtlMinutes,
      });
    }

    await this.repo.discardChallenges(user.id, 'mfa_login');
    await this.repo.createChallenge({
      tokenHash: hash,
      purpose: 'mfa_login',
      userId: user.id,
      organizationId: tenant.id,
      method,
      payload,
      rememberMe,
      expiresAt,
    });
    return { mfaRequired: true, mfaToken: token, mfaMethod: method, expiresAt };
  }

  private async loadMfaChallenge(mfaToken: string) {
    const challenge = await this.repo.findLiveChallenge(
      OneTimeTokenService.hash(mfaToken),
      'mfa_login'
    );
    if (!challenge?.organizationId) {
      throw new AppError(
        'Your sign-in attempt has expired. Please sign in again.',
        401,
        'MFA_CHALLENGE_EXPIRED'
      );
    }
    if (!(await this.repo.recordChallengeAttempt(challenge.id, config.mfaMaxAttempts))) {
      await this.repo.consumeChallenge(challenge.id);
      throw new AppError('Too many attempts. Please sign in again.', 429, 'MFA_TOO_MANY_ATTEMPTS');
    }
    return { ...challenge, organizationId: challenge.organizationId };
  }

  private async finishMfaChallenge(
    challenge: { id: string; userId: string; organizationId: string; rememberMe: boolean },
    meta: RequestMeta
  ): Promise<LoginSuccess> {
    if (!(await this.repo.consumeChallenge(challenge.id))) {
      throw new AppError(
        'Your sign-in attempt has expired. Please sign in again.',
        401,
        'MFA_CHALLENGE_EXPIRED'
      );
    }
    const [user, tenant] = await Promise.all([
      this.repo.findUserById(challenge.userId),
      TenantService.getById(challenge.organizationId),
    ]);
    if (!user || user.isDeleted || !tenant) {
      throw new AppError(GENERIC_LOGIN_ERROR, 401, 'INVALID_CREDENTIALS');
    }
    this.assertAccountUsable(user);
    return this.completeLogin(user, tenant, challenge.rememberMe, meta);
  }

  private async completeLogin(
    user: User,
    tenant: Tenant,
    rememberMe: boolean,
    meta: RequestMeta
  ): Promise<LoginSuccess> {
    await TenantService.assertMembership(user.id, tenant.id);
    const role = user.role;
    // A brand-new session id on every login rotates the session identifier.
    const { sessionId } = await SessionService.create({
      userId: user.id,
      organizationId: tenant.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      rememberMe,
      ...(await this.sessionCapsFor(tenant.id)),
    });
    const tokens = await TokenService.issue({
      userId: user.id,
      tenantId: tenant.id,
      role,
      email: user.email,
      sessionId,
      rememberMe,
    });

    await RateLimitService.clearForEmail(user.email);
    await this.repo.updateUser(user.id, {
      lastLoginDatetime: user.currentLoginDatetime,
      currentLoginDatetime: new Date(),
      successfulLoginAttempts: { increment: 1 },
      failedLoginAttempts: 0,
    });
    await this.audit('login', tenant.id, user.id, meta);

    return {
      mfaRequired: false,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role,
        mfaEnabled: user.mfaEnabled,
        avatarUrl: user.avatarUrl,
      },
      tenant: toTenantView(tenant),
      defaultLandingPage: user.defaultLandingPage ?? '/dashboard',
      mfaSetupRequired: tenant.enforce2fa && !user.mfaEnabled,
      ...tokens,
    };
  }

  private async resolveInvitation(token: string) {
    const invitation = await this.repo.findInvitationByTokenHash(OneTimeTokenService.hash(token));
    let state: InvitationState = 'valid';
    if (!invitation || invitation.isDeleted) state = 'invalid';
    else if (invitation.status === 'revoked') state = 'revoked';
    else if (invitation.used || invitation.status === 'accepted') state = 'used';
    else if (invitation.status === 'expired' || invitation.expiresAt <= new Date())
      state = 'expired';
    return { state, invitation: state === 'valid' ? invitation : null };
  }

  private invitationError(state: InvitationState): AppError {
    const map: Record<InvitationState, [string, string]> = {
      valid: ['This invitation cannot be used.', 'INVITATION_INVALID'],
      invalid: ['This invitation link is invalid.', 'INVITATION_INVALID'],
      expired: [
        'This invitation has expired. Ask your administrator for a new one.',
        'INVITATION_EXPIRED',
      ],
      used: ['This invitation has already been used. Sign in instead.', 'INVITATION_USED'],
      revoked: ['This invitation has been revoked.', 'INVITATION_REVOKED'],
    };
    const [message, code] = map[state];
    return new AppError(message, 400, code);
  }

  private async sendVerificationEmail(user: User): Promise<void> {
    const { token, hash } = OneTimeTokenService.generate();
    await this.repo.createEmailVerification({
      userId: user.id,
      email: user.email,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + config.emailVerificationTokenExpiryHours * 60 * 60 * 1000),
    });
    await addQueueJob('send-email-verification', {
      email: user.email,
      verificationLink: appLink('/auth/verify-email', token),
    });
  }

  private async sendSecurityAlert(email: string, alertType: string): Promise<void> {
    await addQueueJob('send-security-alert', {
      email,
      alertType,
      timestamp: new Date().toISOString(),
    }).catch((e) => logger.error(`[auth] security alert failed: ${(e as Error).message}`));
  }

  /** Re-authentication gate for sensitive account changes. */
  private async assertPassword(userId: string, password: string): Promise<User> {
    const user = await this.repo.findUserById(userId);
    if (!user || !(await PasswordService.verify(password, user.passwordHash ?? ''))) {
      throw new AppError('Password is incorrect.', 400, 'INVALID_PASSWORD', { field: 'password' });
    }
    return user;
  }

  private async hashNewPassword(userId: string, newPassword: string): Promise<string> {
    const user = await this.repo.findUserById(userId);
    const { password: policy } = await SecurityPolicyService.forOrganization(user?.tenantId);
    SecurityPolicyService.assertPasswordAllowed(policy, newPassword, user?.email);

    const history = policy.historyDepth
      ? await this.repo.recentPasswordHashes(userId, policy.historyDepth)
      : [];
    for (const entry of history) {
      if (await PasswordService.verify(newPassword, entry.passwordHash)) {
        throw new AppError(
          `Choose a password you haven't used for your last ${policy.historyDepth} changes.`,
          400,
          'PASSWORD_REUSE',
          { field: 'newPassword' }
        );
      }
    }
    return PasswordService.hash(newPassword);
  }

  private audit(
    action: AuditAction,
    organizationId: string | null,
    actorId: string | null,
    meta: RequestMeta,
    severity: 'info' | 'warn' | 'critical' = 'info',
    metadata?: Record<string, unknown>
  ): Promise<void> {
    return AuditService.log({
      organizationId,
      actorId,
      action,
      severity,
      metadata,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });
  }
}

function parseBrowser(userAgent: string): string {
  const u = userAgent.toLowerCase();
  if (u.includes('edg/')) return 'Edge';
  if (u.includes('opr/') || u.includes('opera')) return 'Opera';
  if (u.includes('firefox/')) return 'Firefox';
  if (u.includes('chrome/') || u.includes('crios/')) return 'Chrome';
  if (u.includes('safari/')) return 'Safari';
  return 'Unknown browser';
}

function parseOs(userAgent: string): string {
  const u = userAgent.toLowerCase();
  if (u.includes('windows')) return 'Windows';
  if (u.includes('mac os') || u.includes('macintosh')) return 'macOS';
  if (u.includes('android')) return 'Android';
  if (u.includes('iphone') || u.includes('ipad')) return 'iOS';
  if (u.includes('linux')) return 'Linux';
  return 'Unknown OS';
}
