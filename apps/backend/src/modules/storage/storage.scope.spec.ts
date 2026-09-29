jest.mock('../../infrastructure/prisma', () => ({
  prisma: {
    commonConfiguration: { findUnique: jest.fn() },
    organization: { findUnique: jest.fn() },
  },
}));
import { prisma } from '../../infrastructure/prisma';
import { scopedPath, storageScope } from './storage.scope';

const tenantId = '9809684a-674b-4d13-a729-b2090a2d9924';
const envKey = `BLOB_READ_WRITE_TOKEN_${tenantId.replace(/-/g, '_').toUpperCase()}`;
const findSetting = prisma.commonConfiguration.findUnique as jest.Mock;
const scope = { prefix: `tenants/${tenantId}/` };

describe('company media isolation', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env[envKey];
  });
  afterAll(() => {
    delete process.env[envKey];
  });

  it('requires authenticated tenant context before querying storage settings', async () => {
    await expect(storageScope(undefined)).rejects.toMatchObject({ status: 401 });
    expect(findSetting).not.toHaveBeenCalled();
  });
  it('does not fall back to the shared store when a company connection is missing', async () => {
    findSetting.mockResolvedValue({ value: '{}' });
    await expect(storageScope(tenantId)).rejects.toMatchObject({
      code: 'TENANT_STORAGE_NOT_CONFIGURED',
    });
  });
  it('uses only the current tenant environment token and namespace', async () => {
    findSetting.mockResolvedValue({
      value: '{"prefix":"another-company/","tokenEnv":"OTHER_TOKEN"}',
    });
    process.env[envKey] = 'test-token';
    await expect(storageScope(tenantId)).resolves.toEqual({ ...scope, token: 'test-token' });
  });
  it('scopes the default store to the tenant too', async () => {
    findSetting.mockResolvedValue(null);
    await expect(storageScope(tenantId)).resolves.toEqual(scope);
  });
  it('preserves the original company library without granting access to tenant folders', async () => {
    findSetting.mockResolvedValue(null);
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
      clientCode: 'zellavora-inc',
    });
    const legacy = await storageScope(tenantId);
    expect(legacy.prefix).toBe('');
    expect(scopedPath(legacy, 'portfolio/photo.webp')).toBe('portfolio/photo.webp');
    expect(() => scopedPath(legacy, `${scope.prefix}photo.webp`)).toThrow();
  });
  it.each([
    'galaxy-sofas/logo/logo.webp',
    'tenants/another-company/photo.webp',
    `${scope.prefix}../photo.webp`,
    `${scope.prefix}%2e%2e/photo.webp`,
    `${scope.prefix}folder\\photo.webp`,
    'https://example.com/photo.webp',
  ])('rejects paths outside the company: %s', (pathname) => {
    expect(() => scopedPath(scope, pathname)).toThrow('outside this company');
  });
  it('accepts a file in the company namespace', () => {
    expect(scopedPath(scope, `${scope.prefix}products/sofa.webp`)).toBe(
      `${scope.prefix}products/sofa.webp`
    );
  });
});
