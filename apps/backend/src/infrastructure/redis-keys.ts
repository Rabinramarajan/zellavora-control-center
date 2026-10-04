/**
 * Single source of truth for every Redis key and pub/sub channel ZCC owns.
 *
 * Everything lives under the `zcc:` namespace so a shared or multi-tenant
 * Redis instance can be inspected, monitored and flushed per concern:
 *
 *   zcc:cache:{domain}:{...}        application cache (see infrastructure/cache.ts)
 *   zcc:rbac:policy:{org}:{user}:v{n}
 *   zcc:rbac:lock:{org}:{user}:v{n}
 *   zcc:rbac:invalidate:{org}       pub/sub channel, not a key
 *   zcc:rate-limit:{bucket}:{id}    distributed rate-limit counters
 *
 * Build keys through these helpers rather than interpolating strings at the
 * call site — a prefix typo silently splits a cache or a rate-limit bucket
 * instead of failing, so it only shows up as a hit-rate or quota anomaly.
 */

/** Root namespace for every ZCC-owned key. */
export const KEY_NAMESPACE = 'zcc';

const join = (...parts: Array<string | number>): string => [KEY_NAMESPACE, ...parts].join(':');

export const redisKeys = {
  /**
   * Application cache. `logical` is the domain-scoped key a service builds
   * (e.g. `iam:users:42`); the `zcc:cache:` prefix is added here so call
   * sites stay free of namespace bookkeeping.
   */
  cache: (logical: string): string => join('cache', logical),

  /** Effective-policy entry, versioned so a policy bump invalidates implicitly. */
  rbacPolicy: (orgId: string, userId: string, version: number): string =>
    join('rbac', 'policy', orgId, userId, `v${version}`),

  /** Single-flight lock guarding one policy recomputation. */
  rbacLock: (orgId: string, userId: string, version: number): string =>
    join('rbac', 'lock', orgId, userId, `v${version}`),

  /** Every policy entry for one user in one org, any version. */
  rbacPolicyUserPattern: (orgId: string, userId: string): string =>
    join('rbac', 'policy', orgId, userId, '*'),

  /** Every policy entry in one org. */
  rbacPolicyOrgPattern: (orgId: string): string => join('rbac', 'policy', orgId, '*'),

  /** Pub/sub channel announcing an org-wide invalidation to other instances. */
  rbacInvalidateChannel: (orgId: string): string => join('rbac', 'invalidate', orgId),

  /** psubscribe pattern matching every org's invalidation channel. */
  rbacInvalidatePattern: (): string => join('rbac', 'invalidate', '*'),

  /** Prefix handed to rate-limit-redis; it appends its own per-client suffix. */
  rateLimit: (bucket: string): string => `${join('rate-limit', bucket)}:`,
} as const;

/** Strips the invalidation-channel prefix back to a bare orgId. */
export const orgIdFromInvalidateChannel = (channel: string): string =>
  channel.slice(join('rbac', 'invalidate', '').length);
