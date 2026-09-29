import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import Redis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'express';
import { config, configErrors } from './config/env';
import { errorHandler } from './middleware/error';
import { registerSwaggerRoutes } from './routes/swagger';
import { registerApiRoutes } from './routes';
import { responseEnvelope } from './middleware/response-envelope';
import { requestContext } from './middleware/request-context';
import crypto from 'crypto';
import os from 'os';
import { prisma } from './infrastructure/prisma';
import { buildRbac } from './rbac';
import { logger } from './infrastructure/logger';

const app = express();

// Behind a proxy/CDN (Vercel), the client IP arrives via X-Forwarded-For.
// Without `trust proxy`, express-rate-limit's validation rejects every auth
// request with ERR_ERL_UNEXPECTED_X_FORWARDED_FOR and req.ip stays the proxy.
app.set('trust proxy', config.trustProxy);

registerSwaggerRoutes(app);

// Serve static files (favicon, etc.) from public directory
app.use('/favicon.png', express.static('public'));

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(responseEnvelope);

app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  })
);

// Security headers with CSP for both Angular SPA and Swagger UI
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.jsdelivr.net',
          'https://cdnjs.cloudflare.com',
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.jsdelivr.net',
          'https://fonts.googleapis.com',
        ],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        upgradeInsecureRequests: null,
      },
    },
    hsts: config.nodeEnv === 'production' ? { maxAge: 15552000, includeSubDomains: true } : false,
  })
);

// Coarse global rate limit on the auth surface (brute-force / credential
// stuffing protection). Per-account + per-IP enforcement happens inside the
// login handler via RateLimitService.
app.use(
  '/api/v1/auth',
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.', code: 'RATE_LIMITED' },
  })
);

// Request context (AsyncLocalStorage) for the audit service — must run before
// the clean-module routes so @Audited decorators can resolve actor metadata.
app.use(requestContext);

/**
 * @swagger
 * /health:
 *   get:
 *     summary: checkServiceHealth
 *     operationId: getHealth
 *     tags: [system]
 *     security: []
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
// Health check. Reports configuration problems instead of crashing on them,
// so a misconfigured deployment is diagnosable rather than opaque.
app.get('/health', (_req, res) => {
  const healthy = configErrors.length === 0;
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
    ...(healthy ? {} : { configErrors }),
    ...(rbacFailure ? { rbac: { status: 'unavailable', reason: rbacFailure } } : {}),
  });
});

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     summary: getSystemMetrics
 *     operationId: getApiHealth
 *     tags: [system]
 *     security: []
 *     responses:
 *       200:
 *         description: Resource usage and dependency status for the admin System Health page
 */
type ServiceState = 'healthy' | 'degraded' | 'failed';

async function probeDatabase(): Promise<{ status: ServiceState; latencyMs: number; message?: string }> {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy', latencyMs: Date.now() - started };
  } catch (err) {
    return {
      status: 'failed',
      latencyMs: Date.now() - started,
      message: err instanceof Error ? err.message.trim().split('\n').pop() : 'Database unreachable',
    };
  }
}

app.get('/api/v1/health', async (_req, res) => {
  const totalRam = os.totalmem();
  const usedRam = totalRam - os.freemem();
  const cpuCount = os.cpus().length || 1;
  const load = Math.min(os.loadavg()[0], cpuCount);
  const database = await probeDatabase();
  const blobConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_OIDC_TOKEN);
  const redisState: ServiceState = !config.redisUrl ? 'failed' : rbacFailure ? 'degraded' : 'healthy';
  const gb = (bytes: number) => Math.round((bytes / 1024 ** 3) * 10) / 10;

  res.json({
    cpu: { used: Math.round(load * 10) / 10, total: cpuCount, percentage: Math.round((load / cpuCount) * 100) },
    ram: { used: gb(usedRam), total: gb(totalRam), percentage: Math.round((usedRam / totalRam) * 100) },
    database,
    storage: blobConfigured
      ? { status: 'healthy', latencyMs: 0 }
      : { status: 'failed', latencyMs: 0, message: 'BLOB_READ_WRITE_TOKEN is not set' },
    redis: {
      status: redisState,
      latencyMs: 0,
      ...(redisState === 'healthy' ? {} : { message: rbacFailure ?? 'REDIS_URL is not set' }),
    },
    queue: { pendingJobs: 0, activeWorkers: 0, status: redisState },
    timestamp: new Date().toISOString(),
  });
});

/**
 * @swagger
 * /:
 *   get:
 *     summary: openApiDocumentation
 *     operationId: getApiDocumentation
 *     tags: [system]
 *     security: []
 *     responses:
 *       302:
 *         description: Redirects to the API documentation
 */

