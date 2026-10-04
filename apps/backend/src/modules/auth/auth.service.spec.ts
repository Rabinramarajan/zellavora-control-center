import { AuthService } from './auth.service';
import type { AuthRepository } from './auth.repository';
import type { RegisterDto } from './auth.dto';
import {
  MfaService,
  PasswordService,
  RateLimitService,
  SessionService,
  TenantService,
  TokenService,
} from '../../services/auth';
import { addQueueJob } from '../../infrastructure/queue';
import {
  DEFAULT_LOGIN_POLICY,
  DEFAULT_PASSWORD_POLICY,
  SecurityPolicyService,
} from '../security-policy/security-policy.service';

jest.mock('../../services/auth', () => ({
  AuditService: { log: jest.fn(), logLoginFailure: jest.fn() },
  EncryptionService: {
    encrypt: jest.fn((v: string) => `enc:${v}`),
    decrypt: jest.fn((v: string) => v.slice(4)),
  },
  MenuService: { loadForUserWithPerms: jest.fn() },
  MfaService: {
    verifyTotp: jest.fn(),
    consumeRecoveryCode: jest.fn(),
    remainingRecoveryCodes: jest.fn(),
  },
  OneTimeTokenService: {
    generate: jest.fn(() => ({ token: 'raw-token', hash: 'hashed-token' })),
    hash: jest.fn((t: string) => `h(${t})`),
  },
  PasswordService: { verify: jest.fn(), hash: jest.fn(async () => 'new-hash') },
  PermissionService: { loadForUser: jest.fn() },
  RateLimitService: {
    assertIpAllowed: jest.fn(),
    assertAccountAllowed: jest.fn(),
    record: jest.fn(),
    clearForEmail: jest.fn(),
  },
  SessionService: {
    create: jest.fn(async () => ({ sessionId: 'session-1' })),
    revokeOwned: jest.fn(),
    revokeAllExcept: jest.fn(async () => 2),
  },
  TenantService: {
    findByClientCode: jest.fn(),
    getById: jest.fn(),
    assertMembership: jest.fn(async () => 'member'),
    listOpenToRegistration: jest.fn(async () => []),
    listActive: jest.fn(async () => []),
  },
  TokenService: {
    issue: jest.fn(async () => ({
      accessToken: 'access',
      refreshToken: 'refresh',
      accessTokenExpiresAt: new Date(),
      refreshTokenExpiresAt: new Date(),
      sessionId: 'session-1',
      family: 'f',
    })),
    revokeAllForUser: jest.fn(),
  },
}));
jest.mock('../security-policy/security-policy.service', () => {
  const actual = jest.requireActual('../security-policy/security-policy.service');
  return {
    ...actual,
    SecurityPolicyService: Object.assign(Object.create(actual.SecurityPolicyService), {
      assertPasswordAllowed: actual.SecurityPolicyService.assertPasswordAllowed,
      forOrganization: jest.fn(async () => ({
        password: actual.DEFAULT_PASSWORD_POLICY,
        login: actual.DEFAULT_LOGIN_POLICY,
      })),
    }),
  };
});
jest.mock('../../infrastructure/queue', () => ({ addQueueJob: jest.fn(async () => undefined) }));
// Pinned so these tests do not depend on whatever ALLOW_SELF_REGISTRATION
// happens to be in the developer's .env.local.
jest.mock('../../config/env', () => {
  const actual = jest.requireActual('../../config/env');
  return { ...actual, config: { ...actual.config, selfRegistrationEnabled: true } };
});
const onSelfRegistration = jest.fn(async () => ({ id: 'req-1', refNo: 'UR-2026-000001' }));
const onOrganizationRegistration = jest.fn(async () => ({ id: 'req-2', refNo: 'UR-2026-000002' }));
jest.mock('../user-requests/user-request.service', () => ({
  UserRequestService: jest
    .fn()
    .mockImplementation(() => ({ onSelfRegistration, onOrganizationRegistration })),
}));
jest.mock('../../infrastructure/logger', () => ({ logger: { info: jest.fn(), error: jest.fn() } }));

