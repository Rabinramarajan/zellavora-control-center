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
import { buildRbac } from './rbac';

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

async function createRbac(): Promise<RbacHandle | null> {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    return null;
  }
  if (!config.redisUrl) {
    return null;
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
  redis.on('error', () => {
    // Silently handle errors; logging handled elsewhere
  });

  try {
    await redis.connect();
  } catch (connectErr) {
    redis.disconnect(); // stop background retries
    throw connectErr;
  }

  const rbac = await buildRbac({ db, redis });

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
    rbacPromise = createRbac().catch(() => {
      rbacPromise = null; // allow a later request to retry
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
