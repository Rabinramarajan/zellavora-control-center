import { logger } from '../../infrastructure/logger';
import { getRequestContext } from '../../infrastructure/request-context';
import { emailService } from '../../services/email.service';
import { UserAdminRepository } from './user-admin.repository';

export type UserEmailType =
  | 'INVITATION'
  | 'PASSWORD_RESET'
  | 'ACCOUNT_ACTIVATED'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_DEACTIVATED'
  | 'MFA_CHANGED'
  | 'ACCESS_CHANGED'
  | 'PASSWORD_CHANGE_REQUIRED';

interface Recipient {
  id: string;
  email: string;
  fullName: string;
}

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );

/**
 * Emails sent to a user by administrative actions. Every attempt is logged in
 * user_email_logs with its delivery outcome for the Email History tab; a failed
 * send never breaks the action that triggered it.
 */
export class UserAdminNotifier {
  constructor(private readonly repo = new UserAdminRepository()) {}

  async send(user: Recipient, type: UserEmailType, subject: string, body: string, trigger: string) {
    await this.track(user, type, subject, trigger, async () => {
      const text = `Hi ${user.fullName},\n\n${body}\n\nIf you did not expect this, contact your administrator.`;
      const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#111827">${text
        .split('\n\n')
        .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
        .join('')}</div>`;
      const result = await emailService.sendEmail({ to: user.email, subject, text, html });
      return result.success ? null : (result.error ?? 'Delivery failed');
    });
  }

  /**
   * Logs an email whose content is produced elsewhere (invitation, password reset
   * templates). `deliver` resolves to an error message, null on success, or
   * undefined when the mail was handed to the queue and its outcome is not known.
   */
  async track(
    user: Recipient,
    type: UserEmailType,
    subject: string,
    trigger: string,
    deliver: () => Promise<string | null | undefined>
  ) {
    const log = await this.repo.createEmailLog({
      userId: user.id,
      organizationId: getRequestContext().organizationId ?? null,
      type,
      recipient: user.email,
      subject,
      trigger,
    });
    let error: string | null | undefined;
    try {
      error = await deliver();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    if (error) logger.error(`[users] ${type} email to ${user.email} failed: ${error}`);
    await this.repo.updateEmailLog(log.id, {
      attempts: 1,
      deliveryStatus: error === undefined ? 'QUEUED' : error ? 'FAILED' : 'SENT',
      sentAt: error === null ? new Date() : null,
      lastError: error ?? null,
    });
  }
}
