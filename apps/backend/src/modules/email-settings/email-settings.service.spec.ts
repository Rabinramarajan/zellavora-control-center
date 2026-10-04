const repo = {
  find: jest.fn(),
  upsert: jest.fn(),
  recordTestResult: jest.fn(),
};
jest.mock('./email-settings.repository', () => ({
  EmailSettingsRepository: jest.fn().mockImplementation(() => repo),
  SYSTEM_SCOPE: 'SYSTEM',
}));

const sendEmail = jest.fn();
jest.mock('../../services/email.service', () => ({ emailService: { sendEmail } }));

const invalidateEmailConfigCache = jest.fn();
const resolveEmailConfig = jest.fn();
jest.mock('../../services/email-config', () => ({
  invalidateEmailConfigCache: () => invalidateEmailConfigCache(),
  resolveEmailConfig: () => resolveEmailConfig(),
}));

import { EmailSettingsService } from './email-settings.service';
import { SECRET_PLACEHOLDER, EmailSettingsSchema } from './email-settings.dto';
import { EncryptionService } from '../../services/auth/encryption.service';

const baseRow = {
  id: 'row-1',
  scope: 'SYSTEM',
  provider: 'smtp',
  smtpHost: 'smtp.example.com',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: 'mailer',
  smtpPassword: EncryptionService.encrypt('s3cret'),
  fromEmail: 'noreply@example.com',
  fromName: 'ZCC',
  lastTestedAt: null,
  lastTestStatus: null,
  lastTestError: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  updatedBy: null,
};

describe('EmailSettingsService', () => {
  let service: EmailSettingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmailSettingsService();
    resolveEmailConfig.mockResolvedValue({
      provider: 'smtp',
      smtpHost: 'smtp.example.com',
      smtpPort: 587,
    });
  });

  describe('get', () => {
    it('masks the stored password instead of returning it', async () => {
      repo.find.mockResolvedValue(baseRow);

      const view = await service.get();

      expect(view.smtpPassword).toBe(SECRET_PLACEHOLDER);
      expect(JSON.stringify(view)).not.toContain('s3cret');
      expect(view.usingEnvFallback).toBe(false);
    });

    it('falls back to environment values when no row exists', async () => {
      repo.find.mockResolvedValue(null);

      const view = await service.get();

      expect(view.usingEnvFallback).toBe(true);
    });
  });

  describe('update', () => {
    const input = EmailSettingsSchema.parse({
      provider: 'smtp',
      smtpHost: 'smtp.example.com',
      smtpPort: 587,
      fromEmail: 'noreply@example.com',
    });

    it('keeps the stored secret when the password is omitted', async () => {
      repo.find.mockResolvedValue(baseRow);
      repo.upsert.mockResolvedValue(baseRow);

      await service.update(input, 'user-1');

      expect(repo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ smtpPassword: baseRow.smtpPassword })
      );
    });

    it('keeps the stored secret when the masked placeholder is echoed back', async () => {
      repo.find.mockResolvedValue(baseRow);
      repo.upsert.mockResolvedValue(baseRow);

      await service.update({ ...input, smtpPassword: SECRET_PLACEHOLDER }, 'user-1');

      expect(repo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ smtpPassword: baseRow.smtpPassword })
      );
    });

    it('clears the secret when an empty string is sent', async () => {
      repo.find.mockResolvedValue(baseRow);
      repo.upsert.mockResolvedValue({ ...baseRow, smtpPassword: null });

      await service.update({ ...input, smtpPassword: '' }, 'user-1');

      expect(repo.upsert).toHaveBeenCalledWith(expect.objectContaining({ smtpPassword: null }));
    });

    it('encrypts a new secret rather than storing it in plaintext', async () => {
      repo.find.mockResolvedValue(baseRow);
      repo.upsert.mockResolvedValue(baseRow);

      await service.update({ ...input, smtpPassword: 'brand-new' }, 'user-1');

      const stored = repo.upsert.mock.calls[0][0].smtpPassword as string;
      expect(stored).not.toBe('brand-new');
      expect(EncryptionService.decrypt(stored)).toBe('brand-new');
    });

    it('invalidates the resolver cache so the next send sees new credentials', async () => {
      repo.find.mockResolvedValue(baseRow);
      repo.upsert.mockResolvedValue(baseRow);

      await service.update(input, 'user-1');

      expect(invalidateEmailConfigCache).toHaveBeenCalled();
    });
  });

  describe('sendTest', () => {
    it('records a successful test', async () => {
      sendEmail.mockResolvedValue({ success: true, messageId: 'abc' });
      repo.recordTestResult.mockResolvedValue(baseRow);

      const result = await service.sendTest('ops@example.com', 'user-1');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('abc');
      expect(repo.recordTestResult).toHaveBeenCalledWith({ status: 'SUCCESS', error: null });
    });

    it('records the provider error when the send fails', async () => {
      sendEmail.mockResolvedValue({ success: false, error: 'Invalid login' });
      repo.recordTestResult.mockResolvedValue(baseRow);

      const result = await service.sendTest('ops@example.com', 'user-1');

      expect(result.success).toBe(false);
      expect(repo.recordTestResult).toHaveBeenCalledWith({
        status: 'FAILED',
        error: 'Invalid login',
      });
    });
  });
});

describe('EmailSettingsSchema', () => {
  it('requires a host and port when the provider is smtp', () => {
    const result = EmailSettingsSchema.safeParse({ provider: 'smtp' });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toEqual(expect.arrayContaining(['smtpHost', 'smtpPort']));
    }
  });

  it('requires a from address for any real provider', () => {
    const result = EmailSettingsSchema.safeParse({
      provider: 'smtp',
      smtpHost: 'smtp.example.com',
      smtpPort: 587,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path.join('.'))).toContain('fromEmail');
    }
  });

  it('rejects a provider that is no longer supported', () => {
    expect(EmailSettingsSchema.safeParse({ provider: 'sendgrid' }).success).toBe(false);
  });

  it('accepts the console provider with no transport configured', () => {
    expect(EmailSettingsSchema.safeParse({ provider: 'console' }).success).toBe(true);
  });

  it('rejects an out-of-range port', () => {
    const result = EmailSettingsSchema.safeParse({
      provider: 'smtp',
      smtpHost: 'smtp.example.com',
      smtpPort: 99999,
      fromEmail: 'a@b.com',
    });

    expect(result.success).toBe(false);
  });
});
