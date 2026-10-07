/**
 * Shared Redis connection for the cache and the distributed rate limiter.
 *
 * Returns null whenever Redis is not configured, so callers degrade gracefully
 * (e.g. rate limiter falls back to in-memory counting).
 */
import Redis from 'ioredis';
import { config } from '../config/env';

let client: Redis | null = null;
let initialized = false;

export const redisConfigured = (): boolean => Boolean(config.redisUrl);

export function getRedis(): Redis | null {
  if (!config.redisUrl) return null;

  if (!initialized) {
    initialized = true;
    try {
      client = new Redis(config.redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
        enableOfflineQueue: false,
        retryStrategy(times) {
          if (times > 3) return null;
          return Math.min(times * 500, 2000);
        },
      });

      client.on('error', () => {
        // Swallow — logged once at warn level when retries are exhausted.
      });
    } catch {
      client = null;
    }
  }

  return client;
}
