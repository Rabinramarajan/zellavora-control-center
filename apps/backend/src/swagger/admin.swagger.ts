import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import { existsSync } from 'fs';

function resolveModuleRoot(): string | null {
  const here = __dirname;
  const candidates = [
    path.resolve(here, '..', 'modules', 'admin'),
    path.resolve(process.cwd(), 'src', 'modules', 'admin'),
    path.resolve(process.cwd(), 'dist', 'src', 'modules', 'admin'),
  ];
  return candidates.find((c) => existsSync(c)) ?? null;
}

const definition: swaggerJsdoc.Options['definition'] = {
  openapi: '3.0.3',
  info: {
    title: 'Zellavora Admin API',
    version: '1.0.0',
    description: `
## Zellavora Admin API

Internal administration API served at \`/api/admin\`.

### Authentication
All endpoints require an admin-level Bearer JWT:
\`Authorization: Bearer <token>\`

Access is enforced by the \`adminAuthGuard\` middleware.
    `,
    contact: { name: 'Zellavora Engineering', email: 'engineering@zellavora.com' },
    license: { name: 'MIT' },
  },
  servers: [
    { url: '/api/admin', description: 'Current host' },
    { url: 'http://localhost:3001/api/admin', description: 'Local development' },
    { url: 'https://admin-api.zellavora.com/api/admin', description: 'Production Admin' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Admin-level JWT token',
      },
    },
  },
  security: [{ BearerAuth: [] }],
};

function buildAdminSpec(): object {
  const root = resolveModuleRoot();
  if (!root) {
    console.warn('[swagger/admin] Admin module root not found; serving base definition only');
    return definition as object;
  }

  const dir = root.replace(/\\/g, '/');
  const apis = [`${dir}/**/*.ts`, `${dir}/**/*.js`];

  try {
    const spec = swaggerJsdoc({ definition, apis }) as { paths?: Record<string, unknown> };
    const pathCount = Object.keys(spec.paths ?? {}).length;
    console.log(`[swagger/admin] Built spec with ${pathCount} paths`);
    return spec;
  } catch (err) {
    console.warn('[swagger/admin] JSDoc scan failed:', (err as Error).message);
    return { ...definition, paths: {} };
  }
}

export const adminSpec = buildAdminSpec();
