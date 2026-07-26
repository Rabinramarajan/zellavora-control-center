import app from './app';
import { config } from './config/env';

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
