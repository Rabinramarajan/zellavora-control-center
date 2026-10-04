import { RegistrationSettingsService } from './registration-settings.service';

const findFirst = jest.fn();
const update = jest.fn();
jest.mock('../../infrastructure/prisma', () => ({
  prisma: { organization: { findFirst: () => findFirst(), update: (a: unknown) => update(a) } },
}));
jest.mock('../../infrastructure/audit', () => ({ AuditService: { log: jest.fn() } }));
jest.mock('../../config/env', () => {
  const actual = jest.requireActual('../../config/env');
  return {
    ...actual,
    config: {
      ...actual.config,
      selfRegistrationEnabled: true,
      registrationTypes: ['ORGANIZATION_MEMBER', 'INDIVIDUAL', 'CREATE_ORGANIZATION'],
    },
  };
});

const org = (overrides: Record<string, unknown> = {}) => ({
  id: 'org-1',
  name: 'Acme',
  status: 'active',
  allowSelfRegistration: true,
  allowedRegistrationTypes: ['ORGANIZATION_MEMBER'],
  requireAdminApproval: true,
  requireEmailVerification: true,
  ...overrides,
});

const settings = {
  allowSelfRegistration: true,
  allowedRegistrationTypes: ['ORGANIZATION_MEMBER'] as 'ORGANIZATION_MEMBER'[],
  requireAdminApproval: true,
  requireEmailVerification: true,
};

describe('RegistrationSettingsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findFirst.mockResolvedValue(org());
    update.mockImplementation(async () => org());
  });

  it('reports an opted-in active organization as open', async () => {
    const view = await new RegistrationSettingsService().get('org-1');
    expect(view.effectivelyOpen).toBe(true);
  });

  it('reads a null type list as ORGANIZATION_MEMBER only', async () => {
    // Rows that predate registration types must keep behaving as before.
    findFirst.mockResolvedValue(org({ allowedRegistrationTypes: null }));

    const view = await new RegistrationSettingsService().get('org-1');

    expect(view.allowedRegistrationTypes).toEqual(['ORGANIZATION_MEMBER']);
    expect(view.effectivelyOpen).toBe(true);
  });

  it('is closed when the switch is on but the type list is empty', async () => {
    // An explicit empty list is a real state an admin can save, and it means
    // "nothing", not "the default".
    findFirst.mockResolvedValue(org({ allowedRegistrationTypes: [] }));

    expect((await new RegistrationSettingsService().get('org-1')).effectivelyOpen).toBe(false);
  });

  it('is closed while the organization itself is not active', async () => {
    findFirst.mockResolvedValue(org({ status: 'pending_verification' }));

    expect((await new RegistrationSettingsService().get('org-1')).effectivelyOpen).toBe(false);
  });

  it('refuses a type this deployment does not offer', async () => {
    await expect(
      new RegistrationSettingsService().update(
        'org-1',
        { ...settings, allowedRegistrationTypes: ['CONTRACTOR' as 'ORGANIZATION_MEMBER'] },
        'admin-1'
      )
    ).rejects.toMatchObject({ code: 'REGISTRATION_TYPE_UNAVAILABLE' });
    expect(update).not.toHaveBeenCalled();
  });

  it('audits opening registration as a warning rather than routine info', async () => {
    const { AuditService } = jest.requireMock('../../infrastructure/audit');
    findFirst.mockResolvedValue(org({ allowSelfRegistration: false }));

    await new RegistrationSettingsService().update('org-1', settings, 'admin-1');

    expect(AuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'organization.registration_settings_updated',
        severity: 'warning',
        before: expect.objectContaining({ allowSelfRegistration: false }),
        after: expect.objectContaining({ allowSelfRegistration: true }),
      })
    );
  });

  it('rejects an unknown organization', async () => {
    findFirst.mockResolvedValue(null);

    await expect(new RegistrationSettingsService().get('nope')).rejects.toMatchObject({
      code: 'ORGANIZATION_NOT_FOUND',
    });
  });
});

describe('RegistrationSettingsService with the global flag off', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    findFirst.mockResolvedValue(org());
  });

  it('reports the organization as closed however it is configured', async () => {
    jest.doMock('../../config/env', () => {
      const actual = jest.requireActual('../../config/env');
      return {
        ...actual,
        config: { ...actual.config, selfRegistrationEnabled: false, registrationTypes: [] },
      };
    });
    const { RegistrationSettingsService: Service } = await import(
      './registration-settings.service'
    );

    const view = await new Service().get('org-1');

    // The organization's own switch is on; the deployment overrides it.
    expect(view.allowSelfRegistration).toBe(true);
    expect(view.globallyEnabled).toBe(false);
    expect(view.effectivelyOpen).toBe(false);
  });
});
