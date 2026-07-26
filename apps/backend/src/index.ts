/**
 * Long-lived server entrypoint (Docker / local dev only).
 * The serverless deployment uses `api/index.ts` and must never load this file.
 */
import app from './app';
import { config, assertConfigValid } from './config/env';

// Unlike the serverless handler, a persistent server should refuse to start on
// an invalid configuration rather than serve degraded traffic.
assertConfigValid();

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   Zellavora Control Center - Backend   ║
╚════════════════════════════════════════╝

  Server running on port ${PORT}
  Environment: ${config.nodeEnv}
  API: http://localhost:${PORT}/api/v1

  Health Check:  http://localhost:${PORT}/health
  Swagger Docs:  http://localhost:${PORT}/api-docs
  `);
});
