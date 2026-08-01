/**
 * Generic cache helpers: two-tier in-process (L1) + Redis (L2), keyed by a
 * builder. Safe when Redis is disabled or unreachable — every helper falls
 * back to L1-only with a short TTL so the app keeps working.
 *
 * Key format is namespaced per domain:  zcc:cache:{domain}:{key}
 */
import Redis from 'ioredis';
import { LRUCache } from 'lru-cache';
import { config } from '../config/env';

const L1_TTL_MS = 15_000; // in-process, always shorter than L2

interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  delPattern(pattern: string): Promise<void>;
  del(...keys: string[]): Promise<void>;
}

class RedisCacheClient implements CacheClient {
  private redis: Redis | null = null;
  private l1 = new LRUCache<string, string>({ max: 20_000, ttl: L1_TTL_MS });

  private ensure(): Redis | null {
    if (!config.redisEnabled || !config.redisUrl) return null;
    if (!this.redis) {
      this.redis = new Redis(config.redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 2,
        connectTimeout: 5000,
        enableOfflineQueue: false,
      });
      this.redis.on('error', () => {
        // best-effort — L1 fallback keeps the app alive
      });
    }
    return this.redis;
  }

  async get(key: string): Promise<string | null> {
    const l1 = this.l1.get(key);
    if (l1 !== undefined) return l1;

    const redis = this.ensure();
    if (!redis) return null;
    try {
      const raw = await redis.get(key);
      if (raw) this.l1.set(key, raw);
      return raw;
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.l1.set(key, value);
    const redis = this.ensure();
    if (!redis) return;
    try {
      await redis.set(key, value, 'EX', ttlSeconds);
    } catch {
      /* L1 fallback */
    }
  }

  async delPattern(pattern: string): Promise<void> {
    for (const key of this.l1.keys()) {
      if (key.includes(pattern.replace('*', ''))) this.l1.delete(key);
    }

    const redis = this.ensure();
    if (!redis) return;
    try {
      const stream = redis.scanStream({ match: pattern });
      const toDelete: string[] = [];
      for await (const keys of stream) {
        toDelete.push(...(keys as string[]));
      }
      if (toDelete.length > 0) await redis.del(...toDelete);
    } catch {
      /* best-effort */
    }
  }

  async del(...keys: string[]): Promise<void> {
    for (const key of keys) this.l1.delete(key);
    const redis = this.ensure();
    if (!redis || keys.length === 0) return;
    try {
      await redis.del(...keys);
    } catch {
      /* best-effort */
    }
  }
}

/** Singleton — reusing one Redis connection across the process. */
export const cache = new RedisCacheClient();

const serialize = (value: unknown): string =>
  typeof value === 'string' ? value : JSON.stringify(value);

const deserialize = <T>(raw: string): T | null => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
};

export const cacheKey = (...parts: Array<string | number>): string =>
  parts.map((p) => String(p)).join(':');

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await cache.get(key);
  if (raw === null) return null;
  return deserialize<T>(raw);
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = config.redisTtlSeconds
): Promise<void> {
  await cache.set(key, serialize(value), ttlSeconds);
}

/** Delete every key matching `prefix*` (e.g. 'zcc:cache:user:42:*'). */
export async function cacheDelPattern(pattern: string): Promise<void> {
  await cache.delPattern(pattern);
}

export async function cacheDel(...keys: string[]): Promise<void> {
  await cache.del(...keys);
}
