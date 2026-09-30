import { AuthService } from './auth.service';
import type { AuthRepository } from './auth.repository';
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
  EncryptionService: { encrypt: jest.fn((v: string) => `enc:${v}`), decrypt: jest.fn((v: string) => v.slice(4)) },
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

  describe('login', () => {
    it('issues tokens for valid credentials', async () => {
      const result = await new AuthService(makeRepo()).login(loginDto, meta);
      expect(result).toMatchObject({ mfaRequired: false, accessToken: 'access', mfaSetupRequired: false });
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
        withLoginPolicy({ allowedIpRanges: ['203.0.113.0/24'], sessionLifetimeDays: 3, maxConcurrentSessions: 2 });
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
        expect.objectContaining({ resetLink: expect.stringMatching(/\/auth\/reset-password\?token=raw-token$/) })
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
    const actor = { ...meta, userId: 'user-1', tenantId: 'org-1', sessionId: 'session-1', email: baseUser.email };

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
