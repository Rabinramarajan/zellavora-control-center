import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Zellavora Control Center — API',
      version: '1.0.0',
      description: `
## Zellavora Control Center Backend API

Enterprise-grade multi-tenant REST API powering the ZCC platform.

### Authentication
Most endpoints require a **Bearer JWT** token obtained via \`POST /api/v1/auth/login\`.
Pass it as: \`Authorization: Bearer <token>\`

### Rate Limiting
Login endpoints are rate-limited per IP and per email to protect against brute-force attacks.

### Versioning
All endpoints are prefixed with \`/api/v1\`.
      `,
      contact: {
        name: 'Zellavora Engineering',
        email: 'engineering@zellavora.com',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: '/',
        description: 'Current host (Default)',
      },
      {
        url: 'http://localhost:3001',
        description: 'Local development server',
      },
      {
        url: 'https://zcc-backend.vercel.app',
        description: 'Vercel Deployment server',
      },
      {
        url: 'https://api.zellavora.com',
        description: 'Production server',
      },
    ],
    tags: [
      { name: 'health', description: 'serverHealthCheck' },
      { name: 'auth', description: 'authenticationAndSessionManagement' },
      { name: 'projects', description: 'portfolioProjectCRUD' },
      { name: 'gallery', description: 'projectGalleryImages' },
      { name: 'technologies', description: 'technologyCatalogAndProjectAssociations' },
      { name: 'portfolio', description: 'profileSkillsExperienceEducationServicesTestimonials' },
      { name: 'rbac', description: 'roleBasedAccessControlRolesPermissionsUserAssignments' },
      { name: 'notifications', description: 'multiChannelNotificationSystem' },
      { name: 'workflows', description: 'automationWorkflowDefinitionsAndExecutions' },
      { name: 'licensing', description: 'licensePlansUsageTrackingAndFeatureEntitlements' },
      { name: 'menus', description: 'dynamicNavigationMenuManagement' },
      { name: 'permissions', description: 'fineGrainedPermissionManagementAndAuditLogs' },
      { name: 'userSearch', description: 'userSearchOperations' },
      { name: 'userDetail', description: 'userDetailOperations' },
      { name: 'userRequest', description: 'userRequestOperations' },
      { name: 'groupSearch', description: 'groupSearchOperations' },
      { name: 'groupDetail', description: 'groupDetailOperations' },
      { name: 'roleSearch', description: 'roleSearchOperations' },
      { name: 'roleDetail', description: 'roleDetailOperations' },
      { name: 'resource', description: 'resourceOperations' },
      { name: 'commonConfigurationSearch', description: 'commonConfigurationSearch' },
      { name: 'commonConfigurationDetail', description: 'commonConfigurationDetail' },
      { name: 'message', description: 'message' },
      { name: 'emailCommunication', description: 'emailCommunication' },
      { name: 'audit', description: 'auditLogSearchAndDetails' },
      { name: 'login', description: 'login' },
      { name: 'resetPassword', description: 'resetPassword' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token issued by POST /api/v1/auth/login',
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'Internal service API key (for background jobs)',
        },
      },
      schemas: {
        // ── Generic ──────────────────────────────────────────────
        OkResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean', example: true },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Something went wrong' },
            code: { type: 'string', example: 'INVALID_CREDENTIALS' },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            pageSize: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 100 },
          },
        },
        // ── Auth ─────────────────────────────────────────────────
        Tenant: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Acme Corp' },
            clientCode: { type: 'string', example: 'acme' },
            logoUrl: { type: 'string', nullable: true },
            plan: { type: 'string', example: 'enterprise' },
            enforce2fa: { type: 'boolean' },
            allowedDomains: { type: 'array', items: { type: 'string' } },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            fullName: { type: 'string', example: 'Jane Doe' },
            avatarUrl: { type: 'string', nullable: true },
            role: { type: 'string', example: 'admin' },
            mfaEnabled: { type: 'boolean' },
            mfaEnrolledAt: { type: 'string', format: 'date-time', nullable: true },
            lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        TokenPair: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            expiresIn: { type: 'integer', example: 900 },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            mfaRequired: { type: 'boolean', example: false },
            user: { $ref: '#/components/schemas/User' },
            tenant: { $ref: '#/components/schemas/Tenant' },
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            expiresIn: { type: 'integer' },
          },
        },
        MfaChallengeResponse: {
          type: 'object',
          properties: {
            mfaRequired: { type: 'boolean', example: true },
            mfaToken: { type: 'string', format: 'uuid' },
            mfaMethods: {
              type: 'array',
              items: { type: 'string', enum: ['totp', 'recovery_code'] },
            },
          },
        },
        // ── Projects ─────────────────────────────────────────────
        Project: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            title: { type: 'string', example: 'My Awesome Project' },
            slug: { type: 'string', example: 'my-awesome-project' },
            description: { type: 'string' },
            category: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['draft', 'published', 'archived'] },
            githubUrl: { type: 'string', nullable: true },
            liveDemoUrl: { type: 'string', nullable: true },
            websiteUrl: { type: 'string', nullable: true },
            published_at: { type: 'string', format: 'date-time', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        CreateProjectBody: {
          type: 'object',
          required: ['title', 'slug', 'description'],
          properties: {
            title: { type: 'string', minLength: 1 },
            slug: { type: 'string', minLength: 1 },
            description: { type: 'string', minLength: 1 },
            category: { type: 'string' },
            githubUrl: { type: 'string' },
            liveDemoUrl: { type: 'string' },
            websiteUrl: { type: 'string' },
          },
        },
        // ── Gallery ──────────────────────────────────────────────
        GalleryItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            project_id: { type: 'string', format: 'uuid' },
            media_url: { type: 'string' },
            caption: { type: 'string', nullable: true },
            order_index: { type: 'integer' },
          },
        },
        // ── Technology ───────────────────────────────────────────
        Technology: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'TypeScript' },
            icon: { type: 'string', nullable: true },
            color: { type: 'string', nullable: true },
          },
        },
        // ── Portfolio ────────────────────────────────────────────
        Profile: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            bio: { type: 'string', nullable: true },
            headline: { type: 'string', nullable: true },
            location: { type: 'string', nullable: true },
            website: { type: 'string', nullable: true },
            github: { type: 'string', nullable: true },
            linkedin: { type: 'string', nullable: true },
            twitter: { type: 'string', nullable: true },
          },
        },
        Skill: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            level: { type: 'integer', minimum: 0, maximum: 100 },
            category: { type: 'string', nullable: true },
            order_index: { type: 'integer' },
          },
        },
        Experience: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            company: { type: 'string' },
            location: { type: 'string', nullable: true },
            start_date: { type: 'string', format: 'date' },
            end_date: { type: 'string', format: 'date', nullable: true },
            current: { type: 'boolean' },
            description: { type: 'string', nullable: true },
            order_index: { type: 'integer' },
          },
        },
        Education: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            institution: { type: 'string' },
            degree: { type: 'string' },
            field: { type: 'string', nullable: true },
            start_date: { type: 'string', format: 'date' },
            end_date: { type: 'string', format: 'date', nullable: true },
            order_index: { type: 'integer' },
          },
        },
        ServiceItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string', nullable: true },
            icon: { type: 'string', nullable: true },
            price: { type: 'number', nullable: true },
            order_index: { type: 'integer' },
          },
        },
        Testimonial: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            author_name: { type: 'string' },
            author_title: { type: 'string', nullable: true },
            author_avatar: { type: 'string', nullable: true },
            content: { type: 'string' },
            rating: { type: 'integer', minimum: 1, maximum: 5, nullable: true },
            order_index: { type: 'integer' },
          },
        },
        // ── RBAC ─────────────────────────────────────────────────
        Role: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            key: { type: 'string', example: 'content_editor' },
            label: { type: 'string', example: 'Content Editor' },
            description: { type: 'string', nullable: true },
            level: { type: 'integer' },
            color: { type: 'string', nullable: true },
            is_system: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        CreateRoleBody: {
          type: 'object',
          required: ['key', 'label'],
          properties: {
            key: { type: 'string', pattern: '^[a-z0-9_]{3,50}$' },
            label: { type: 'string', maxLength: 200 },
            description: { type: 'string', maxLength: 2000 },
            level: { type: 'integer', minimum: 0, maximum: 100, default: 0 },
            color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
            inheritsFrom: { type: 'array', items: { type: 'string', format: 'uuid' } },
            permissions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  effect: { type: 'string', enum: ['allow', 'deny'], default: 'allow' },
                },
              },
            },
          },
        },
        Permission: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            key: { type: 'string', example: 'content:write' },
            label: { type: 'string' },
            group_id: { type: 'string', format: 'uuid', nullable: true },
            type: { type: 'string', nullable: true },
          },
        },
        PermissionGroup: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
          },
        },
        UserRoleAssignment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            role_id: { type: 'string', format: 'uuid' },
            organization_id: { type: 'string', format: 'uuid' },
            resource_type: { type: 'string', nullable: true },
            resource_id: { type: 'string', nullable: true },
            valid_until: { type: 'string', format: 'date-time', nullable: true },
            assigned_at: { type: 'string', format: 'date-time' },
          },
        },
        PolicyResult: {
          type: 'object',
          properties: {
            userId: { type: 'string', format: 'uuid' },
            tenantId: { type: 'string', format: 'uuid' },
            version: { type: 'integer' },
            permissions: { type: 'array', items: { type: 'string' } },
            roles: { type: 'array', items: { type: 'string' } },
          },
        },
        AuditLog: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            actor_id: { type: 'string', format: 'uuid', nullable: true },
            action: { type: 'string' },
            organization_id: { type: 'string', format: 'uuid' },
            severity: { type: 'string', enum: ['info', 'warn', 'critical'] },
            ip_address: { type: 'string', nullable: true },
            user_agent: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        // ── Notifications ────────────────────────────────────────
        Notification: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            organization_id: { type: 'string', format: 'uuid' },
            recipient_id: { type: 'string', format: 'uuid', nullable: true },
            title: { type: 'string', nullable: true },
            body: { type: 'string' },
            channels: {
              type: 'array',
              items: { type: 'string', enum: ['email', 'sms', 'whatsapp', 'push', 'in_app'] },
            },
            status: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        // ── Workflows ────────────────────────────────────────────
        Workflow: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            organization_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            trigger_type: { type: 'string' },
            enabled: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        WorkflowExecution: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            workflow_id: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['pending', 'running', 'completed', 'failed'] },
            started_at: { type: 'string', format: 'date-time', nullable: true },
            completed_at: { type: 'string', format: 'date-time', nullable: true },
            error_message: { type: 'string', nullable: true },
          },
        },
        // ── Menu ─────────────────────────────────────────────────
        MenuItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            key: { type: 'string' },
            label: { type: 'string' },
            icon: { type: 'string', nullable: true },
            route: { type: 'string', nullable: true },
            externalUrl: { type: 'string', nullable: true },
            parentId: { type: 'string', format: 'uuid', nullable: true },
            orderIndex: { type: 'integer' },
            category: { type: 'string', nullable: true },
            visible: { type: 'boolean' },
            children: { type: 'array', items: { type: 'object' } },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
  },
  // Globs are resolved relative to THIS file, never process.cwd(). On a
  // serverless platform cwd is the task root and the source tree may not be
  // part of the bundle, so a cwd-based glob silently matches nothing.
  apis: (() => {
    const configDir = __dirname;
    // In development (tsx), __dirname is src/config; in production (compiled), it's dist/src/config
    const isProduction = configDir.includes('dist');
    const scanDir = isProduction
      ? path.resolve(configDir, '..').replace(/\\/g, '/') // dist/src
      : path.resolve(configDir, '..').replace(/\\/g, '/'); // src
    return [`${scanDir}/**/*.ts`, `${scanDir}/**/*.js`];
  })(),
};

/**
 * The JSDoc scan walks the source tree, which may be absent or read-only in a
 * deployed bundle. A failure here must degrade to a spec built from the static
 * `definition` above rather than crash the function during cold start.
 */
function buildSpec(): object {
  if (process.env.VERCEL) {
    console.log(
      '[swagger] Running on Vercel, serving base definition to prevent cold-start filesystem scanning'
    );
    return options.definition as object;
  }
  try {
    return swaggerJsdoc(options) as object;
  } catch (err) {
    console.warn(
      '[swagger] JSDoc scan failed, serving base definition only:',
      (err as Error).message
    );
    return { ...options.definition, paths: {} };
  }
}

export const swaggerSpec = buildSpec();
