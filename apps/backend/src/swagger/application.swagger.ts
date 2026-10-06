import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import { existsSync } from 'fs';

/**
 * Sub-modules mounted by application.routes.ts.
 * Mirror this list whenever application.routes.ts gains or loses a router.
 */
const APPLICATION_MODULE_DIRS = [
  'modules/auth',
  'modules/themes',
  'modules/blog',
  'modules/notification',
  'modules/daily-sheets',
  'modules/monthly-sheets',
  'modules/timesheets',
  'routes', // projects, portfolio, gallery, technologies, settings legacy route files
];

function resolveSrcRoot(): string | null {
  const here = __dirname;
  const candidates = [
    path.resolve(here, '..'),                               // dev: src/swagger → src
    path.resolve(process.cwd(), 'src'),                     // Vercel bundle
    path.resolve(process.cwd(), 'dist', 'src'),
  ];
  return candidates.find((c) => existsSync(path.join(c, 'app.ts')) || existsSync(path.join(c, 'app.js'))) ?? null;
}

const definition: swaggerJsdoc.Options['definition'] = {
  openapi: '3.0.3',
  info: {
    title: 'Zellavora Application API',
    version: '1.0.0',
    description: `
## Zellavora Application API

End-user and member-facing REST API served at \`/api/app\`.

### Authentication
Pass a Bearer JWT obtained via \`POST /api/app/auth/login\`:
\`Authorization: Bearer <token>\`
    `,
    contact: { name: 'Zellavora Engineering', email: 'engineering@zellavora.com' },
    license: { name: 'MIT' },
  },
  servers: [
    { url: '/api/app', description: 'Current host' },
    { url: 'http://localhost:3001/api/app', description: 'Local development' },
    { url: 'https://api.zellavora.com/api/app', description: 'Production' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token issued by POST /api/app/auth/login',
      },
    },
  },
  security: [{ BearerAuth: [] }],
};

function buildApplicationSpec(): object {
  const srcRoot = resolveSrcRoot();
  if (!srcRoot) {
    console.warn('[swagger/app] Source root not found; serving base definition only');
    return definition as object;
  }

  const apis = APPLICATION_MODULE_DIRS.flatMap((rel) => {
    const dir = path.join(srcRoot, rel).replace(/\\/g, '/');
    return [`${dir}/**/*.ts`, `${dir}/**/*.js`];
  });

  try {
    const spec = swaggerJsdoc({ definition, apis }) as { paths?: Record<string, unknown> };
    const pathCount = Object.keys(spec.paths ?? {}).length;
    console.log(`[swagger/app] Built spec with ${pathCount} paths`);
    return spec;
  } catch (err) {
    console.warn('[swagger/app] JSDoc scan failed:', (err as Error).message);
    return { ...definition, paths: {} };
  }
}

export const applicationSpec = buildApplicationSpec();