/**
 * @swagger
 * /info:
 *   get:
 *     summary: getServiceInformation
 *     operationId: getInfo
 *     tags: [system]
 *     security: []
 *     responses:
 *       200:
 *         description: Service descriptor
 */
// Service descriptor — the historical `/` payload, preserved at `/info`.
app.get('/info', (_req, res) => {
  res.json({
    service: 'Zellavora Control Center — Backend API',
    version: '1.0.0',
    status: configErrors.length === 0 ? 'ok' : 'degraded',
    environment: config.nodeEnv,
    endpoints: {
      health: '/health',
      api: `/api/${config.apiVersion}`,
    },
  });
});

// Compatibility route for PRIMS Member Portal token format
app.get('/api/memberportal/api/MemberPortalLogin/gettoken', (_req, res) => {
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);
  res.json([key.toString('binary'), iv.toString('binary')]);
});

registerApiRoutes(app);

// ---------- RBAC module ----------
// The RBAC router is mounted SYNCHRONOUSLY below, before the 404 handler.
// Express matches middleware in registration order, so a router added later
// from an async callback sits behind the catch-all 404 and is unreachable.
// Initialisation itself stays async and is deferred to the first request:
// on a serverless platform, connecting to Redis during module evaluation
// blocks (and can time out) every cold start, including requests that never
// touch RBAC.

type RbacHandle = Awaited<ReturnType<typeof buildRbac>>;

let rbacPromise: Promise<RbacHandle | null> | null = null;

type RbacFailureReason =
  'SUPABASE_NOT_CONFIGURED' | 'REDIS_URL_MISSING' | 'REDIS_CONNECT_FAILED' | 'RBAC_INIT_FAILED';

// Kept so the 503 and /health can say WHY RBAC is down; without it every
// failure mode collapses into the same opaque response.
let rbacFailure: RbacFailureReason | null = null;

class RbacInitError extends Error {
  public constructor(
    public readonly reason: RbacFailureReason,
    cause?: unknown
  ) {
    super(cause instanceof Error ? cause.message : reason);
  }
}

async function createRbac(): Promise<RbacHandle> {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new RbacInitError('SUPABASE_NOT_CONFIGURED');
  }
  if (!config.redisUrl) {
    throw new RbacInitError('REDIS_URL_MISSING');
  }

  const db = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const redis = new Redis(config.redisUrl, {
    lazyConnect: true,
    // Serverless: fail fast instead of retrying past the function timeout.
    maxRetriesPerRequest: 2,
    connectTimeout: 5000,
    enableOfflineQueue: false,
  });

  // Attach the error listener BEFORE connecting so Node never sees an
  // unhandled 'error' event from ioredis while it retries the connection.
  redis.on('error', (err: Error) => {
    logger.warn(`RBAC redis error: ${err.message}`);
  });

  try {
    await redis.connect();
  } catch (connectErr) {
    redis.disconnect(); // stop background retries
    throw new RbacInitError('REDIS_CONNECT_FAILED', connectErr);
  }

  let rbac: RbacHandle;
  try {
    rbac = await buildRbac({ db, redis });
  } catch (initErr) {
    redis.disconnect();
    throw new RbacInitError('RBAC_INIT_FAILED', initErr);
  }

  // Make services reachable from request middleware (req.app.locals.*)
  app.locals.engine = rbac.engine;
  app.locals.audit = rbac.audit;
  app.locals.roleService = rbac.roleService;
  app.locals.userRoleService = rbac.userRoleService;

  return rbac;
}

/** Resolves once per instance; a failed attempt is retried on the next request. */
function getRbac(): Promise<RbacHandle | null> {
  if (!rbacPromise) {
    rbacPromise = createRbac()
      .then((rbac) => {
        rbacFailure = null;
        return rbac;
      })
      .catch((err: unknown) => {
        rbacPromise = null; // allow a later request to retry
        rbacFailure = err instanceof RbacInitError ? err.reason : 'RBAC_INIT_FAILED';
        logger.error(
          `RBAC initialisation failed (${rbacFailure}): ${err instanceof Error ? err.message : String(err)}`
        );
        return null;
      });
  }
  return rbacPromise;
}

const rbacGateway: RequestHandler = (req, res, next) => {
  getRbac()
    .then((rbac) => {
      if (!rbac) {
        res.status(503).json({
          error: 'RBAC module unavailable',
          code: 'RBAC_UNAVAILABLE',
          reason: rbacFailure,
        });
        return;
      }
      rbac.router(req, res, next);
    })
    .catch(next);
};

app.use('/api/v1/rbac', rbacGateway);

// 404 handler — must stay after every route registration above.
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use(errorHandler);

export default app;
