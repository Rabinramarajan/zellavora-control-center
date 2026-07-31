import dotenv from 'dotenv';
import path from 'path';

// On Vercel (and any managed platform) the environment is injected by the
// platform and there is no .env file in the bundle. Only load dotenv locally;
// `override: false` guarantees a real platform variable always wins.
if (!process.env.VERCEL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: false });
  dotenv.config({ override: false });
}

export const config = {
  // ============================================================================
  // Server
  // ============================================================================
  port: parseInt(process.env.PORT),
  nodeEnv: process.env.NODE_ENV || 'development',

  // ============================================================================
  // Supabase
  // ============================================================================
  supabaseUrl: process.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // ============================================================================
  // JWT & Authentication
  // ============================================================================
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'dev-refresh-secret',
  jwtExpiry: process.env.JWT_EXPIRY || '15m',
  refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',

  // Password & Security
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  sessionTimeoutMinutes: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '30', 10),
  passwordResetTokenExpiryMinutes: parseInt(
    process.env.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES || '15',
    10
  ),
  emailVerificationTokenExpiryHours: parseInt(
    process.env.EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS || '24',
    10
  ),

  // ============================================================================
  // Multi-Tenancy
  // ============================================================================
  enableMultitenancy: process.env.ENABLE_MULTITENANCY !== 'false',
  defaultTenantName: process.env.DEFAULT_TENANT_NAME || 'Default Organization',
  demoModeEnabled: process.env.DEMO_MODE === 'true',

  // ============================================================================
  // Email Service
  // ============================================================================
  emailProvider: (process.env.EMAIL_PROVIDER || 'console') as 'console' | 'smtp' | 'sendgrid',

  // SMTP Configuration
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER || '',
  smtpPassword: process.env.SMTP_PASSWORD || '',
  smtpFromEmail: process.env.SMTP_FROM_EMAIL || 'noreply@zellavora.com',
  smtpFromName: process.env.SMTP_FROM_NAME || 'Zellavora Control Center',

  // SendGrid Configuration
  sendgridApiKey: process.env.SENDGRID_API_KEY || '',
  sendgridFromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@zellavora.com',

  // ============================================================================
  // Encryption
  // ============================================================================
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  encryptionAlgorithm: 'aes-256-gcm',

  // ============================================================================
  // Rate Limiting
  // ============================================================================
  rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== 'false',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),

  // Login rate limiting: max 5 attempts per 15 minutes per IP
  loginRateLimitMaxAttempts: parseInt(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS || '5', 10),
  loginRateLimitWindowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || '900000', 10),

  // ============================================================================
  // API
  // ============================================================================
  apiUrl: process.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  apiVersion: process.env.API_VERSION || 'v1',
  corsOrigins: (process.env.VITE_CORS_ORIGINS || 'http://localhost:4200').split(','),

  // ============================================================================
  // Logging
  // ============================================================================
  logLevel: process.env.LOG_LEVEL || 'info',

  // ============================================================================
  // Storage
  // ============================================================================
  storageBucket: process.env.STORAGE_BUCKET || 'zcc-media',
  storageRegion: process.env.STORAGE_REGION || 'us-east-1',
  maxUploadSizeMb: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '50', 10),

  // ============================================================================
  // Audit Logging
  // ============================================================================
  auditLoggingEnabled: process.env.AUDIT_LOGGING_ENABLED !== 'false',
  auditLogRetentionDays: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '90', 10),

  // ============================================================================
  // Feature Flags
  // ============================================================================
  enableTwoFactor: process.env.ENABLE_TWO_FACTOR !== 'false',
  enableOAuth: process.env.ENABLE_OAUTH === 'true',
  enableSAML: process.env.ENABLE_SAML === 'true',
  enableApiKeys: process.env.ENABLE_API_KEYS !== 'false',
  ALLOW_SELF_REGISTRATION: process.env.ALLOW_SELF_REGISTRATION !== 'false',

  // ============================================================================
  // OAuth Providers
  // ============================================================================
  googleOAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
  googleOAuthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',

  githubOAuthClientId: process.env.GITHUB_OAUTH_CLIENT_ID || '',
  githubOAuthClientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET || '',

  // ============================================================================
  // Database
  // ============================================================================
  databaseUrl: process.env.DATABASE_URL || '',

  // ============================================================================
  // Cache (Redis)
  // ============================================================================
  redisEnabled: process.env.REDIS_ENABLED === 'true',
  redisUrl: process.env.REDIS_URL || undefined,
  redisTtlSeconds: parseInt(process.env.REDIS_TTL_SECONDS || '300', 10),

  // ============================================================================
  // Monitoring & Analytics
  // ============================================================================
  sentryDsn: process.env.SENTRY_DSN || '',
  enableMetrics: process.env.ENABLE_METRICS === 'true',
} as const;

// ============================================================================
// VALIDATION
// ============================================================================

// Required environment variables
const requiredEnvVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET',
  'REFRESH_TOKEN_SECRET',
];

// Additional required for production
const productionEnvVars = [
  'ENCRYPTION_KEY', // Must be provided in production
  'SMTP_HOST', // Or SendGrid configured
];

/**
 * Collects configuration problems without throwing.
 *
 * IMPORTANT: this module must never throw at import time. On a serverless
 * platform the whole module graph is evaluated during cold start, so an
 * import-time throw takes down the function before Express is ever built —
 * the platform then returns an opaque FUNCTION_INVOCATION_FAILED with no
 * usable stack trace. Instead we surface problems as a list that callers
 * decide what to do with, and expose a `/health` signal for operators.
 */
export function collectConfigErrors(): string[] {
  const errors: string[] = [];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`);
    }
  }

  if (config.nodeEnv !== 'production') return errors;

  for (const envVar of productionEnvVars) {
    if (!process.env[envVar]) {
      errors.push(`Missing production environment variable: ${envVar}`);
    }
  }

  if (config.emailProvider === 'smtp') {
    if (!config.smtpHost || !config.smtpUser || !config.smtpPassword) {
      errors.push('SMTP email provider requires SMTP_HOST, SMTP_USER, SMTP_PASSWORD');
    }
  } else if (config.emailProvider === 'sendgrid') {
    if (!config.sendgridApiKey) {
      errors.push('SendGrid email provider requires SENDGRID_API_KEY');
    }
  }

  if (!config.encryptionKey || config.encryptionKey.length < 32) {
    errors.push('Production requires ENCRYPTION_KEY with minimum 32 characters');
  }

  return errors;
}

/** Problems detected at boot. Empty array means the config is fully valid. */
export const configErrors = collectConfigErrors();

/**
 * Hard-fails the process. Call this ONLY from a long-lived server entrypoint
 * (src/index.ts, Docker), never from the serverless handler.
 */
export function assertConfigValid(): void {
  if (configErrors.length > 0) {
    throw new Error(`Invalid configuration:\n  - ${configErrors.join('\n  - ')}`);
  }
}

if (configErrors.length > 0) {
  console.error(
    `[config] ${configErrors.length} configuration problem(s) detected:\n  - ${configErrors.join('\n  - ')}`
  );
}

if (config.nodeEnv === 'development') {
  if (config.jwtSecret.includes('dev-secret')) {
    console.warn('⚠️  WARNING: Using development JWT secret. Change JWT_SECRET in production.');
  }
  if (!config.encryptionKey) {
    console.warn('⚠️  WARNING: No ENCRYPTION_KEY set. Sensitive data will not be encrypted.');
  }
}
