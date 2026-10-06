import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import { existsSync } from 'fs';

/**
 * Sub-modules mounted by admin.routes.ts.
 * Mirror this list whenever admin.routes.ts gains or loses a router.
 */
const ADMIN_MODULE_DIRS = [
  'modules/auth',
  'modules/operations',
  'modules/audit',
  'modules/dashboard',
  'modules/analytics',
  'modules/resources',
  'modules/roles',
  'modules/menu-access',
  'modules/groups',
  'modules/users',
  'modules/user-requests',
  'modules/permission',
  'modules/departments',
  'modules/teams',
  'modules/sessions',
  'modules/security-policy',
  'modules/configuration',
  'modules/communications',
  'modules/invitation',
  'modules/organization',
  'modules/branch',
  'modules/settings',
  'modules/email-settings',
  'modules/registration-settings',
  'modules/approval-mode',
  'modules/invoices',
  'modules/cms',
  'modules/storage',
  'modules/ddl',
];

function resolveSrcRoot(): string | null {
  const here = __dirname;
  const candidates = [
    path.resolve(here, '..'),
    path.resolve(process.cwd(), 'src'),
    path.resolve(process.cwd(), 'dist', 'src'),
  ];
  return candidates.find((c) => existsSync(path.join(c, 'app.ts')) || existsSync(path.join(c, 'app.js'))) ?? null;
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
  const srcRoot = resolveSrcRoot();
  if (!srcRoot) {
    console.warn('[swagger/admin] Source root not found; serving base definition only');
    return definition as object;
  }

  const apis = ADMIN_MODULE_DIRS.flatMap((rel) => {
    const dir = path.join(srcRoot, rel).replace(/\\/g, '/');
    return [`${dir}/**/*.ts`, `${dir}/**/*.js`];
  });

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
