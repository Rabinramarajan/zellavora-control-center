import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import { existsSync } from 'fs';

function resolveModuleRoot(): string | null {
  const here = __dirname;
  const candidates = [
    // dev (tsx): __dirname = src/swagger → src/modules/application
    path.resolve(here, '..', 'modules', 'application'),
    // compiled (tsc): __dirname = dist/src/swagger → dist/src/modules/application
    path.resolve(here, '..', 'modules', 'application'),
    // Vercel bundle: cwd/src/modules/application
    path.resolve(process.cwd(), 'src', 'modules', 'application'),
    path.resolve(process.cwd(), 'dist', 'src', 'modules', 'application'),
  ];
  return candidates.find((c) => existsSync(c)) ?? null;
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
  const root = resolveModuleRoot();
  if (!root) {
    console.warn('[swagger/app] Application module root not found; serving base definition only');
    return definition as object;
  }

  const dir = root.replace(/\\/g, '/');
  const apis = [`${dir}/**/*.ts`, `${dir}/**/*.js`];

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
