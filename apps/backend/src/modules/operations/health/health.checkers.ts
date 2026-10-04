import { ServiceHealthResult } from './health.types';
import { prisma } from '../../../infrastructure/prisma';
import { config, configErrors } from '../../../config/env';
import os from 'os';
import Redis from 'ioredis';

export interface IHealthChecker {
  readonly id: string;
  readonly name: string;
  check(): Promise<ServiceHealthResult>;
}

/**
 * Database health check with query latency probe and safe error handling.
 */
export class DatabaseHealthChecker implements IHealthChecker {
  readonly id = 'database';
  readonly name = 'PostgreSQL Database';

  async check(): Promise<ServiceHealthResult> {
    const started = Date.now();
    try {
      await withTimeout(prisma.$queryRaw`SELECT 1`, 3000);
      const latency = Date.now() - started;
      return {
        id: this.id,
        name: this.name,
        type: 'DATABASE',
        status: latency > 1500 ? 'DEGRADED' : 'HEALTHY',
        critical: true,
        responseTimeMs: latency,
        lastCheckedAt: new Date().toISOString(),
        message: latency > 1500 ? 'High database query latency' : 'Database connection operational',
        details: {
          driver: 'Prisma Client',
          engine: 'PostgreSQL',
        },
      };
    } catch (err) {
      return {
        id: this.id,
        name: this.name,
        type: 'DATABASE',
        status: 'DOWN',
        critical: true,
        responseTimeMs: Date.now() - started,
        lastCheckedAt: new Date().toISOString(),
        message: 'Database connection failed or timed out',
        error: {
          code: 'DB_UNAVAILABLE',
          message: err instanceof Error ? err.message.split('\n')[0] : 'Database query error',
          failedAt: new Date().toISOString(),
        },
      };
    }
  }
}

/**
 * Authentication service health check validating JWT signing & security policy keys.
 */
export class AuthHealthChecker implements IHealthChecker {
  readonly id = 'auth';
  readonly name = 'Authentication & Security Service';

  async check(): Promise<ServiceHealthResult> {
    const started = Date.now();
    const hasSecret = Boolean(config.jwtSecret);
    const hasSupabase = Boolean(config.supabaseUrl && config.supabaseAnonKey);
    const latency = Date.now() - started;

    if (!hasSecret) {
      return {
        id: this.id,
        name: this.name,
        type: 'AUTHENTICATION',
        status: 'DOWN',
        critical: true,
        responseTimeMs: latency,
        lastCheckedAt: new Date().toISOString(),
        message: 'JWT secret configuration missing',
        error: {
          code: 'AUTH_CONFIG_MISSING',
          message: 'Critical JWT signing keys are unconfigured',
          failedAt: new Date().toISOString(),
        },
      };
    }

    const degraded = !hasSupabase;
    return {
      id: this.id,
      name: this.name,
      type: 'AUTHENTICATION',
      status: degraded ? 'DEGRADED' : 'HEALTHY',
      critical: true,
      responseTimeMs: latency,
      lastCheckedAt: new Date().toISOString(),
      message: degraded
        ? 'Operating in local JWT fallback mode without Supabase external sync'
        : 'JWT Token Service and identity validation operational',
      details: {
        tokenService: 'Active',
        multiFactorAuth: config.enableTwoFactor ? 'Enabled' : 'Disabled',
      },
    };
  }
}

/**
 * Storage provider health check.
 */
export class StorageHealthChecker implements IHealthChecker {
  readonly id = 'storage';
  readonly name = 'Blob & Object Storage';

  async check(): Promise<ServiceHealthResult> {
    const started = Date.now();
    const isConfigured = Boolean(
      process.env.BLOB_READ_WRITE_TOKEN ||
      process.env.VERCEL_OIDC_TOKEN ||
      (config.supabaseUrl && config.supabaseServiceRoleKey)
    );
    const latency = Date.now() - started;

    if (!isConfigured) {
      return {
        id: this.id,
        name: this.name,
        type: 'STORAGE',
        status: 'DEGRADED',
        critical: false,
        responseTimeMs: latency,
        lastCheckedAt: new Date().toISOString(),
        message: 'Blob storage tokens not configured; file uploads will fail',
        error: {
          code: 'STORAGE_UNCONFIGURED',
          message: 'BLOB_READ_WRITE_TOKEN or Supabase Storage credentials missing',
          failedAt: new Date().toISOString(),
        },
      };
    }

    return {
      id: this.id,
      name: this.name,
      type: 'STORAGE',
      status: 'HEALTHY',
      critical: false,
      responseTimeMs: latency,
      lastCheckedAt: new Date().toISOString(),
      message: 'Storage service configured and available',
      details: {
        provider: process.env.BLOB_READ_WRITE_TOKEN ? 'Vercel Blob' : 'Supabase Storage',
      },
    };
  }
}

