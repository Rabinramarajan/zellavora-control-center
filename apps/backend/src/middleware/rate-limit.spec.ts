/**
 * Covers the two behaviours that matter operationally: counters land in Redis
 * under the zcc namespace when it is configured, and an unreachable store
 * lets traffic through instead of 500ing every throttled route.
 */
import type { Redis } from 'ioredis';

const getRedis = jest.fn<Redis | null, []>();
jest.mock('../infrastructure/redis', () => ({ getRedis: () => getRedis() }));

import express from 'express';
import type { Server } from 'http';
import { createRateLimiter } from './rate-limit';

/** Minimal ioredis stand-in: rate-limit-redis only needs `call`. */
function fakeRedis(behaviour: 'ok' | 'down'): { redis: Redis; commands: string[][] } {
  const commands: string[][] = [];
  const redis = {
    call: (...args: unknown[]) => {
      const command = args.map(String);
      commands.push(command);
      if (behaviour === 'down') return Promise.reject(new Error('ECONNREFUSED'));
      // The store loads its LUA scripts first and expects a SHA1 string back;
      // EVALSHA then returns [totalHits, resetTimeMs].
      if (command[0] === 'SCRIPT') return Promise.resolve('deadbeef');
      return Promise.resolve([1, Date.now() + 60_000]);
    },
  } as unknown as Redis;
  return { redis, commands };
}

async function withServer(
  limiter: express.RequestHandler,
  run: (baseUrl: string) => Promise<void>
): Promise<void> {
  const app = express();
  app.use('/probe', limiter, (_req, res) => void res.status(200).json({ ok: true }));

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('createRateLimiter', () => {
  afterEach(() => getRedis.mockReset());

  it('counts in-process when Redis is not configured', async () => {
    getRedis.mockReturnValue(null);
    const limiter = createRateLimiter({ bucket: 'test:memory', windowMs: 60_000, limit: 2 });

    await withServer(limiter, async (baseUrl) => {
      const statuses: number[] = [];
      for (let i = 0; i < 3; i += 1) {
        statuses.push((await fetch(`${baseUrl}/probe`)).status);
      }
      expect(statuses).toEqual([200, 200, 429]);
    });
  });

  it('returns the ZCC error envelope on a 429', async () => {
    getRedis.mockReturnValue(null);
    const limiter = createRateLimiter({ bucket: 'test:envelope', windowMs: 60_000, limit: 1 });

    await withServer(limiter, async (baseUrl) => {
      await fetch(`${baseUrl}/probe`);
      const blocked = await fetch(`${baseUrl}/probe`);

      expect(blocked.status).toBe(429);
      expect(await blocked.json()).toMatchObject({
        error: { code: 'RATE_LIMITED', status: 429, retryAfterSeconds: 60 },
      });
    });
  });

  it('writes counters to Redis under the bucket-scoped zcc prefix', async () => {
    const { redis, commands } = fakeRedis('ok');
    getRedis.mockReturnValue(redis);
    const limiter = createRateLimiter({ bucket: 'test:shared', windowMs: 60_000, limit: 5 });

    await withServer(limiter, async (baseUrl) => {
      expect((await fetch(`${baseUrl}/probe`)).status).toBe(200);
    });

    const touchedKeys = commands.flat().filter((arg) => arg.startsWith('zcc:'));
    expect(touchedKeys.length).toBeGreaterThan(0);
    for (const key of touchedKeys) {
      expect(key.startsWith('zcc:rate-limit:test:shared:')).toBe(true);
    }
  });

  it('passes requests through when the Redis store errors', async () => {
    const { redis } = fakeRedis('down');
    getRedis.mockReturnValue(redis);
    const limiter = createRateLimiter({ bucket: 'test:outage', windowMs: 60_000, limit: 1 });

    await withServer(limiter, async (baseUrl) => {
      expect((await fetch(`${baseUrl}/probe`)).status).toBe(200);
      expect((await fetch(`${baseUrl}/probe`)).status).toBe(200);
    });
  });

  it('keys per user when a keyGenerator is supplied', async () => {
    getRedis.mockReturnValue(null);
    const limiter = createRateLimiter({
      bucket: 'test:per-user',
      windowMs: 60_000,
      limit: 1,
      keyGenerator: (req) => String(req.headers['x-test-user'] ?? 'anonymous'),
    });

    await withServer(limiter, async (baseUrl) => {
      const call = (user: string): Promise<Response> =>
        fetch(`${baseUrl}/probe`, { headers: { 'x-test-user': user } });

      expect((await call('alice')).status).toBe(200);
      expect((await call('alice')).status).toBe(429);
      // A different identity has its own budget.
      expect((await call('bob')).status).toBe(200);
    });
  });
});
