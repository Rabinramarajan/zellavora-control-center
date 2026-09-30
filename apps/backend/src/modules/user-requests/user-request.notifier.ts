import { config } from '../../config/env';
import { logger } from '../../infrastructure/logger';
import { emailService } from '../../services/email.service';
import { UserRequestRepository } from './user-request.repository';
import { STATUS_LABELS, TYPE_LABELS, RequestStatus, RequestType } from './user-request.types';

export type EmailTemplate =
  | 'INVITATION'
  | 'SUBMITTED'
  | 'APPROVAL_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'SENT_BACK'
  | 'COMPLETED'
  | 'FAILED';

export interface DeliveryOutcome {
  ok: boolean;
  error?: string;
}

interface RequestRef {
  id: string;
  refNo: string;
  type: string;
  status: string;
  subjectName: string | null;
}

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );

const toHtml = (text: string) =>
  `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#111827">${text
    .split('\n\n')
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('')}</div>`;

/**
 * Sends workflow emails for a user request and records every attempt in
 * user_request_emails so the Email History tab reflects real delivery results.
 * Delivery failures never break the workflow; they surface as FAILED rows.
 */
export class UserRequestNotifier {
  constructor(private readonly repo: UserRequestRepository) {}

  async notify(
    request: RequestRef,
    template: Exclude<EmailTemplate, 'INVITATION'>,
    recipient: string | null | undefined,
    trigger: string,
    extra?: string | null
  ) {
    if (!recipient) return;
    const typeLabel = TYPE_LABELS[request.type as RequestType] ?? request.type;
    const statusLabel = STATUS_LABELS[request.status as RequestStatus] ?? request.status;
    const who = request.subjectName ? ` for ${request.subjectName}` : '';
    const link = `${config.appUrl}/iam/user-requests/${request.id}`;
    const subjects: Record<typeof template, string> = {
      SUBMITTED: `Request ${request.refNo} submitted`,
      APPROVAL_REQUIRED: `Approval required: ${request.refNo}`,
      APPROVED: `Request ${request.refNo} approved`,
      REJECTED: `Request ${request.refNo} rejected`,
      SENT_BACK: `Request ${request.refNo} sent back for changes`,
      COMPLETED: `Request ${request.refNo} completed`,
      FAILED: `Request ${request.refNo} provisioning failed`,
    };
    const body = [
      `${typeLabel} request ${request.refNo}${who} is now ${statusLabel}.`,
      extra ? `Comments:\n${extra}` : null,
      `View the request: ${link}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const row = await this.repo.createEmail({
      requestId: request.id,
      template,
      recipient,
      subject: subjects[template],
      bodyText: body,
      trigger,
    });
    await this.deliver(row.id, recipient, subjects[template], body, 0);
  }

  /** Records an invitation sent through InvitationService (which owns the token and template). */
  async recordInvitation(requestId: string, recipient: string, outcome: DeliveryOutcome) {
    await this.repo.createEmail({
      requestId,
      template: 'INVITATION',
      recipient,
      subject: 'You have been invited to Zellavora Control Center',
      bodyText: 'Account invitation with a single-use link to set a password.',
      trigger: 'Provisioning: account created',
      deliveryStatus: outcome.ok ? 'SENT' : 'FAILED',
      attempts: 1,
      sentAt: outcome.ok ? new Date() : null,
      lastError: outcome.ok ? null : (outcome.error ?? 'Delivery failed'),
    });
  }

  async resend(email: {
    id: string;
    recipient: string;
    subject: string;
    bodyText: string;
    attempts: number;
  }) {
    await this.deliver(email.id, email.recipient, email.subject, email.bodyText, email.attempts);
  }

  async markInvitationRetried(emailId: string, attempts: number, outcome: DeliveryOutcome) {
    await this.repo.updateEmail(emailId, {
      attempts: attempts + 1,
      deliveryStatus: outcome.ok ? 'SENT' : 'FAILED',
      sentAt: outcome.ok ? new Date() : undefined,
      lastError: outcome.ok ? null : (outcome.error ?? 'Delivery failed'),
    });
  }

  private async deliver(
    emailId: string,
    to: string,
    subject: string,
    text: string,
    attempts: number
  ) {
    try {
      const result = await emailService.sendEmail({ to, subject, text, html: toHtml(text) });
      await this.repo.updateEmail(emailId, {
        attempts: attempts + 1,
        deliveryStatus: result.success ? 'SENT' : 'FAILED',
        sentAt: result.success ? new Date() : undefined,
        lastError: result.success ? null : (result.error ?? 'Delivery failed'),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[user-requests] email ${emailId} failed: ${message}`);
      await this.repo.updateEmail(emailId, {
        attempts: attempts + 1,
        deliveryStatus: 'FAILED',
        lastError: message,
      });
    }
  }
}