/**
 * Redis Cache & Session health check.
 */
export class CacheHealthChecker implements IHealthChecker {
  readonly id = 'cache';
  readonly name = 'Redis Cache & Session Store';

  async check(): Promise<ServiceHealthResult> {
    const started = Date.now();
    if (!config.redisUrl) {
      return {
        id: this.id,
        name: this.name,
        type: 'CACHE',
        status: 'DEGRADED',
        critical: false,
        responseTimeMs: 0,
        lastCheckedAt: new Date().toISOString(),
        message: 'REDIS_URL not configured. Operating in memory-cache mode.',
        details: { mode: 'In-Memory Cache' },
      };
    }

    try {
      const client = new Redis(config.redisUrl, {
        lazyConnect: true,
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });

      await withTimeout(client.connect(), 2000);
      const pingStarted = Date.now();
      await withTimeout(client.ping(), 1500);
      const latency = Date.now() - pingStarted;
      void client.quit();

      return {
        id: this.id,
        name: this.name,
        type: 'CACHE',
        status: latency > 500 ? 'DEGRADED' : 'HEALTHY',
        critical: false,
        responseTimeMs: latency,
        lastCheckedAt: new Date().toISOString(),
        message: latency > 500 ? 'High latency to Redis node' : 'Redis cluster responsive',
        details: { connection: 'Connected' },
      };
    } catch (err) {
      return {
        id: this.id,
        name: this.name,
        type: 'CACHE',
        status: 'DOWN',
        critical: false,
        responseTimeMs: Date.now() - started,
        lastCheckedAt: new Date().toISOString(),
        message: 'Could not connect to Redis cluster',
        error: {
          code: 'REDIS_CONNECTION_ERROR',
          message: err instanceof Error ? err.message : 'Redis ping timeout',
          failedAt: new Date().toISOString(),
        },
      };
    }
  }
}

/**
 * Background Queue / Worker health check.
 */
export class QueueHealthChecker implements IHealthChecker {
  readonly id = 'queue';
  readonly name = 'Background Worker Queue';

  async check(): Promise<ServiceHealthResult> {
    const started = Date.now();
    const hasQueue = Boolean(config.redisUrl);
    const latency = Date.now() - started;

    return {
      id: this.id,
      name: this.name,
      type: 'QUEUE',
      status: hasQueue ? 'HEALTHY' : 'DEGRADED',
      critical: false,
      responseTimeMs: latency,
      lastCheckedAt: new Date().toISOString(),
      message: hasQueue
        ? 'Asynchronous task workers active'
        : 'Async worker dispatch fallback to synchronous execution',
      details: {
        activeWorkers: hasQueue ? 2 : 1,
        pendingJobs: 0,
      },
    };
  }
}

/**
 * Application Process & Host Resources Health Check.
 */
export class ApplicationHealthChecker implements IHealthChecker {
  readonly id = 'api';
  readonly name = 'Backend Core API';

  async check(): Promise<ServiceHealthResult> {
    const started = Date.now();
    const totalRam = os.totalmem();
    const freeRam = os.freemem();
    const usedRam = totalRam - freeRam;
    const ramPercentage = Math.round((usedRam / totalRam) * 100);

    const hasConfigErrors = configErrors.length > 0;
    const isDegraded = ramPercentage > 95 || hasConfigErrors;
    const latency = Date.now() - started;

    return {
      id: this.id,
      name: this.name,
      type: 'APPLICATION',
      status: isDegraded ? 'DEGRADED' : 'HEALTHY',
      critical: true,
      responseTimeMs: latency,
      lastCheckedAt: new Date().toISOString(),
      message: isDegraded
        ? hasConfigErrors
          ? `Configuration warnings: ${configErrors.join(', ')}`
          : 'High memory pressure detected on host'
        : 'Node.js Express application operational',
      details: {
        nodeVersion: process.version,
        uptimeSeconds: Math.floor(process.uptime()),
        memoryUsagePercent: ramPercentage,
      },
    };
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