const meta = { ipAddress: '203.0.113.7', userAgent: 'jest' };
const tenant = {
  id: 'org-1',
  name: 'Acme',
  clientCode: 'ACME',
  logoUrl: null,
  plan: 'pro',
  enforce2fa: false,
};
const baseUser = {
  id: 'user-1',
  email: 'ada@acme.test',
  fullName: 'Ada Lovelace',
  role: 'admin',
  passwordHash: 'stored-hash',
  isDeleted: false,
  status: 'ACTIVE',
  isAccountLocked: false,
  emailVerified: true,
  mfaEnabled: false,
  mfaMethod: null,
  avatarUrl: null,
  tenantId: 'org-1',
  currentLoginDatetime: null,
  defaultLandingPage: null,
};
const loginDto = { clientCode: 'acme', email: 'ada@acme.test', password: 'pw', rememberMe: false };

function makeRepo(overrides: Partial<Record<keyof AuthRepository, jest.Mock>> = {}) {
  return {
    findUserInTenant: jest.fn(async () => baseUser),
    findUserByEmail: jest.fn(async () => baseUser),
    findUserById: jest.fn(async () => baseUser),
    updateUser: jest.fn(),
    hasEmailVerificationRecord: jest.fn(async () => true),
    discardChallenges: jest.fn(),
    createChallenge: jest.fn(),
    findLiveChallenge: jest.fn(),
    recordChallengeAttempt: jest.fn(async () => true),
    consumeChallenge: jest.fn(async () => true),
    countRecentPasswordResets: jest.fn(async () => 0),
    createPasswordReset: jest.fn(),
    findLivePasswordReset: jest.fn(),
    recentPasswordHashes: jest.fn(async () => []),
    transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
    createUser: jest.fn(async (data: Record<string, unknown>) => ({ id: 'new-user-1', ...data })),
    findRegistrationTarget: jest.fn(async () => ({
      id: tenant.id,
      name: 'Acme',
      status: 'active',
      allowSelfRegistration: true,
      allowedRegistrationTypes: null,
      requireAdminApproval: true,
    })),
    organizationCodeTaken: jest.fn(async () => null),
    createOrganization: jest.fn(async (data: Record<string, unknown>) => ({
      id: 'new-org-1',
      ...data,
    })),
    ensureMembership: jest.fn(),
    addPasswordHistory: jest.fn(),
    createEmailVerification: jest.fn(),
    invalidateEmailVerifications: jest.fn(),
    ...overrides,
  } as unknown as AuthRepository;
}

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (TenantService.findByClientCode as jest.Mock).mockResolvedValue(tenant);
    (TenantService.getById as jest.Mock).mockResolvedValue(tenant);
    (PasswordService.verify as jest.Mock).mockResolvedValue(true);
    (SecurityPolicyService.forOrganization as jest.Mock).mockResolvedValue({
      password: DEFAULT_PASSWORD_POLICY,
      login: DEFAULT_LOGIN_POLICY,
    });
  });

  describe('registration organization list', () => {
    it('asks only for organizations that opted in, not the full tenant list', async () => {
      // The registration picker is public, so it must not double as a
      // directory of every customer (listActive does list them all).
      await new AuthService(makeRepo()).listOrganizationsOpenToRegistration();

      expect(TenantService.listOpenToRegistration).toHaveBeenCalled();
      expect(TenantService.listActive).not.toHaveBeenCalled();
    });
  });

  describe('organization code availability', () => {
    it('reports a free code as available', async () => {
      const repo = makeRepo({ organizationCodeTaken: jest.fn(async () => null) });

      await expect(new AuthService(repo).checkOrganizationCode('Acme-Robotics')).resolves.toEqual({
        code: 'acme-robotics',
        available: true,
      });
    });

    it('reports a taken code as unavailable', async () => {
      const repo = makeRepo({ organizationCodeTaken: jest.fn(async () => ({ id: 'org-9' })) });

      await expect(new AuthService(repo).checkOrganizationCode('acme')).resolves.toMatchObject({
        available: false,
      });
    });
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      registrationType: 'ORGANIZATION_MEMBER',
      clientCode: 'acme',
      email: 'grace@acme.test',
      password: 'Str0ng-Passw0rd!',
      firstName: 'Grace',
      lastName: 'Hopper',
      acceptTerms: true,
    };

    const registerRepo = (): AuthRepository =>
      makeRepo({ findUserByEmail: jest.fn(async () => null) });

    it('creates the account as PENDING so sign-in is blocked until approval', async () => {
      const repo = registerRepo();
      await new AuthService(repo).register(registerDto, meta);

      expect(repo.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'PENDING', email: registerDto.email }),
        expect.anything()
      );
      // The old behaviour — immediately usable accounts — must not come back.
      expect(repo.createUser).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ACTIVE' }),
        expect.anything()
      );
    });

    it('raises a NEW_USER approval request for the new account', async () => {
      await new AuthService(registerRepo()).register(registerDto, meta);

      expect(onSelfRegistration).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'new-user-1',
          organizationId: tenant.id,
          email: registerDto.email,
          fullName: 'Grace Hopper',
        })
      );
    });

    it('tells the person the account is awaiting approval', async () => {
      const result = await new AuthService(registerRepo()).register(registerDto, meta);

      expect(result.message).toMatch(/awaiting administrator approval/i);
    });

    it('still succeeds when raising the approval request fails', async () => {
      onSelfRegistration.mockRejectedValueOnce(new Error('request service down'));

      // The account exists and the person was told they registered; a failed
      // request must not surface as a registration error.
      await expect(
        new AuthService(registerRepo()).register(registerDto, meta)
      ).resolves.toMatchObject({ ok: true });
    });

    it('does not create an account for an email that already exists', async () => {
      const repo = makeRepo();
      await new AuthService(repo).register(registerDto, meta);

      expect(repo.createUser).not.toHaveBeenCalled();
      expect(onSelfRegistration).not.toHaveBeenCalled();
    });

    it('records the registration type on the account', async () => {
      const repo = registerRepo();
      await new AuthService(repo).register(registerDto, meta);

      expect(repo.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ registrationType: 'ORGANIZATION_MEMBER' }),
        expect.anything()
      );
    });

    it('refuses an organization that has not opened itself to self-registration', async () => {
      const repo = makeRepo({
        findUserByEmail: jest.fn(async () => null),
        findRegistrationTarget: jest.fn(async () => ({
          id: tenant.id,
          name: 'Acme',
          status: 'active',
          allowSelfRegistration: false,
          allowedRegistrationTypes: null,
          requireAdminApproval: true,
        })),
      });

      const result = await new AuthService(repo).register(registerDto, meta);

      // Same response as an open organization, so a closed tenant is not
      // detectable from the outside.
      expect(result).toMatchObject({ ok: true });
      expect(repo.createUser).not.toHaveBeenCalled();
    });

    it('refuses a member registration for an organization that allows only other types', async () => {
      const repo = makeRepo({
        findUserByEmail: jest.fn(async () => null),
        findRegistrationTarget: jest.fn(async () => ({
          id: tenant.id,
          name: 'Acme',
          status: 'active',
          allowSelfRegistration: true,
          allowedRegistrationTypes: ['CONTRACTOR'],
          requireAdminApproval: true,
        })),
      });

      await new AuthService(repo).register(registerDto, meta);

      expect(repo.createUser).not.toHaveBeenCalled();
    });

    describe('INDIVIDUAL', () => {
      const individualDto: RegisterDto = {
        registrationType: 'INDIVIDUAL',
        email: 'ada@personal.test',
        password: 'Str0ng-Passw0rd!',
        firstName: 'Ada',
        lastName: 'Lovelace',
        acceptTerms: true,
      };

      it('creates an ACTIVE account with no organization and no approval request', async () => {
        const repo = registerRepo();
        await new AuthService(repo).register(individualDto, meta);

        expect(repo.createUser).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'ACTIVE',
            tenantId: null,
            registrationType: 'INDIVIDUAL',
            emailVerified: false,
          }),
          expect.anything()
        );
        expect(repo.ensureMembership).not.toHaveBeenCalled();
        expect(onSelfRegistration).not.toHaveBeenCalled();
      });

      it('tells the person to verify their email rather than wait for approval', async () => {
        const result = await new AuthService(registerRepo()).register(individualDto, meta);

        expect(result.message).not.toMatch(/approval/i);
        expect(result.outcome).toBe('PENDING_EMAIL_VERIFICATION');
      });
    });

    describe('CREATE_ORGANIZATION', () => {
      const createOrgDto: RegisterDto = {
        registrationType: 'CREATE_ORGANIZATION',
        organization: {
          name: 'Acme Robotics',
          code: 'acme-robotics',
          businessEmail: 'billing@acme.test',
          country: 'IN',
          timezone: 'Asia/Kolkata',
        },
        email: 'owner@acme.test',
        password: 'Str0ng-Passw0rd!',
        firstName: 'Grace',
        lastName: 'Hopper',
        acceptTerms: true,
      };

      it('creates an inactive organization with the registrant as its PENDING owner', async () => {
        const repo = registerRepo();
        await new AuthService(repo).register(createOrgDto, meta);

        expect(repo.createOrganization).toHaveBeenCalledWith(
          expect.objectContaining({
            clientCode: 'acme-robotics',
            status: 'pending_verification',
            isVerified: false,
            // A brand-new organization must not be open to further
            // self-registration until its admin says so.
            allowSelfRegistration: false,
          }),
          expect.anything()
        );
        expect(repo.createUser).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'PENDING', registrationType: 'CREATE_ORGANIZATION' }),
          expect.anything()
        );
        expect(repo.ensureMembership).toHaveBeenCalledWith(
          'new-user-1',
          'new-org-1',
          expect.anything(),
          'owner'
        );
      });

      it('raises a NEW_ORGANIZATION request rather than a NEW_USER one', async () => {
        await new AuthService(registerRepo()).register(createOrgDto, meta);

        expect(onOrganizationRegistration).toHaveBeenCalledWith(
          expect.objectContaining({
            organizationId: 'new-org-1',
            organizationName: 'Acme Robotics',
            clientCode: 'acme-robotics',
          })
        );
        expect(onSelfRegistration).not.toHaveBeenCalled();
      });

      it('rejects a code another organization already holds', async () => {
        const repo = makeRepo({
          findUserByEmail: jest.fn(async () => null),
          organizationCodeTaken: jest.fn(async () => ({ id: 'other-org' })),
        });

        // Unlike the email, the code is the registrant's own choice and is
        // shown back to them, so it is a real field error.
        await expect(new AuthService(repo).register(createOrgDto, meta)).rejects.toMatchObject({
          code: 'ORG_CODE_TAKEN',
        });
        expect(repo.createOrganization).not.toHaveBeenCalled();
      });
    });
  });

  describe('login', () => {
    it('issues tokens for valid credentials', async () => {
      const result = await new AuthService(makeRepo()).login(loginDto, meta);
      expect(result).toMatchObject({
        mfaRequired: false,
        accessToken: 'access',
        mfaSetupRequired: false,
      });
      expect(RateLimitService.clearForEmail).toHaveBeenCalledWith(baseUser.email);
    });

    describe('organization login policy', () => {
      const withLoginPolicy = (patch: Record<string, unknown>) => {
        const actual = jest.requireActual('../security-policy/security-policy.service');
        (SecurityPolicyService.forOrganization as jest.Mock).mockResolvedValue({
          password: actual.DEFAULT_PASSWORD_POLICY,
          login: { ...actual.DEFAULT_LOGIN_POLICY, ...patch },
        });
      };

      it('refuses sign-in from outside the IP allow-list once the password is proven', async () => {
        withLoginPolicy({ allowedIpRanges: ['10.0.0.0/8'] });
        await expect(new AuthService(makeRepo()).login(loginDto, meta)).rejects.toMatchObject({
          status: 403,
          code: 'IP_NOT_ALLOWED',
        });
        expect(SessionService.create).not.toHaveBeenCalled();
      });

      it('allows sign-in from inside the allow-list and applies session caps', async () => {
        withLoginPolicy({
          allowedIpRanges: ['203.0.113.0/24'],
          sessionLifetimeDays: 3,
          maxConcurrentSessions: 2,
        });
        await new AuthService(makeRepo()).login(loginDto, meta);
        expect(SessionService.create).toHaveBeenCalledWith(
          expect.objectContaining({ maxLifetimeDays: 3, maxConcurrentSessions: 2 })
        );
      });

      it('checks lockout against the organization threshold', async () => {
        withLoginPolicy({ lockoutThreshold: 3, lockoutMinutes: 30 });
        await new AuthService(makeRepo()).login(loginDto, meta);
        expect(RateLimitService.assertAccountAllowed).toHaveBeenCalledWith(
          loginDto.email,
          expect.objectContaining({ lockoutThreshold: 3, lockoutMinutes: 30 })
        );
      });
    });

    it('returns the same error for an unknown user and a wrong password', async () => {
      const unknown = new AuthService(makeRepo({ findUserInTenant: jest.fn(async () => null) }));
      await expect(unknown.login(loginDto, meta)).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });

      (PasswordService.verify as jest.Mock).mockResolvedValue(false);
      await expect(new AuthService(makeRepo()).login(loginDto, meta)).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
      expect(RateLimitService.record).toHaveBeenCalledTimes(2);
    });

    it('does not reveal account status before the password is proven', async () => {
      (PasswordService.verify as jest.Mock).mockResolvedValue(false);
      const repo = makeRepo({
        findUserInTenant: jest.fn(async () => ({ ...baseUser, status: 'SUSPENDED' })),
      });
      await expect(new AuthService(repo).login(loginDto, meta)).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('blocks unverified accounts that went through verification', async () => {
      const repo = makeRepo({
        findUserInTenant: jest.fn(async () => ({ ...baseUser, emailVerified: false })),
      });
      await expect(new AuthService(repo).login(loginDto, meta)).rejects.toMatchObject({
        code: 'EMAIL_NOT_VERIFIED',
      });
    });

    it('grandfathers legacy unverified accounts with no verification record', async () => {
      const repo = makeRepo({
        findUserInTenant: jest.fn(async () => ({ ...baseUser, emailVerified: false })),
        hasEmailVerificationRecord: jest.fn(async () => false),
      });
      await expect(new AuthService(repo).login(loginDto, meta)).resolves.toMatchObject({
        mfaRequired: false,
      });
    });

    it('rejects admin-locked accounts after verifying the password', async () => {
      const repo = makeRepo({
        findUserInTenant: jest.fn(async () => ({ ...baseUser, isAccountLocked: true })),
      });
      await expect(new AuthService(repo).login(loginDto, meta)).rejects.toMatchObject({
        code: 'ACCOUNT_LOCKED',
        status: 423,
      });
    });

    it('returns a 2FA challenge instead of tokens when 2FA is enabled', async () => {
      const repo = makeRepo({
        findUserInTenant: jest.fn(async () => ({ ...baseUser, mfaEnabled: true })),
      });
      const result = await new AuthService(repo).login(loginDto, meta);
      expect(result).toMatchObject({ mfaRequired: true, mfaToken: 'raw-token', mfaMethod: 'totp' });
      expect(repo.createChallenge).toHaveBeenCalledWith(
        expect.objectContaining({ tokenHash: 'hashed-token', purpose: 'mfa_login' })
      );
      expect(TokenService.issue).not.toHaveBeenCalled();
    });
  });

  describe('2FA challenge', () => {
    const challenge = {
      id: 'ch-1',
      userId: 'user-1',
      organizationId: 'org-1',
      method: 'totp',
      payload: null,
      rememberMe: false,
    };

    it('completes sign-in with a valid TOTP code, consuming the challenge once', async () => {
      (MfaService.verifyTotp as jest.Mock).mockResolvedValue(true);
      const repo = makeRepo({ findLiveChallenge: jest.fn(async () => challenge) });
      await expect(new AuthService(repo).verifyMfa('tok', '123456', meta)).resolves.toMatchObject({
        accessToken: 'access',
      });
      expect(repo.consumeChallenge).toHaveBeenCalledWith('ch-1');
    });

    it('rejects an invalid code without consuming the challenge', async () => {
      (MfaService.verifyTotp as jest.Mock).mockResolvedValue(false);
      const repo = makeRepo({ findLiveChallenge: jest.fn(async () => challenge) });
      await expect(new AuthService(repo).verifyMfa('tok', '000000', meta)).rejects.toMatchObject({
        code: 'MFA_INVALID_CODE',
      });
      expect(repo.consumeChallenge).not.toHaveBeenCalled();
    });

    it('expires the challenge once the attempt budget is spent', async () => {
      const repo = makeRepo({
        findLiveChallenge: jest.fn(async () => challenge),
        recordChallengeAttempt: jest.fn(async () => false),
      });
      await expect(new AuthService(repo).verifyMfa('tok', '123456', meta)).rejects.toMatchObject({
        code: 'MFA_TOO_MANY_ATTEMPTS',
      });
      expect(repo.consumeChallenge).toHaveBeenCalledWith('ch-1');
    });

    it('reports remaining recovery codes after a recovery-code sign-in', async () => {
      (MfaService.consumeRecoveryCode as jest.Mock).mockResolvedValue(2);
      const repo = makeRepo({ findLiveChallenge: jest.fn(async () => challenge) });
      await expect(
        new AuthService(repo).verifyRecoveryCode('tok', 'ABCDEFGHJK', meta)
      ).resolves.toMatchObject({ recoveryCodesRemaining: 2 });
    });
  });

  describe('password recovery', () => {
    it('responds identically whether or not the account exists', async () => {
      const known = await new AuthService(makeRepo()).forgotPassword(baseUser.email, meta);
      const unknown = await new AuthService(
        makeRepo({ findUserByEmail: jest.fn(async () => null) })
      ).forgotPassword('nobody@acme.test', meta);
      expect(unknown).toEqual(known);
      expect(addQueueJob).toHaveBeenCalledTimes(1);
    });

    it('stores only the token hash and links to the app route', async () => {
      const repo = makeRepo();
      await new AuthService(repo).forgotPassword(baseUser.email, meta);
      expect(repo.createPasswordReset).toHaveBeenCalledWith(
        expect.objectContaining({ tokenHash: 'hashed-token' })
      );
      expect(addQueueJob).toHaveBeenCalledWith(
        'send-password-reset',
        expect.objectContaining({
          resetLink: expect.stringMatching(/\/auth\/reset-password\?token=raw-token$/),
        })
      );
    });

    it('stops sending once the per-account window is used up', async () => {
      const repo = makeRepo({ countRecentPasswordResets: jest.fn(async () => 3) });
      await new AuthService(repo).forgotPassword(baseUser.email, meta);
      expect(addQueueJob).not.toHaveBeenCalled();
    });

    it('rejects an unknown or expired reset token', async () => {
      const repo = makeRepo({ findLivePasswordReset: jest.fn(async () => null) });
      await expect(
        new AuthService(repo).resetPassword('bad', 'Str0ng!Passphrase', meta)
      ).rejects.toMatchObject({ code: 'INVALID_RESET_TOKEN' });
    });

    it('refuses a recently used password', async () => {
      (PasswordService.verify as jest.Mock).mockResolvedValue(true);
      const repo = makeRepo({
        findLivePasswordReset: jest.fn(async () => ({ userId: 'user-1' })),
        recentPasswordHashes: jest.fn(async () => [{ passwordHash: 'old' }]),
      });
      await expect(
        new AuthService(repo).resetPassword('tok', 'Str0ng!Passphrase', meta)
      ).rejects.toMatchObject({ code: 'PASSWORD_REUSE' });
    });
  });

  describe('sessions', () => {
    const actor = {
      ...meta,
      userId: 'user-1',
      tenantId: 'org-1',
      sessionId: 'session-1',
      email: baseUser.email,
    };

    it('does not let a user revoke a session they do not own', async () => {
      (SessionService.revokeOwned as jest.Mock).mockResolvedValue(false);
      await expect(
        new AuthService(makeRepo()).revokeSession(actor, 'someone-elses-session')
      ).rejects.toMatchObject({ status: 404 });
    });

    it('keeps the current session when revoking the others', async () => {
      await expect(new AuthService(makeRepo()).revokeOtherSessions(actor)).resolves.toEqual({
        ok: true,
        revoked: 2,
      });
      expect(SessionService.revokeAllExcept).toHaveBeenCalledWith('user-1', 'session-1');
    });
  });
});
