import type { Express } from 'express';
import { swaggerSpec } from '../config/swagger';

export function registerSwaggerRoutes(app: Express): void {
  // Swagger UI (BEFORE any body parsing middleware).
  //
  // `swaggerUi.serve` cannot be used on Vercel: swagger-ui-dist's assets are
  // read from disk at request time, so the build tracer never bundles them and
  // every /swagger/*.js request falls through to the HTML 404 handler, which the
  // browser reports as "Unexpected token '<'". Serve the spec as JSON and load
  // the UI assets from a CDN instead.
  const SWAGGER_UI_CDN = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14';

  app.get(['/swagger/swagger.json', '/swagger.json'], (_req, res) => {
    res.json(swaggerSpec);
  });

  app.get(['/swagger', '/swagger/', '/swagger/index.html'], (_req, res) => {
    res.type('html').send(`<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Zellavora Control Center API</title>
      <link rel="stylesheet" href="${SWAGGER_UI_CDN}/swagger-ui.css" />
      <style>
        html, body {
          margin: 0;
          padding: 0;
        }
      </style>
    </head>
    <body>
      <div id="swagger-ui"></div>
      <script src="${SWAGGER_UI_CDN}/swagger-ui-bundle.js" crossorigin></script>
      <script src="${SWAGGER_UI_CDN}/swagger-ui-standalone-preset.js" crossorigin></script>
      <script>
        window.onload = () => {
          window.ui = SwaggerUIBundle({
            url: '/swagger/swagger.json',
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
  </html>`);
  });

  app.get('/', (_req, res) => {
    res.redirect(302, '/swagger/index.html');
  });
}
