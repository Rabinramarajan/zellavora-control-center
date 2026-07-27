import { Router } from 'express';
import { swaggerSpec } from '../config/swagger';

const router = Router();

/**
 * Swagger UI is served as a self-contained HTML shell that pulls its assets
 * from a pinned CDN, rather than via `swagger-ui-express`'s `serve` handler.
 *
 * `swaggerUi.serve` is `express.static(swagger-ui-dist)`. Those files live in
 * node_modules and are resolved from disk at request time, so a bundler that
 * traces only the import graph (as @vercel/node does) never includes them.
 * express.static then matches nothing, the request falls through to setup(),
 * and every asset URL answers with the HTML page — the browser receives
 * text/html where it expects CSS/JS and renders a blank page.
 *
 * Serving our own shell removes the filesystem dependency entirely, which is
 * what makes this reliable on any serverless platform.
 */
const SWAGGER_UI_VERSION = '5.17.14';
const CDN = `https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}`;

const SWAGGER_OPTIONS = {
  url: '/api-docs.json',
  dom_id: '#swagger-ui',
  deepLinking: true,
  persistAuthorization: true,
  displayRequestDuration: true,
  filter: true,
  tryItOutEnabled: true,
  defaultModelsExpandDepth: 1,
  defaultModelExpandDepth: 2,
  docExpansion: 'list',
  tagsSorter: 'alpha',
};

const CUSTOM_CSS = `
  .swagger-ui .topbar { background: linear-gradient(135deg, #1e1e2e 0%, #313244 100%); }
  .swagger-ui .topbar .download-url-wrapper { display: none; }
  .swagger-ui .info .title { color: #cba6f7; }
  .swagger-ui .scheme-container { background: #1e1e2e; box-shadow: none; padding: 16px; }
  .swagger-ui .opblock-summary-path-description-wrapper { justify-content: flex-start !important; }
  .swagger-ui .opblock-summary-description { flex: 0 1 auto !important; text-align: left !important; margin-left: 12px !important; }
  .swagger-ui .opblock-summary-method { text-transform: lowercase !important; }
`;

const SWAGGER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ZCC API Docs</title>
  <link rel="stylesheet" href="${CDN}/swagger-ui.css" />
  <style>${CUSTOM_CSS}</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="${CDN}/swagger-ui-bundle.js" crossorigin></script>
  <script src="${CDN}/swagger-ui-standalone-preset.js" crossorigin></script>
  <script>
    window.onload = function () {
      window.ui = SwaggerUIBundle(Object.assign(
        ${JSON.stringify(SWAGGER_OPTIONS)},
        {
          presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
          plugins: [SwaggerUIBundle.plugins.DownloadUrl],
          layout: 'StandaloneLayout',
        }
      ));
    };
  </script>
</body>
</html>`;

/**
 * @swagger
 * /api-docs.json:
 *   get:
 *     summary: rawOpenAPI30Specification
 *     tags: [health]
 *     security: []
 *     responses:
 *       200:
 *         description: The OpenAPI document
 */
router.get('/api-docs.json', (_req, res) => {
  res.type('application/json').send(swaggerSpec);
});

/**
 * @swagger
 * /api-docs:
 *   get:
 *     summary: swaggerUIInteractiveAPIExplorer
 *     tags: [health]
 *     security: []
 *     responses:
 *       200:
 *         description: Returns the Swagger UI HTML page
 */
router.get(['/api-docs', '/api-docs/'], (_req, res) => {
  res.type('text/html').send(SWAGGER_HTML);
});

export default router;
