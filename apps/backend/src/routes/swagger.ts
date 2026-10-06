import type { Express } from 'express';
import { swaggerSpec } from '../config/swagger';
import { applicationSpec } from '../swagger/application.swagger';
import { adminSpec } from '../swagger/admin.swagger';

const SWAGGER_UI_CDN = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14';

function swaggerHtml(title: string, specUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="icon" href="/favicon.png" />
    <link rel="stylesheet" href="${SWAGGER_UI_CDN}/swagger-ui.css" />
    <style>
      html, body { margin: 0; padding: 0; }
      .swagger-ui .topbar-wrapper .logo { filter: invert(1); }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${SWAGGER_UI_CDN}/swagger-ui-bundle.js" crossorigin></script>
    <script src="${SWAGGER_UI_CDN}/swagger-ui-standalone-preset.js" crossorigin></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: '${specUrl}',
          dom_id: '#swagger-ui',
          deepLinking: true,
          tagsSorter: 'alpha',
          operationsSorter: 'alpha',
          displayOperationId: true,
          presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
          layout: 'StandaloneLayout',
        });
      };
    </script>
  </body>
</html>`;
}

export function registerSwaggerRoutes(app: Express): void {
  // Swagger UI assets are served from CDN — swagger-ui-dist reads files from
  // disk at request time, which Vercel's build tracer never bundles.

  // ── Per-domain spec JSON ───────────────────────────────────────────────────
  app.get('/swagger/app.json', (_req, res) => res.json(applicationSpec));
  app.get('/swagger/admin.json', (_req, res) => res.json(adminSpec));
  app.get(['/swagger/swagger.json', '/swagger.json'], (_req, res) => res.json(swaggerSpec));

  // ── Swagger UI — hostname-aware ────────────────────────────────────────────
  // api.zellavora.com      → Application API spec
  // admin-api.zellavora.com → Admin API spec
  // anything else (local / combined)  → full spec
  app.get(['/swagger', '/swagger/', '/swagger/index.html'], (req, res) => {
    const host = req.hostname ?? '';
    if (host.startsWith('admin-api.')) {
      res.type('html').send(swaggerHtml('Zellavora Admin API', '/swagger/admin.json'));
    } else if (host.startsWith('api.')) {
      res.type('html').send(swaggerHtml('Zellavora Application API', '/swagger/app.json'));
    } else {
      res.type('html').send(swaggerHtml('Zellavora Control Center API', '/swagger/swagger.json'));
    }
  });

  app.get('/', (_req, res) => res.redirect(302, '/swagger/index.html'));
}
