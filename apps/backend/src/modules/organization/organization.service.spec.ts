const repo = {
  findById: jest.fn(),
  findByClientCode: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};
jest.mock('./organization.repository', () => ({ OrganizationRepository: jest.fn(() => repo) }));

import { OrganizationService, type OrganizationCaller } from './organization.service';
import { CreateOrganizationSchema, UpdateOrganizationSchema } from './organization.dto';

const tenantAdmin: OrganizationCaller = { tenantId: 'org-a', isPlatformAdmin: false };
const platform: OrganizationCaller = { tenantId: 'org-a', isPlatformAdmin: true };

describe('OrganizationService tenancy', () => {
  const service = new OrganizationService();

  beforeEach(() => {
    jest.resetAllMocks();
    repo.findById.mockImplementation(async (id: string) => ({ id, enforce2fa: true }));
    repo.update.mockImplementation(async (id: string, data: object) => ({ id, ...data }));
  });

  it('returns the caller own organization', async () => {
    await expect(service.getOrganization('org-a', tenantAdmin)).resolves.toMatchObject({
      id: 'org-a',
    });
  });

  it("answers 404, not 403, for another tenant's organization", async () => {
    await expect(service.getOrganization('org-b', tenantAdmin)).rejects.toMatchObject({
      status: 404,
      code: 'ORGANIZATION_NOT_FOUND',
    });
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('lets a platform administrator read any organization', async () => {
    await expect(service.getOrganization('org-b', platform)).resolves.toMatchObject({
      id: 'org-b',
    });
  });

  it('does not let a tenant admin rename another tenant', async () => {
    await expect(
      service.updateOrganization('org-b', { name: 'Hijacked' }, tenantAdmin)
    ).rejects.toMatchObject({ status: 404 });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('does not let a tenant admin switch two-factor enforcement off', async () => {
    await expect(
      service.updateOrganization('org-a', { enforce2fa: false }, tenantAdmin)
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN_PLATFORM' });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('lets a tenant admin tighten two-factor enforcement', async () => {
    repo.findById.mockResolvedValue({ id: 'org-a', enforce2fa: false });
    await service.updateOrganization('org-a', { enforce2fa: true }, tenantAdmin);
    expect(repo.update).toHaveBeenCalledWith('org-a', { enforce2fa: true });
  });

  it('lets a platform administrator relax two-factor enforcement', async () => {
    await service.updateOrganization('org-b', { enforce2fa: false }, platform);
    expect(repo.update).toHaveBeenCalledWith('org-b', { enforce2fa: false });
  });

  it('rejects a duplicate workspace slug on create', async () => {
    repo.findByClientCode.mockResolvedValue({ id: 'existing' });
    await expect(
      service.createOrganization({ name: 'Acme', clientCode: 'acme' })
    ).rejects.toMatchObject({ code: 'SLUG_TAKEN' });
  });
});

describe('organization DTOs', () => {
  it('rejects fields outside the allow-list', () => {
    expect(() => UpdateOrganizationSchema.parse({ name: 'Acme', plan: 'free' })).toThrow();
    expect(() =>
      CreateOrganizationSchema.parse({ name: 'Acme', clientCode: 'acme', plan: 'free' })
    ).toThrow();
  });

  it('accepts the documented fields', () => {
    expect(UpdateOrganizationSchema.parse({ name: 'Acme', enforce2fa: true })).toEqual({
      name: 'Acme',
      enforce2fa: true,
    });
  });
});
