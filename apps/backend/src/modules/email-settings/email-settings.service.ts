/**
 * System-wide email configuration: read, update, and test.
 *
 * Secrets are encrypted with EncryptionService before they reach the database
 * and are never returned to a client — reads emit a placeholder so the UI can
 * distinguish "a password is set" from "no password", without the value ever
 * crossing the wire.
 */
import type { EmailSetting } from '@prisma/client';
import { config } from '../../config/env';
import { logger } from '../../infrastructure/logger';
import { emailService } from '../../services/email.service';
import { EncryptionService } from '../../services/auth/encryption.service';
import { invalidateEmailConfigCache, resolveEmailConfig } from '../../services/email-config';
import { EmailSettingsRepository } from './email-settings.repository';
import {
  SECRET_PLACEHOLDER,
  type EmailProvider,
  type EmailSettingsInput,
  type EmailSettingsView,
  type EmailTestResult,
} from './email-settings.dto';

export class EmailSettingsService {
  private readonly repository = new EmailSettingsRepository();

  /**
   * Current configuration for the admin UI. When no row exists the environment
   * values are surfaced with `usingEnvFallback`, so the form shows what is
   * actually in effect rather than an empty state that implies email is unset.
   */
  public async get(): Promise<EmailSettingsView> {
    const row = await this.repository.find();

    if (!row) {
      return {
        provider: config.emailProvider,
        smtpHost: config.smtpHost || null,
        smtpPort: config.smtpPort ?? null,
        smtpSecure: config.smtpPort === 465,
        smtpUser: config.smtpUser || null,
        smtpPassword: config.smtpPassword ? SECRET_PLACEHOLDER : null,
        fromEmail: config.smtpFromEmail || null,
        fromName: config.smtpFromName || null,
        lastTestedAt: null,
        lastTestStatus: null,
        lastTestError: null,
        updatedAt: null,
        usingEnvFallback: true,
      };
    }

    return this.toView(row);
  }

  public async update(
    input: EmailSettingsInput,
    actorId: string | null
  ): Promise<EmailSettingsView> {
    const existing = await this.repository.find();

    const row = await this.repository.upsert({
      provider: input.provider,
      smtpHost: input.smtpHost ?? null,
      smtpPort: input.smtpPort ?? null,
      smtpSecure: input.smtpSecure ?? input.smtpPort === 465,
      smtpUser: input.smtpUser ?? null,
      smtpPassword: this.nextSecret(input.smtpPassword, existing?.smtpPassword ?? null),
      fromEmail: input.fromEmail ?? null,
      fromName: input.fromName ?? null,
      updatedBy: actorId,
    });

    // Must happen before returning: the next send has to see the new values,
    // and the admin will almost always hit "send test" immediately after.
    invalidateEmailConfigCache();
    logger.info(`[EmailSettings] Updated by ${actorId ?? 'system'}; provider=${input.provider}`);

    return this.toView(row);
  }

  /**
   * Sends a real message through the saved configuration and records the
   * outcome. Verifying the transport is not enough — credentials can pass the
   * handshake and still be rejected at RCPT TO.
   */
  public async sendTest(to: string, actorId: string | null): Promise<EmailTestResult> {
    const cfg = await resolveEmailConfig();
    const testedAt = new Date().toISOString();

    const result = await emailService.sendEmail({
      to,
      subject: 'Zellavora Control Center — test email',
      text: [
        'This is a test message from Zellavora Control Center.',
        '',
        `Provider: ${cfg.provider}`,
        cfg.provider === 'smtp' ? `Host: ${cfg.smtpHost}:${cfg.smtpPort}` : '',
        `Sent at: ${testedAt}`,
        '',
        'If you received this, outbound email is configured correctly.',
      ]
        .filter(Boolean)
        .join('\n'),
      html: `
        <div style="font-family:system-ui,sans-serif;line-height:1.5">
          <h2 style="margin:0 0 12px">Test email</h2>
          <p>This is a test message from Zellavora Control Center.</p>
          <ul>
            <li><strong>Provider:</strong> ${cfg.provider}</li>
            ${cfg.provider === 'smtp' ? `<li><strong>Host:</strong> ${cfg.smtpHost}:${cfg.smtpPort}</li>` : ''}
            <li><strong>Sent at:</strong> ${testedAt}</li>
          </ul>
          <p>If you received this, outbound email is configured correctly.</p>
        </div>
      `,
    });

    await this.repository.recordTestResult({
      status: result.success ? 'SUCCESS' : 'FAILED',
      error: result.success ? null : (result.error ?? 'Unknown error'),
    });

    logger.info(
      `[EmailSettings] Test email to ${to} by ${actorId ?? 'system'}: ${
        result.success ? 'SUCCESS' : `FAILED (${result.error})`
      }`
    );

    return {
      success: result.success,
      messageId: result.messageId,
      error: result.error,
      testedAt,
    };
  }

  /**
   * Applies the three-state secret convention: undefined keeps the stored
   * ciphertext, an empty string clears it, anything else replaces it. Without
   * this, a form that round-trips the masked placeholder would overwrite the
   * real secret with asterisks.
   */
  private nextSecret(incoming: string | undefined, stored: string | null): string | null {
    if (incoming === undefined) return stored;
    if (incoming === '') return null;
    if (incoming === SECRET_PLACEHOLDER) return stored;
    return EncryptionService.encrypt(incoming);
  }

  private toView(row: EmailSetting): EmailSettingsView {
    return {
      provider: (row.provider as EmailProvider) ?? 'console',
      smtpHost: row.smtpHost,
      smtpPort: row.smtpPort,
      smtpSecure: row.smtpSecure,
      smtpUser: row.smtpUser,
      smtpPassword: row.smtpPassword ? SECRET_PLACEHOLDER : null,
      fromEmail: row.fromEmail,
      fromName: row.fromName,
      lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
      lastTestStatus: row.lastTestStatus,
      lastTestError: row.lastTestError,
      updatedAt: row.updatedAt?.toISOString() ?? null,
      usingEnvFallback: false,
    };
  }
}
