/** Mirrors the backend contract in modules/email-settings/email-settings.dto.ts. */

export const EMAIL_PROVIDERS = ['console', 'smtp'] as const;
export type EmailProvider = (typeof EMAIL_PROVIDERS)[number];

/** What the API returns in place of a stored secret. Never a real value. */
export const SECRET_PLACEHOLDER = '********';

export interface EmailSettings {
  provider: EmailProvider;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPassword: string | null;
  fromEmail: string | null;
  fromName: string | null;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  lastTestError: string | null;
  updatedAt: string | null;
  usingEnvFallback: boolean;
}

/**
 * Secrets are omitted when unchanged — the form never sends the placeholder
 * back, and an empty string is a deliberate "clear this value".
 */
export interface EmailSettingsPayload {
  provider: EmailProvider;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPassword?: string;
  fromEmail?: string;
  fromName?: string;
}

export interface EmailTestResult {
  success: boolean;
  messageId?: string;
  error?: string;
  testedAt: string;
}

export const PROVIDER_LABELS: Record<EmailProvider, string> = {
  console: 'Console (log only, no mail sent)',
  smtp: 'SMTP server',
};

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  provider: 'console',
  smtpHost: null,
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: null,
  smtpPassword: null,
  fromEmail: null,
  fromName: null,
  lastTestedAt: null,
  lastTestStatus: null,
  lastTestError: null,
  updatedAt: null,
  usingEnvFallback: true,
};
