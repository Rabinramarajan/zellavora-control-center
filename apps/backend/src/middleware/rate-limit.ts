/**
 * Rate limiters backed by Redis so quotas are shared across instances.
 *
 * express-rate-limit's default MemoryStore keeps counters inside one process.
 * Behind a load balancer with N backends that multiplies every configured
 * limit by N — a 5-attempt login cap becomes 5N attempts, and on a serverless
 * platform, where instances are created and discarded per traffic burst, the
 * effective cap is unbounded. Counters therefore live in Redis.
 *
 * When Redis is absent (local dev) or unreachable, the limiter falls back to
 * per-process counting rather than failing requests: `passOnStoreError` lets a
 * store outage through instead of turning the cache into a hard dependency of
 * every route. Availability is the right trade here because the throttle is
 * defence-in-depth — login also enforces per-account lockout in the database.
 */
import { rateLimit, type Options, type RateLimitRequestHandler } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import type { RequestHandler } from 'express';
import type { Redis } from 'ioredis';
import { getRedis } from '../infrastructure/redis';
import { redisKeys } from '../infrastructure/redis-keys';
import { logger } from '../infrastructure/logger';

export interface RateLimiterOptions {
  /**
   * Bucket name, used as the Redis key prefix. Must be unique per limiter:
   * two limiters sharing a bucket share one counter, so the tighter of the
   * two silently throttles traffic meant for the looser one.
   */
  bucket: string;
  windowMs: number;
  limit: number;
  /** Defaults to the client IP. Return a stable identity (e.g. userId). */
  keyGenerator?: Options['keyGenerator'];
  /** Defaults to the standard ZCC 429 envelope. */
  handler?: Options['handler'];
  message?: Options['message'];
}

const defaultHandler: Options['handler'] = (_req, res, _next, options) => {
  res.status(429).json({
    error: {
      message: 'Too many attempts. Please try again later.',
      code: 'RATE_LIMITED',
      status: 429,
      retryAfterSeconds: Math.ceil(options.windowMs / 1000),
    },
  });
};

/** Logged once per process so a dev box doesn't repeat it per limiter. */
let warnedAboutMemoryStore = false;

export function createRateLimiter(options: RateLimiterOptions): RateLimitRequestHandler {
  const redis = getRedis();

  if (!redis && !warnedAboutMemoryStore) {
    warnedAboutMemoryStore = true;
    logger.warn(
      'Redis is not configured — rate limits are counted per process and will not hold across instances.'
    );
  }

  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator,
    ...(options.message !== undefined
      ? { message: options.message }
      : { handler: options.handler ?? defaultHandler }),
    // A store outage must not become a 500 on every throttled route.
    passOnStoreError: true,
    ...(redis ? { store: buildRedisStore(redis, options.bucket) } : {}),
  });
}

function buildRedisStore(redis: Redis, bucket: string): RedisStore {
  const store = new RedisStore({
    prefix: redisKeys.rateLimit(bucket),
    // rate-limit-redis is client-agnostic and types replies loosely; ioredis
    // takes the command name and arguments as a flat list and returns
    // `unknown`, so the reply shape is asserted here.
    sendCommand: (...args: string[]) =>
      redis.call(...(args as [string, ...string[]])) as Promise<RedisReply>,
  });

  // RedisStore's constructor issues SCRIPT LOAD and stores the pending
  // promises without awaiting them. Limiters are built while route modules
  // load, so an unreachable Redis at boot rejects those promises with nothing
  // attached — which Node reports as an unhandled rejection and, under
  // --unhandled-rejections=throw, terminates the process before the app is
  // even listening. Marking them handled is enough: the store reloads the
  // script on its first failed increment.
  void Promise.allSettled([store.incrementScriptSha, store.getScriptSha]).then(
    ([increment, get]) => {
      const failure = [increment, get].find((r) => r.status === 'rejected');
      if (failure?.status === 'rejected') {
        logger.warn(
          `Rate-limit store could not preload its Redis scripts (bucket ${bucket}); it will retry on first use: ${
            failure.reason instanceof Error ? failure.reason.message : String(failure.reason)
          }`
        );
      }
    }
  );

  return store;
}

/** Per-user when authenticated, per-IP otherwise. */
export const userOrIpKey: Options['keyGenerator'] = (req) =>
  (req as { userId?: string }).userId ?? req.ip ?? 'anonymous';

/** Narrowed type for mounting a limiter with `app.use`. */
export type RateLimiter = RequestHandler;
