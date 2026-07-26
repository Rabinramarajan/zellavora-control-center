import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '@/config/swagger';

const router = Router();

/**
 * @swagger
 * /api-docs:
 *   get:
 *     summary: Swagger UI (interactive API explorer)
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Returns the Swagger UI HTML page
 */

// Serve the raw OpenAPI JSON spec
router.get('/api-docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Serve the interactive Swagger UI
router.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'ZCC API Docs',
    customCss: `
      .swagger-ui .topbar { background: linear-gradient(135deg, #1e1e2e 0%, #313244 100%); }
      .swagger-ui .topbar .download-url-wrapper { display: none; }
      .swagger-ui .info .title { color: #cba6f7; }
      .swagger-ui .scheme-container { background: #1e1e2e; box-shadow: none; padding: 16px; }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
      defaultModelsExpandDepth: 1,
      defaultModelExpandDepth: 2,
      docExpansion: 'list',
      tagsSorter: 'alpha',
    },
  })
);

export default router;
