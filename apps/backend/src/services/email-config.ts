/**
 * Resolves the effective outbound-email configuration.
 *
 * Precedence: the database row wins; environment variables are the fallback.
 * That ordering lets an operator change SMTP credentials through the admin UI
 * without a redeploy, while a fresh environment (local dev, CI, a first boot
 * before anyone opens the settings page) keeps working from .env as before.
 *
 * Lives apart from EmailService and EmailSettingsService so neither has to
 * import the other — the settings service writes and invalidates, the email
 * service reads.
 */
import { config } from '../config/env';
import { logger } from '../infrastructure/logger';
import { EmailSettingsRepository } from '../modules/email-settings/email-settings.repository';
import { EncryptionService } from './auth/encryption.service';
import type { EmailProvider } from '../modules/email-settings/email-settings.dto';

export interface ResolvedEmailConfig {
  provider: EmailProvider;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  fromEmail: string;
  fromName: string;
  /** True when no database row exists and these values came from the env. */
  usingEnvFallback: boolean;
}

/**
 * Short TTL rather than indefinite caching: every outbound email would
 * otherwise hit the database, but a stale window longer than this makes a
 * credential change feel broken to whoever just saved it. Explicit
 * invalidation on save covers the single-instance case; the TTL bounds how
 * long another instance can keep serving the old value.
 */
const CACHE_TTL_MS = 30_000;

const repository = new EmailSettingsRepository();

let cached: { value: ResolvedEmailConfig; expiresAt: number } | null = null;

function fromEnv(): ResolvedEmailConfig {
  return {
    provider: config.emailProvider,
    smtpHost: config.smtpHost,
    smtpPort: config.smtpPort,
    smtpSecure: config.smtpPort === 465,
    smtpUser: config.smtpUser,
    smtpPassword: config.smtpPassword,
    fromEmail: config.smtpFromEmail,
    fromName: config.smtpFromName,
    usingEnvFallback: true,
  };
}

/** Decrypts a stored secret, falling back to the env value if it is unreadable. */
function decryptOr(stored: string | null, envValue: string, label: string): string {
  if (!stored) return envValue;
  try {
    return EncryptionService.decrypt(stored);
  } catch (err) {
    // A rotated or missing ENCRYPTION_KEY makes stored secrets undecryptable.
    // Falling back is better than throwing inside a send: mail may still go
    // out via the env credentials, and the operator gets a clear log line.
    logger.error(
      `[EmailConfig] Could not decrypt ${label}; falling back to environment value: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    return envValue;
  }
}

export async function resolveEmailConfig(): Promise<ResolvedEmailConfig> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let value: ResolvedEmailConfig;
  try {
    const row = await repository.find();
    value = row
      ? {
          provider: (row.provider as EmailProvider) ?? 'console',
          smtpHost: row.smtpHost ?? config.smtpHost,
          smtpPort: row.smtpPort ?? config.smtpPort,
          smtpSecure: row.smtpSecure,
          smtpUser: row.smtpUser ?? config.smtpUser,
          smtpPassword: decryptOr(row.smtpPassword, config.smtpPassword, 'SMTP password'),
          fromEmail: row.fromEmail ?? config.smtpFromEmail,
          fromName: row.fromName ?? config.smtpFromName,
          usingEnvFallback: false,
        }
      : fromEnv();
  } catch (err) {
    // The database being unreachable must not make email configuration
    // resolution throw inside an unrelated request path.
    logger.error(
      `[EmailConfig] Could not read email settings; using environment values: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    value = fromEnv();
  }

  cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

/** Drops the cache so the next send re-reads. Call after any settings write. */
export function invalidateEmailConfigCache(): void {
  cached = null;
}
