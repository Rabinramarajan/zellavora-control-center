import { z } from 'zod';

/** CIDR (v4) or a single IPv4 address, e.g. `10.0.0.0/8` or `203.0.113.7`. */
const ipv4Range = z
  .string()
  .trim()
  .regex(
    /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}(\/(3[0-2]|[12]?\d))?$/,
    'Enter an IPv4 address or CIDR range, e.g. 10.0.0.0/8'
  );

export const PasswordPolicySchema = z
  .object({
    // 12 is the floor enforced by the auth DTOs; orgs may only tighten it.
    minLength: z.number().int().min(12).max(128),
    historyDepth: z.number().int().min(0).max(24),
    disallowEmailInPassword: z.boolean(),
  })
  .strict();

export const LoginPolicySchema = z
  .object({
    lockoutThreshold: z.number().int().min(3).max(20),
    lockoutMinutes: z.number().int().min(1).max(1440),
    // 0 disables the idle timeout.
    sessionIdleMinutes: z
      .number()
      .int()
      .min(0)
      .max(1440)
      .refine((v) => v === 0 || v >= 5, 'Idle timeout must be 0 (off) or at least 5 minutes'),
    sessionLifetimeDays: z.number().int().min(1).max(90),
    // 0 means unlimited.
    maxConcurrentSessions: z.number().int().min(0).max(50),
    allowedIpRanges: z.array(ipv4Range).max(100),
  })
  .strict();

export const MfaPolicySchema = z
  .object({
    enforce: z.boolean(),
  })
  .strict();

export const MfaComplianceQuerySchema = z.object({
  enrolled: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// Required<>: the backend tsconfig is non-strict, which makes zod widen keys to optional.
export type PasswordPolicy = Required<z.infer<typeof PasswordPolicySchema>>;
export type LoginPolicy = Required<z.infer<typeof LoginPolicySchema>>;
export type MfaPolicy = Required<z.infer<typeof MfaPolicySchema>>;
export type MfaComplianceQuery = z.infer<typeof MfaComplianceQuerySchema>;

export interface SecurityPolicies {
  password: PasswordPolicy;
  login: LoginPolicy;
}
