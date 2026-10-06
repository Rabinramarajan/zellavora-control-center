/**
 * Shared Redis connection for the cache and the distributed rate limiter.
 *
 * One lazily-created client per process: ioredis multiplexes commands over a
 * single socket, and on a serverless platform each extra connection is one
 * more handle counted against the provider's limit on every cold start.
 *
 * Returns null whenever Redis is not configured, so callers degrade instead
 * of branching on env vars themselves. Connection errors are swallowed here
 * (with a warning) because an unreachable cache must not take down requests —
 * each caller decides its own fallback.
 */
import Redis from 'ioredis';
import { config } from '../config/env';
import { logger } from './logger';

let client: Redis | null = null;

/**
 * True when a Redis URL is configured; does not imply the server is reachable.
 *
 * Deliberately gated on REDIS_URL alone, not REDIS_ENABLED. REDIS_ENABLED is
 * an opt-in for the application cache, and a deployment that sets only the URL
 * must still get distributed rate limits — the alternative is a cluster that
 * silently counts quotas per process. Consumers that want the cache's opt-in
 * semantics check config.redisEnabled themselves.
 */
export const redisConfigured = (): boolean => Boolean(config.redisUrl);

export function getRedis(): Redis | null {
  if (!redisConfigured()) return null;

  if (!client) {
    client = new Redis(config.redisUrl as string, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      enableOfflineQueue: false,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 500, 2000);
      },
    });

    // Attach before the first command so ioredis never emits an unhandled
    // 'error' event while it retries the connection.
    client.on('error', (err: Error) => {
      logger.warn(`Redis error: ${err.message}`);
    });
  }

  return client;
}
