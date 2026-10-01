const store = new Map<string, unknown>();
jest.mock('../../infrastructure/cache', () => ({
  cacheKey: (...parts: string[]) => parts.join(':'),
  cacheGet: jest.fn(async (key: string) => store.get(key) ?? null),
  cacheSet: jest.fn(async (key: string, value: unknown) => void store.set(key, value)),
  cacheDelPattern: jest.fn(async (key: string) => void store.delete(key)),
}));
jest.mock('../../infrastructure/audit', () => ({ AuditService: { log: jest.fn() } }));

const repo = {
  findSettings: jest.fn(),
  upsertSetting: jest.fn(),
  findOrganization: jest.fn(),
  setEnforce2fa: jest.fn(),
  countMembers: jest.fn(),
  listMembers: jest.fn(),
};
jest.mock('./security-policy.repository', () => ({
  SecurityPolicyRepository: jest.fn().mockImplementation(() => repo),
}));

import { AuditService } from '../../infrastructure/audit';
import {
  DEFAULT_LOGIN_POLICY,
  DEFAULT_PASSWORD_POLICY,
  SecurityPolicyService,
  ipInRanges,
} from './security-policy.service';
import { LoginPolicySchema } from './security-policy.dto';

const ORG = '11111111-1111-4111-8111-111111111111';

describe('ipInRanges', () => {
  it.each([
    ['10.1.2.3', ['10.0.0.0/8'], true],
    ['11.0.0.1', ['10.0.0.0/8'], false],
    ['203.0.113.7', ['203.0.113.7'], true],
    ['203.0.113.8', ['203.0.113.7'], false],
    ['::ffff:192.168.1.20', ['192.168.1.0/24'], true],
    ['8.8.8.8', ['0.0.0.0/0'], true],
    ['2001:db8::1', ['10.0.0.0/8'], false],
    ['', ['10.0.0.0/8'], false],
  ])('%s in %j → %s', (ip, ranges, expected) => {
    expect(ipInRanges(ip, ranges)).toBe(expected);
  });
});

describe('SecurityPolicyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.clear();
  });

  describe('assertPasswordAllowed', () => {
    const policy = { minLength: 16, historyDepth: 5, disallowEmailInPassword: true };

    it('rejects passwords shorter than the org minimum', () => {
      expect(() =>
        SecurityPolicyService.assertPasswordAllowed(policy, 'Short-Pass-1!', 'a@b.co')
      ).toThrow(/at least 16/);
    });

    it('rejects passwords containing the email local part', () => {
      expect(() =>
        SecurityPolicyService.assertPasswordAllowed(
          policy,
          'Jane.Doe-Rocks-2026!',
          'jane.doe@corp.com'
        )
      ).toThrow(/email/);
    });

    it('accepts compliant passwords', () => {
      expect(() =>
        SecurityPolicyService.assertPasswordAllowed(
          policy,
          'Correct-Horse-Battery-9',
          'jane.doe@corp.com'
        )
      ).not.toThrow();
    });
  });

  describe('forOrganization', () => {
    it('returns defaults without an organization', async () => {
      const policies = await SecurityPolicyService.forOrganization(null);
      expect(policies).toEqual({ password: DEFAULT_PASSWORD_POLICY, login: DEFAULT_LOGIN_POLICY });
      expect(repo.findSettings).not.toHaveBeenCalled();
    });

    it('merges stored values over defaults and caches the result', async () => {
      repo.findSettings.mockResolvedValue([
        { key: 'security.login_policy', value: JSON.stringify({ lockoutThreshold: 3 }) },
      ]);
      const first = await SecurityPolicyService.forOrganization(ORG);
      expect(first.login).toEqual({ ...DEFAULT_LOGIN_POLICY, lockoutThreshold: 3 });

      await SecurityPolicyService.forOrganization(ORG);
      expect(repo.findSettings).toHaveBeenCalledTimes(1);
    });

    it('falls back to defaults when a stored policy is invalid', async () => {
      repo.findSettings.mockResolvedValue([
        { key: 'security.password_policy', value: JSON.stringify({ minLength: 4 }) },
        { key: 'security.login_policy', value: 'not json' },
      ]);
      const policies = await SecurityPolicyService.forOrganization(ORG);
      expect(policies.password).toEqual(DEFAULT_PASSWORD_POLICY);
      expect(policies.login).toEqual(DEFAULT_LOGIN_POLICY);
    });
  });

  it('updateLogin stores the policy, drops the cache and audits the change', async () => {
    repo.findSettings.mockResolvedValue([]);
    await SecurityPolicyService.forOrganization(ORG);
    const next = { ...DEFAULT_LOGIN_POLICY, allowedIpRanges: ['10.0.0.0/8'] };

    await new SecurityPolicyService().updateLogin(ORG, next, 'actor');

    expect(repo.upsertSetting).toHaveBeenCalledWith(
      ORG,
      'security.login_policy',
      JSON.stringify(next)
    );
    expect(store.size).toBe(0);
    expect(AuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'security.login_policy.updated', after: next })
    );
  });
});

describe('LoginPolicySchema', () => {
  it('accepts an idle timeout of 0 (off) but not 1–4 minutes', () => {
    expect(
      LoginPolicySchema.safeParse({ ...DEFAULT_LOGIN_POLICY, sessionIdleMinutes: 0 }).success
    ).toBe(true);
    expect(
      LoginPolicySchema.safeParse({ ...DEFAULT_LOGIN_POLICY, sessionIdleMinutes: 3 }).success
    ).toBe(false);
  });

  it('rejects malformed IP ranges', () => {
    const result = LoginPolicySchema.safeParse({
      ...DEFAULT_LOGIN_POLICY,
      allowedIpRanges: ['10.0.0.0/33'],
    });
    expect(result.success).toBe(false);
  });
});
