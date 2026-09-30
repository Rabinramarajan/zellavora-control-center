import { z } from 'zod';
import { config } from '../../config/env';
import { AppError } from '../../middleware/error';
import { AuditService } from '../../infrastructure/audit';
import { cacheDelPattern, cacheGet, cacheKey, cacheSet } from '../../infrastructure/cache';
import { logger } from '../../infrastructure/logger';
import { SecurityPolicyRepository } from './security-policy.repository';
import {
  LoginPolicy,
  LoginPolicySchema,
  MfaComplianceQuery,
  MfaPolicy,
  PasswordPolicy,
  PasswordPolicySchema,
  SecurityPolicies,
} from './security-policy.dto';

const PASSWORD_KEY = 'security.password_policy';
const LOGIN_KEY = 'security.login_policy';
const CACHE_TTL_SECONDS = 60;
const cacheKeyFor = (organizationId: string) => cacheKey('iam', 'security-policy', organizationId);

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 12,
  historyDepth: config.passwordHistoryDepth,
  disallowEmailInPassword: true,
};

export const DEFAULT_LOGIN_POLICY: LoginPolicy = {
  lockoutThreshold: config.accountLockoutThreshold,
  lockoutMinutes: config.accountLockoutMinutes,
  sessionIdleMinutes: 0,
  sessionLifetimeDays: 30,
  maxConcurrentSessions: 0,
  allowedIpRanges: [],
};

const ipv4ToInt = (ip: string): number | null => {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255))
    return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
};

/** True when `ip` falls inside any of the IPv4 addresses / CIDR ranges. */
export const ipInRanges = (ip: string, ranges: readonly string[]): boolean => {
  const normalized = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  const value = ipv4ToInt(normalized);
  if (value === null) return false;
  return ranges.some((range) => {
    const [base, bitsRaw] = range.split('/');
    const baseValue = ipv4ToInt(base);
    if (baseValue === null) return false;
    const bits = bitsRaw === undefined ? 32 : Number(bitsRaw);
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (value & mask) === (baseValue & mask);
  });
};

/**
 * Organization security policies (password, login/session, MFA).
 *
 * Password and login policies live in `organization_settings` as JSON under
 * fixed keys; MFA enforcement is the existing `organizations.enforce_2fa`
 * flag, which login already honours via `mfaSetupRequired`. Stored values are
 * re-validated on read and fall back to defaults, so a bad row can never
 * weaken or break sign-in.
 */
export class SecurityPolicyService {
  private static readonly repo = new SecurityPolicyRepository();

  /** Effective policies for an org — cached briefly because auth reads them per request. */
  static async forOrganization(
    organizationId: string | null | undefined
  ): Promise<SecurityPolicies> {
    if (!organizationId) return { password: DEFAULT_PASSWORD_POLICY, login: DEFAULT_LOGIN_POLICY };

    const key = cacheKeyFor(organizationId);
    const cached = await cacheGet<SecurityPolicies>(key).catch(() => null);
    if (cached) return cached;

    const rows = await this.repo.findSettings(organizationId, [PASSWORD_KEY, LOGIN_KEY]);
    const read = <T>(settingKey: string, schema: z.ZodTypeAny, fallback: T): T => {
      const row = rows.find((r) => r.key === settingKey);
      if (!row) return fallback;
      try {
        const parsed = schema.safeParse({ ...fallback, ...JSON.parse(row.value) });
        if (parsed.success) return parsed.data as T;
      } catch {
        // fall through to the default below
      }
      logger.warn(`[security-policy] ignoring invalid ${settingKey} for org ${organizationId}`);
      return fallback;
    };

    const policies: SecurityPolicies = {
      password: read<PasswordPolicy>(PASSWORD_KEY, PasswordPolicySchema, DEFAULT_PASSWORD_POLICY),
      login: read<LoginPolicy>(LOGIN_KEY, LoginPolicySchema, DEFAULT_LOGIN_POLICY),
    };
    await cacheSet(key, policies, CACHE_TTL_SECONDS).catch(() => undefined);
    return policies;
  }

