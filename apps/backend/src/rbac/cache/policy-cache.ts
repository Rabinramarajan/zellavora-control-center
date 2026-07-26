/**
 * Two-tier policy cache: L1 (in-process LRU) + L2 (Redis).
 *
 * Key format:  rbac:policy:{orgId}:{userId}:v{policyVersion}
 * Plus negative cache:  rbac:deny:{orgId}:{userId}:{permKey}
 *
 * Single-flight via SETNX prevents cache stampede.
 */
import { LRUCache } from 'lru-cache';
import type Redis from 'ioredis';
import type { EffectivePolicy } from '../engine/permission-engine';

const L1_TTL_MS = 60_000;        // 1 min in-process
const L2_TTL_SEC = 300;          // 5 min Redis
const NEG_TTL_SEC = 60;          // 1 min negative cache
const LOCK_TTL_SEC = 5;          // single-flight lock

export class PolicyCache {
  private l1: LRUCache<string, EffectivePolicy>;

  constructor(
    private redis: Redis,
    l1Max = 10_000
  ) {
    this.l1 = new LRUCache<string, EffectivePolicy>({
      max: l1Max,
      ttl: L1_TTL_MS
    });
  }

  private static k(orgId: string, userId: string, version: number) {
    return `rbac:policy:${orgId}:${userId}:v${version}`;
  }

  private static lockKey(orgId: string, userId: string, version: number) {
    return `rbac:lock:${orgId}:${userId}:v${version}`;
  }

  /**
   * L1 + L2 lookup. Returns null on miss.
   */
  async get(
    userId: string,
    orgId: string,
    version: number
  ): Promise<EffectivePolicy | null> {
    const k = PolicyCache.k(orgId, userId, version);

    // L1
    const l1Hit = this.l1.get(k);
    if (l1Hit) return l1Hit;

    // L2
    const raw = await this.redis.get(k);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as EffectivePolicy;
        this.l1.set(k, parsed);
        return parsed;
      } catch {
        // corrupt — treat as miss
      }
    }

    return null;
  }

  /**
   * Set in L1 + L2.
   */
  async set(
    userId: string,
    orgId: string,
    version: number,
    policy: EffectivePolicy
  ): Promise<void> {
    const k = PolicyCache.k(orgId, userId, version);
    this.l1.set(k, policy);
    await this.redis.set(k, JSON.stringify(policy), 'EX', L2_TTL_SEC);
  }

  /**
   * Single-flight: only one coroutine per (org,user,version) hits the DB
   * on a miss. Others wait on a short Redis lock.
   */
  async setWithLock<T extends EffectivePolicy>(
    userId: string,
    orgId: string,
    version: number,
    loader: () => Promise<T>
  ): Promise<T> {
    const cached = await this.get(userId, orgId, version);
    if (cached) return cached as T;

    const lockKey = PolicyCache.lockKey(orgId, userId, version);
    const acquired = await this.redis.set(lockKey, '1', 'EX', LOCK_TTL_SEC, 'NX');

    if (!acquired) {
      // Another worker is computing — brief wait then re-read
      await new Promise(r => setTimeout(r, 50));
      const second = await this.get(userId, userId, version);
      if (second) return second as T;
    }

    try {
      const policy = await loader();
      await this.set(userId, orgId, version, policy);
      return policy;
    } finally {
      await this.redis.del(lockKey);
    }
  }

  /**
   * Cache deny result for hot path. Optional.
   */
  async setDeny(orgId: string, userId: string, permKey: string): Promise<void> {
    await this.redis.set(
      `rbac:deny:${orgId}:${userId}:${permKey}`,
      '1',
      'EX',
      NEG_TTL_SEC
    );
  }

  async isDenied(orgId: string, userId: string, permKey: string): Promise<boolean> {
    const v = await this.redis.get(`rbac:deny:${orgId}:${userId}:${permKey}`);
    return v === '1';
  }

  /**
   * Targeted invalidation. Called by mutation handlers.
   */
  async invalidate(userId: string, orgId: string): Promise<void> {
    // L1: scan and drop matching keys
    for (const key of this.l1.keys()) {
      if (key.includes(`:${orgId}:${userId}:`)) this.l1.delete(key);
    }

    // L2: pattern delete via SCAN
    const stream = this.redis.scanStream({
      match: `rbac:policy:${orgId}:${userId}:*`
    });
    const toDelete: string[] = [];
    for await (const keys of stream) {
      toDelete.push(...(keys as string[]));
    }
    if (toDelete.length > 0) {
      await this.redis.del(...toDelete);
    }
  }

  /**
   * Invalidate an entire org's cached policies.
   */
  async invalidateOrg(orgId: string): Promise<void> {
    for (const key of this.l1.keys()) {
      if (key.includes(`:${orgId}:`)) this.l1.delete(key);
    }

    const stream = this.redis.scanStream({
      match: `rbac:policy:${orgId}:*`
    });
    const toDelete: string[] = [];
    for await (const keys of stream) {
      toDelete.push(...(keys as string[]));
    }
    if (toDelete.length > 0) {
      await this.redis.del(...toDelete);
    }

    // Broadcast so other instances drop their L1 caches
    await this.redis.publish(`rbac:invalidate:${orgId}`, JSON.stringify({ ts: Date.now() }));
  }
}
