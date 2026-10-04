/**
 * Subscribes to the zcc:rbac:invalidate:{orgId} channels and drops in-process
 * L1 entries on receipt. Run once per process at boot.
 */
import type Redis from 'ioredis';
import type { PolicyCache } from './policy-cache';
import { redisKeys, orgIdFromInvalidateChannel } from '../../infrastructure/redis-keys';

export async function startInvalidationListener(redis: Redis, cache: PolicyCache): Promise<void> {
  const subscriber = redis.duplicate();
  const pattern = redisKeys.rbacInvalidatePattern();

  await subscriber.psubscribe(pattern);

  subscriber.on('pmessage', async (_pattern, channel, _message) => {
    const orgId = orgIdFromInvalidateChannel(channel);
    if (!orgId) return;
    await cache.invalidateOrg(orgId);
  });

  // eslint-disable-next-line no-console
  console.log(`[rbac] Subscribed to ${pattern}`);
}
