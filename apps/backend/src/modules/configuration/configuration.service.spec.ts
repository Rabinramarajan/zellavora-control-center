jest.mock('../../infrastructure/audit', () => ({ AuditService: { log: jest.fn() } }));
jest.mock('../../services/auth', () => ({
  EncryptionService: { encrypt: jest.fn((v: string) => `enc(${v})`) },
}));

import { AuditService } from '../../infrastructure/audit';
import { ConfigurationService } from './configuration.service';
import type { ConfigurationRepository } from './configuration.repository';

const ORG = 'org';
const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'cfg-1',
  organizationId: ORG,
  key: 'api.key',
  value: 'plain',
  category: null,
  isEncrypted: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeRepo = (existing: ReturnType<typeof row> | null = null) =>
  ({
    find: jest.fn(async () => existing),
    upsert: jest.fn(async (_org: string, key: string, data: Record<string, unknown>) => row({ key, ...data })),
    delete: jest.fn(),
  }) as unknown as jest.Mocked<ConfigurationRepository>;

describe('ConfigurationService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('encrypts secrets and never returns them', async () => {
    const repo = makeRepo();
    const saved = await new ConfigurationService(repo).upsert(
      ORG,
      { key: 'api.key', value: 's3cret', isEncrypted: true },
      'actor'
    );
    expect(repo.upsert).toHaveBeenCalledWith(ORG, 'api.key', expect.objectContaining({ value: 'enc(s3cret)' }));
    expect(saved.value).not.toContain('s3cret');
    expect(JSON.stringify((AuditService.log as jest.Mock).mock.calls)).not.toContain('s3cret');
  });

  it('keeps the stored secret when the value is omitted', async () => {
    const repo = makeRepo(row({ value: 'enc(old)', isEncrypted: true }));
    await new ConfigurationService(repo).upsert(ORG, { key: 'api.key', isEncrypted: true }, 'actor');
    expect(repo.upsert).toHaveBeenCalledWith(ORG, 'api.key', expect.objectContaining({ value: 'enc(old)' }));
  });

  it('requires a value for new entries and for decrypting a secret', async () => {
    await expect(
      new ConfigurationService(makeRepo()).upsert(ORG, { key: 'x.y', isEncrypted: false }, 'actor')
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      new ConfigurationService(makeRepo(row({ isEncrypted: true }))).upsert(
        ORG,
        { key: 'api.key', isEncrypted: false },
        'actor'
      )
    ).rejects.toMatchObject({ status: 400 });
  });

  it('404s when deleting a missing key', async () => {
    await expect(new ConfigurationService(makeRepo()).remove(ORG, 'nope', 'actor')).rejects.toMatchObject({
      status: 404,
    });
  });
});