  /** Throws a 400 when `password` breaks the org policy beyond the global DTO floor. */
  static assertPasswordAllowed(
    policy: PasswordPolicy,
    password: string,
    email?: string | null
  ): void {
    if (password.length < policy.minLength) {
      throw new AppError(
        `Password must be at least ${policy.minLength} characters.`,
        400,
        'PASSWORD_POLICY',
        { field: 'password' }
      );
    }
    const localPart = email?.split('@')[0]?.toLowerCase();
    if (
      policy.disallowEmailInPassword &&
      localPart &&
      localPart.length >= 3 &&
      password.toLowerCase().includes(localPart)
    ) {
      throw new AppError('Password must not contain your email address.', 400, 'PASSWORD_POLICY', {
        field: 'password',
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Admin API
  // ---------------------------------------------------------------------------

  async getAll(organizationId: string) {
    const [policies, org] = await Promise.all([
      SecurityPolicyService.forOrganization(organizationId),
      SecurityPolicyService.repo.findOrganization(organizationId),
    ]);
    if (!org) throw new AppError('Organization not found', 404, 'TENANT_NOT_FOUND');
    return { ...policies, mfa: { enforce: org.enforce2fa } satisfies MfaPolicy };
  }

  async updatePassword(organizationId: string, dto: PasswordPolicy, actorId: string | null) {
    const before = (await SecurityPolicyService.forOrganization(organizationId)).password;
    await SecurityPolicyService.repo.upsertSetting(
      organizationId,
      PASSWORD_KEY,
      JSON.stringify(dto)
    );
    await this.afterChange(organizationId, 'password_policy', before, dto, actorId);
    return dto;
  }

  async updateLogin(organizationId: string, dto: LoginPolicy, actorId: string | null) {
    const before = (await SecurityPolicyService.forOrganization(organizationId)).login;
    await SecurityPolicyService.repo.upsertSetting(organizationId, LOGIN_KEY, JSON.stringify(dto));
    await this.afterChange(organizationId, 'login_policy', before, dto, actorId);
    return dto;
  }

  async updateMfa(organizationId: string, dto: MfaPolicy, actorId: string | null) {
    const org = await SecurityPolicyService.repo.findOrganization(organizationId);
    if (!org) throw new AppError('Organization not found', 404, 'TENANT_NOT_FOUND');
    await SecurityPolicyService.repo.setEnforce2fa(organizationId, dto.enforce, actorId);
    await this.afterChange(organizationId, 'mfa_policy', { enforce: org.enforce2fa }, dto, actorId);
    return dto;
  }

  async mfaCompliance(organizationId: string, query: MfaComplianceQuery) {
    const enrolled = query.enrolled === undefined ? undefined : query.enrolled === 'true';
    const repo = SecurityPolicyService.repo;
    const [total, enrolledCount, filteredTotal, rows] = await Promise.all([
      repo.countMembers(organizationId),
      repo.countMembers(organizationId, true),
      repo.countMembers(organizationId, enrolled),
      repo.listMembers(organizationId, { enrolled, page: query.page, pageSize: query.pageSize }),
    ]);
    return {
      summary: { total, enrolled: enrolledCount, notEnrolled: total - enrolledCount },
      data: rows.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        mfaEnabled: u.mfaEnabled,
        mfaMethod: u.mfaMethod,
        mfaEnrolledAt: u.mfaEnrolledAt?.toISOString() ?? null,
        lastLoginAt: u.lastLoginDatetime?.toISOString() ?? null,
      })),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: filteredTotal,
        totalPages: Math.ceil(filteredTotal / query.pageSize),
      },
    };
  }

  private async afterChange(
    organizationId: string,
    resourceId: string,
    before: object,
    after: object,
    actorId: string | null
  ) {
    await cacheDelPattern(cacheKeyFor(organizationId)).catch(() => undefined);
    await AuditService.log({
      organizationId,
      actorId,
      action: `security.${resourceId}.updated`,
      resource: 'security_policy',
      resourceId,
      severity: 'warning',
      before: before as Record<string, unknown>,
      after: after as Record<string, unknown>,
    });
  }
}
