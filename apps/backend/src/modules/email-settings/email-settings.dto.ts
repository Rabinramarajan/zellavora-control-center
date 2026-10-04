/**
 * Validation and wire types for the system-wide email configuration.
 *
 * Secrets follow a three-state convention on update, because the client never
 * receives the stored value and so cannot echo it back:
 *   - omitted / undefined -> keep what is stored
 *   - non-empty string    -> replace with this value
 *   - empty string        -> clear the stored secret
 */
import { z } from 'zod';

export const EMAIL_PROVIDERS = ['console', 'smtp'] as const;
export type EmailProvider = (typeof EMAIL_PROVIDERS)[number];

/** Sentinel returned in place of a stored secret, so the UI can show "set". */
export const SECRET_PLACEHOLDER = '********';

const optionalSecret = z.string().max(512).optional();

export const EmailSettingsSchema = z
  .object({
    provider: z.enum(EMAIL_PROVIDERS),

    smtpHost: z.string().trim().min(1).max(255).optional(),
    smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
    smtpSecure: z.boolean().optional(),
    smtpUser: z.string().trim().max(255).optional(),
    smtpPassword: optionalSecret,

    fromEmail: z.string().trim().email().max(255).optional(),
    fromName: z.string().trim().max(255).optional(),
  })
  .superRefine((value, ctx) => {
    // A provider is only selectable once the fields it needs are present.
    // Validating here rather than at send time means a misconfiguration is
    // rejected by the form, not discovered when a password reset silently
    // fails for a user.
    if (value.provider === 'smtp') {
      if (!value.smtpHost) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['smtpHost'],
          message: 'SMTP host is required when the provider is smtp',
        });
      }
      if (!value.smtpPort) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['smtpPort'],
          message: 'SMTP port is required when the provider is smtp',
        });
      }
    }

    if (value.provider !== 'console' && !value.fromEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fromEmail'],
        message: 'A from address is required for this provider',
      });
    }
  });

export type EmailSettingsInput = z.infer<typeof EmailSettingsSchema>;

export const TestEmailSchema = z.object({
  to: z.string().trim().email().max(255),
});

export type TestEmailInput = z.infer<typeof TestEmailSchema>;

/** Shape returned to clients. Never carries decrypted secrets. */
export interface EmailSettingsView {
  provider: EmailProvider;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  /** SECRET_PLACEHOLDER when a password is stored, null when it is not. */
  smtpPassword: string | null;
  fromEmail: string | null;
  fromName: string | null;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  lastTestError: string | null;
  updatedAt: string | null;
  /** True when no row exists yet and values come from environment variables. */
  usingEnvFallback: boolean;
}

export interface EmailTestResult {
  success: boolean;
  messageId?: string;
  error?: string;
  testedAt: string;
}
