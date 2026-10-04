import { AppError } from '../../middleware/error';
import { dateRange } from '../../infrastructure/search/search';
import { AuditService } from '../../infrastructure/audit';
import { logger } from '../../infrastructure/logger';
import { emailService } from '../../services/email.service';
import { CommunicationsRepository } from './communications.repository';
import { Audience, HistoryQuery, SendEmailDto, SendMessageDto } from './communications.dto';

const MAX_RECIPIENTS = 1000;
const EMAIL_CONCURRENCY = 5;
const MESSAGE_ACTION = 'communication.message_sent';
const EMAIL_ACTION = 'communication.email_sent';

const escapeHtml = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );

/** Admin-authored text is sent as escaped HTML paragraphs, never as raw markup. */
const toHtml = (body: string): string =>
  body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');

const describeAudience = (audience: Audience) =>
  audience.type === 'all' ? { type: 'all' } : { type: audience.type, count: audience.ids.length };

/**
 * Admin communications: in-app messages (notification rows) and email.
 * Each send is recorded once in the audit log, which doubles as the send history.
 */
export class CommunicationsService {
  constructor(private readonly repo = new CommunicationsRepository()) {}

  async sendMessage(organizationId: string, dto: SendMessageDto, actorId: string) {
    const recipients = await this.recipients(organizationId, dto.audience);
    const sentAt = new Date();
    await this.repo.createNotifications(
      recipients.map((r) => ({
        organizationId,
        recipientId: r.id,
        title: dto.title,
        body: dto.body,
        type: dto.type,
        channels: ['in_app'],
        status: 'sent',
        sentAt,
      }))
    );
    await AuditService.log({
      organizationId,
      actorId,
      action: MESSAGE_ACTION,
      resource: 'communication',
      metadata: {
        title: dto.title,
        type: dto.type,
        audience: describeAudience(dto.audience),
        recipients: recipients.length,
        delivered: recipients.length,
        failed: 0,
      },
    });
    return { recipients: recipients.length, delivered: recipients.length, failed: 0 };
  }

  async sendEmail(organizationId: string, dto: SendEmailDto, actorId: string) {
    const recipients = await this.recipients(organizationId, dto.audience);
    const html = toHtml(dto.body);
    const results: Array<{ id: string; ok: boolean }> = [];

    // One message per recipient so addresses are never exposed to each other.
    for (let i = 0; i < recipients.length; i += EMAIL_CONCURRENCY) {
      const batch = recipients.slice(i, i + EMAIL_CONCURRENCY);
      const sent = await Promise.all(
        batch.map(async (r) => {
          const res = await emailService
            .sendEmail({ to: r.email, subject: dto.subject, text: dto.body, html })
            .catch((e: Error) => ({ success: false, error: e.message }));
          if (!res.success) logger.warn(`[communications] email to ${r.id} failed: ${res.error}`);
          return { id: r.id, ok: res.success };
        })
      );
      results.push(...sent);
    }

    const sentAt = new Date();
    await this.repo.createNotifications(
      results.map((r) => ({
        organizationId,
        recipientId: r.id,
        title: dto.subject,
        body: dto.body,
        type: 'info',
        channels: ['email'],
        status: r.ok ? 'sent' : 'failed',
        sentAt: r.ok ? sentAt : null,
      }))
    );

    const delivered = results.filter((r) => r.ok).length;
    const summary = { recipients: results.length, delivered, failed: results.length - delivered };
    await AuditService.log({
      organizationId,
      actorId,
      action: EMAIL_ACTION,
      resource: 'communication',
      severity: summary.failed ? 'warning' : 'info',
      metadata: { subject: dto.subject, audience: describeAudience(dto.audience), ...summary },
    });
    return summary;
  }

  async history(organizationId: string, query: HistoryQuery) {
    const action = query.channel === 'email' ? EMAIL_ACTION : MESSAGE_ACTION;
    const { data, total } = await this.repo.history(
      organizationId,
      {
        action,
        subject: query.subject,
        sentAt: dateRange(query.sentFrom, query.sentTo),
        order: query.order,
      },
      query.page,
      query.pageSize
    );
    return {
      data: data.map((row) => {
        const m = (row.metadata ?? {}) as Record<string, unknown>;
        return {
          id: row.id,
          subject: String(m.subject ?? m.title ?? ''),
          type: (m.type as string | undefined) ?? null,
          audience: m.audience ?? null,
          recipients: Number(m.recipients ?? 0),
          delivered: Number(m.delivered ?? 0),
          failed: Number(m.failed ?? 0),
          sentById: row.actor?.id ?? null,
          sentByName: row.actor?.fullName ?? null,
          sentAt: row.createdAt.toISOString(),
        };
      }),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  private async recipients(organizationId: string, audience: Audience) {
    const recipients = await this.repo.resolveRecipients(organizationId, audience, MAX_RECIPIENTS);
    if (!recipients.length) {
      throw new AppError('No active members match the selected audience.', 400, 'NO_RECIPIENTS');
    }
    if (recipients.length > MAX_RECIPIENTS) {
      throw new AppError(
        `An audience can have at most ${MAX_RECIPIENTS} recipients.`,
        400,
        'TOO_MANY_RECIPIENTS'
      );
    }
    return recipients;
  }
}
