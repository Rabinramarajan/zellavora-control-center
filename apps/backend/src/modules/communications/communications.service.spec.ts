jest.mock('../../infrastructure/audit', () => ({ AuditService: { log: jest.fn() } }));
jest.mock('../../infrastructure/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));
jest.mock('../../services/email.service', () => ({ emailService: { sendEmail: jest.fn() } }));

import { emailService } from '../../services/email.service';
import { CommunicationsService } from './communications.service';
import type { CommunicationsRepository } from './communications.repository';

const ORG = 'org';
const users = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `u${i}`,
    email: `u${i}@corp.com`,
    fullName: `User ${i}`,
  }));

const makeRepo = (recipients = users(2)) =>
  ({
    resolveRecipients: jest.fn(async () => recipients),
    createNotifications: jest.fn(),
    history: jest.fn(),
  }) as unknown as jest.Mocked<CommunicationsRepository>;

const sendEmail = emailService.sendEmail as jest.Mock;

describe('CommunicationsService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects an audience with no active members', async () => {
    await expect(
      new CommunicationsService(makeRepo([])).sendMessage(
        ORG,
        { audience: { type: 'all' }, title: 'Hi', body: 'Hello', type: 'info' },
        'actor'
      )
    ).rejects.toMatchObject({ status: 400, code: 'NO_RECIPIENTS' });
  });

  it('rejects audiences over the recipient cap', async () => {
    await expect(
      new CommunicationsService(makeRepo(users(1001))).sendMessage(
        ORG,
        { audience: { type: 'all' }, title: 'Hi', body: 'Hello', type: 'info' },
        'actor'
      )
    ).rejects.toMatchObject({ code: 'TOO_MANY_RECIPIENTS' });
  });

  it('creates one in-app notification per recipient', async () => {
    const repo = makeRepo();
    const summary = await new CommunicationsService(repo).sendMessage(
      ORG,
      { audience: { type: 'all' }, title: 'Hi', body: 'Hello', type: 'warning' },
      'actor'
    );
    expect(summary).toEqual({ recipients: 2, delivered: 2, failed: 0 });
    expect(repo.createNotifications.mock.calls[0][0]).toHaveLength(2);
  });

  it('emails each recipient individually with escaped HTML and counts failures', async () => {
    sendEmail
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: 'bounce' });
    const repo = makeRepo();
    const summary = await new CommunicationsService(repo).sendEmail(
      ORG,
      { audience: { type: 'all' }, subject: 'Notice', body: '<script>x</script>\n\nSecond' },
      'actor'
    );

    expect(summary).toEqual({ recipients: 2, delivered: 1, failed: 1 });
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail.mock.calls.map((c) => c[0].to)).toEqual(['u0@corp.com', 'u1@corp.com']);
    const html: string = sendEmail.mock.calls[0][0].html;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html.match(/<p /g)).toHaveLength(2);
    const statuses = repo.createNotifications.mock.calls[0][0].map((n) => n.status);
    expect(statuses).toEqual(['sent', 'failed']);
  });
});
