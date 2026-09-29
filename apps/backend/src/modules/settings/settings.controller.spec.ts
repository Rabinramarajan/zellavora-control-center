jest.mock('./settings.service', () => ({
  SettingsService: jest.fn().mockImplementation(() => ({
    getSettingsForOrg: jest.fn().mockResolvedValue([]),
    getSetting: jest.fn().mockResolvedValue({ key: 'website.content' }),
    saveSetting: jest.fn(),
  })),
}));
import { SettingsController } from './settings.controller';

describe('company content tenant binding', () => {
  const tenantId = '9809684a-674b-4d13-a729-b2090a2d9924';
  const response = { json: jest.fn() };
  beforeEach(() => jest.clearAllMocks());

  it('reads the authenticated company without requiring a query tenant', async () => {
    const next = jest.fn();
    await new SettingsController().list({ tenantId, query: {} } as any, response as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith({ success: true, data: [] });
  });
  it('rejects reads for a different company', async () => {
    const next = jest.fn();
    await new SettingsController().get(
      { tenantId, query: { organizationId: 'other' }, params: { key: 'website.content' } } as any,
      response as any,
      next
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
    expect(response.json).not.toHaveBeenCalled();
  });
  it('rejects content writes for a different company', async () => {
    const next = jest.fn();
    await new SettingsController().save(
      {
        tenantId,
        body: {
          organizationId: '2d69ccf6-eb01-4da1-a185-03b2e62c0d7a',
          key: 'website.content',
          value: '{}',
        },
      } as any,
      response as any,
      next
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
    expect(response.json).not.toHaveBeenCalled();
  });
});
