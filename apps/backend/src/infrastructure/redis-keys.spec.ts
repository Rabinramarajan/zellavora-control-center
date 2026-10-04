import { KEY_NAMESPACE, orgIdFromInvalidateChannel, redisKeys } from './redis-keys';

describe('redisKeys', () => {
  it('namespaces every key under the zcc root', () => {
    const keys = [
      redisKeys.cache('iam:users:42'),
      redisKeys.rbacPolicy('org-1', 'user-1', 7),
      redisKeys.rbacLock('org-1', 'user-1', 7),
      redisKeys.rbacPolicyUserPattern('org-1', 'user-1'),
      redisKeys.rbacPolicyOrgPattern('org-1'),
      redisKeys.rbacInvalidateChannel('org-1'),
      redisKeys.rbacInvalidatePattern(),
      redisKeys.rateLimit('auth:login'),
    ];

    for (const key of keys) {
      expect(key.startsWith(`${KEY_NAMESPACE}:`)).toBe(true);
    }
  });

  it('builds the documented key layout', () => {
    expect(redisKeys.cache('iam:users:42')).toBe('zcc:cache:iam:users:42');
    expect(redisKeys.rbacPolicy('org-1', 'user-1', 7)).toBe('zcc:rbac:policy:org-1:user-1:v7');
    expect(redisKeys.rbacLock('org-1', 'user-1', 7)).toBe('zcc:rbac:lock:org-1:user-1:v7');
    expect(redisKeys.rbacInvalidateChannel('org-1')).toBe('zcc:rbac:invalidate:org-1');
  });

  it('matches the versioned policy key with the user invalidation pattern', () => {
    const pattern = redisKeys.rbacPolicyUserPattern('org-1', 'user-1');
    const key = redisKeys.rbacPolicy('org-1', 'user-1', 7);

    expect(key.startsWith(pattern.slice(0, -1))).toBe(true);
  });

  it('keeps the org pattern from matching a different org', () => {
    const pattern = redisKeys.rbacPolicyOrgPattern('org-1').slice(0, -1);

    expect(redisKeys.rbacPolicy('org-1', 'user-1', 1).startsWith(pattern)).toBe(true);
    expect(redisKeys.rbacPolicy('org-2', 'user-1', 1).startsWith(pattern)).toBe(false);
  });

  it('round-trips an orgId through its invalidation channel', () => {
    expect(orgIdFromInvalidateChannel(redisKeys.rbacInvalidateChannel('org-9'))).toBe('org-9');
  });

  it('ends a rate-limit prefix with a separator so suffixes stay delimited', () => {
    expect(redisKeys.rateLimit('auth:login')).toBe('zcc:rate-limit:auth:login:');
  });
});
