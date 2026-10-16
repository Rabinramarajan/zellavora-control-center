import { getQueueMetrics } from './infrastructure/queue';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, configErrors } from './config/env';
import { errorHandler } from './middleware/error';
import { registerSwaggerRoutes } from './routes/swagger';
import { registerApiRoutes } from './routes';
import { responseEnvelope } from './middleware/response-envelope';
import { createRateLimiter } from './middleware/rate-limit';
import { requestContext } from './middleware/request-context';
import { loginDecryptMiddleware } from './middleware/login-decrypt';
import os from 'os';
import { prisma } from './infrastructure/prisma';
import { getRedis } from './infrastructure/redis';
import { authenticate, requirePermission } from './middleware/auth';

const app = express();

// Behind a proxy/CDN (Vercel), the client IP arrives via X-Forwarded-For.
// Without `trust proxy`, express-rate-limit's validation rejects every auth
// request with ERR_ERL_UNEXPECTED_X_FORWARDED_FOR and req.ip stays the proxy.
app.set('trust proxy', config.trustProxy);

registerSwaggerRoutes(app);

// Serve static files (favicon, etc.) from public directory
app.use('/favicon.png', express.static('public'));

// Middleware
// Bodies are parsed before auth runs, so the global cap stays small. Only the media
// upload route raises it, under Vercel's 4.5 MB request cap.
const smallJson = express.json({ limit: '1mb' });
const isMediaUpload = (method: string, path: string) =>
  method === 'POST' &&
  (/\/storage\/media\/?$/.test(path) || /\/pm\/tasks\/[^/]+\/attachments\/?$/.test(path));
app.use((req, res, next) =>
  isMediaUpload(req.method, req.path) ? next() : smallJson(req, res, next)
);
app.use(express.urlencoded({ limit: '1mb', extended: true }));

app.use(responseEnvelope);

app.use(loginDecryptMiddleware);

app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
    // Downloads name themselves from this header, which cross-origin reads cannot see otherwise.
    exposedHeaders: ['Content-Disposition'],
  })
);

// Strict helmet defaults for the API. The relaxed policy Swagger UI needs is applied
// only under /swagger (see routes/swagger.ts).
app.use(
  helmet({
    contentSecurityPolicy: { useDefaults: true, directives: { upgradeInsecureRequests: null } },
    hsts: config.nodeEnv === 'production' ? { maxAge: 15552000, includeSubDomains: true } : false,
  })
);

// Coarse global rate limit on the auth surface (brute-force / credential
// stuffing protection). Per-account + per-IP enforcement happens inside the
// login handler via RateLimitService.
app.use(
  '/api/v1/auth',
  createRateLimiter({
    bucket: 'auth-surface',
    windowMs: 60 * 1000,
    limit: 120,
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
// Health check. Reports only whether the deployment is configured; the cause is in the
// boot logs and, for operators, at /api/v1/operations/health.
app.get('/health', (_req, res) => {
  const healthy = configErrors.length === 0;
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
  });
});

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     summary: getSystemMetrics
 *     operationId: getApiHealth
 *     tags: [system]
 *     description: Requires the operations system-health permission.
 *     responses:
 *       200:
 *         description: Resource usage and dependency status for the admin System Health page
 */
type ServiceState = 'healthy' | 'degraded' | 'failed';

async function probeDatabase(): Promise<{
  status: ServiceState;
  latencyMs: number;
  message?: string;
}> {
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

app.get(
  '/api/v1/health',
  authenticate,
  requirePermission('OPERATIONS_SYSTEM_HEALTH_VIEW', 'system:rbac:read', 'system:audit:read'),
  async (_req, res) => {
    const totalRam = os.totalmem();
    const usedRam = totalRam - os.freemem();
    const cpuCount = os.cpus().length || 1;
    const load = Math.min(os.loadavg()[0], cpuCount);
    const database = await probeDatabase();
    const queue = await getQueueMetrics().catch(() => ({
      mode: 'inline' as const,
      pendingJobs: 0,
      failedJobs: 0,
      activeWorkers: 0,
    }));
    const blobConfigured = Boolean(
      process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_OIDC_TOKEN
    );
    const redisState: ServiceState = !config.redisUrl
      ? 'failed'
      : getRedis()?.status === 'ready'
        ? 'healthy'
        : 'degraded';
    const gb = (bytes: number) => Math.round((bytes / 1024 ** 3) * 10) / 10;

    res.json({
      cpu: {
        used: Math.round(load * 10) / 10,
        total: cpuCount,
        percentage: Math.round((load / cpuCount) * 100),
      },
      ram: {
        used: gb(usedRam),
        total: gb(totalRam),
        percentage: Math.round((usedRam / totalRam) * 100),
      },
      database,
      storage: blobConfigured
        ? { status: 'healthy', latencyMs: 0 }
        : { status: 'failed', latencyMs: 0, message: 'BLOB_READ_WRITE_TOKEN is not set' },
      redis: {
        status: redisState,
        latencyMs: 0,
        ...(redisState === 'healthy'
          ? {}
          : { message: config.redisUrl ? 'Redis is not connected' : 'REDIS_URL is not set' }),
      },
      queue: { ...queue, status: queue.mode === 'inline' ? 'degraded' : redisState },
      timestamp: new Date().toISOString(),
    });
  }
);

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

registerApiRoutes(app);

// 404 handler — must stay after every route registration above.
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use(errorHandler);

export default app;
