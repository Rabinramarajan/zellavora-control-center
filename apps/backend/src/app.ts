import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import Redis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import { config } from './config/env';
import { errorHandler } from './middleware/error';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import portfolioRoutes from './routes/portfolio';
import galleryRoutes from './routes/gallery';
import techRoutes from './routes/technologies';
import swaggerRoutes from './routes/swagger.route';
import { buildRbac } from './rbac';

const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  })
);

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     tags: [Health]
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
// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Swagger UI — available unless SWAGGER_ENABLED is explicitly 'false'
if (process.env.SWAGGER_ENABLED !== 'false') {
  app.use(swaggerRoutes);
}

// Core routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', projectRoutes);
app.use('/api/v1', portfolioRoutes);
app.use('/api/v1', galleryRoutes);
app.use('/api/v1', techRoutes);

// ---------- RBAC module ----------
// Lazy init: if Supabase or Redis aren't configured, skip the module
// (allows the rest of the API to keep working in dev / partial setups).
async function initRbac() {
  try {
    if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
      console.warn('[rbac] Supabase not configured — RBAC module disabled.');
      return;
    }
    if (!config.redisUrl) {
      console.warn('[rbac] Redis not configured — RBAC module disabled.');
      return;
    }

    const db = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false }
    });

    const redis = new Redis(config.redisUrl, { lazyConnect: true });

    // Attach an error listener BEFORE connecting so Node.js never sees an
    // unhandled 'error' event from ioredis while it retries the connection.
    redis.on('error', (err) => {
      // Suppress noisy connection-refused events after a failed init.
      if (process.env.LOG_LEVEL === 'debug') {
        console.debug('[rbac/redis] connection error:', err.message);
      }
    });

    try {
      await redis.connect();
    } catch (connectErr) {
      // Disconnect so ioredis stops retrying in the background.
      redis.disconnect();
      throw connectErr;
    }

    const rbac = await buildRbac({ db, redis });

    // Make services reachable from request middleware (req.app.locals.*)
    app.locals.engine         = rbac.engine;
    app.locals.audit          = rbac.audit;
    app.locals.roleService    = rbac.roleService;
    app.locals.userRoleService = rbac.userRoleService;

    app.use('/api/v1/rbac', rbac.router);
    console.log('[rbac] Mounted at /api/v1/rbac');
  } catch (e) {
    console.warn('[rbac] Init failed (RBAC module disabled):', (e as Error).message);
  }
}

// Initialize RBAC asynchronously
initRbac();

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use(errorHandler);

export default app;
