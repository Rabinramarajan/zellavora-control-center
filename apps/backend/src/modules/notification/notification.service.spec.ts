const repo = { listForRecipient: jest.fn(), create: jest.fn() };
jest.mock('./notification.repository', () => ({ NotificationRepository: jest.fn(() => repo) }));
jest.mock('../../infrastructure/queue', () => ({ addQueueJob: jest.fn() }));

import { addQueueJob } from '../../infrastructure/queue';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { ListNotificationsQuerySchema } from './notification.dto';
import type { AuthRequest } from '../../middleware/auth';

describe('NotificationService', () => {
  const service = new NotificationService();
  beforeEach(() => jest.resetAllMocks());

  it('lists only the signed-in member notifications, paged', async () => {
    repo.listForRecipient.mockResolvedValue({ total: 60, items: [{ id: 'n1' }] });
    const result = await service.listMine('org-1', 'user-1', { page: 3, pageSize: 20 });
    expect(repo.listForRecipient).toHaveBeenCalledWith('org-1', 'user-1', { skip: 40, take: 20 });
    expect(result).toEqual({ items: [{ id: 'n1' }], meta: { page: 3, pageSize: 20, total: 60 } });
  });

  it('records an in-app notification without enqueuing any email', async () => {
    await service.sendNotification({ organizationId: 'org-1', recipientId: 'u', body: 'hi' });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', channels: ['in_app'] })
    );
    expect(addQueueJob).not.toHaveBeenCalled();
  });

  it('never sends to a hard-coded address, whatever channel is asked for', async () => {
    await service.sendNotification({
      organizationId: 'org-1',
      recipientId: 'u',
      body: '123456',
      channels: ['email'],
    });
    expect(addQueueJob).not.toHaveBeenCalled();
  });
});

describe('NotificationController', () => {
  // Built before any reset so it keeps the mocked repository.
  const controller = new NotificationController();
  beforeEach(() => jest.resetAllMocks());

  it('ignores an organizationId or recipient supplied by the caller', async () => {
    repo.listForRecipient.mockResolvedValue({ total: 0, items: [] });
    const json = jest.fn();
    const next = jest.fn();
    const req = {
      tenantId: 'org-from-token',
      userId: 'user-from-token',
      query: { organizationId: 'another-org', recipientId: 'someone-else' },
    } as unknown as AuthRequest;
    await controller.list(req, { json } as never, next);
    // The strict query schema rejects the foreign fields before the repository is reached.
    expect(next).toHaveBeenCalled();
    expect(repo.listForRecipient).not.toHaveBeenCalled();
  });

  it('reads the organization and user from the verified token', async () => {
    repo.listForRecipient.mockResolvedValue({ total: 0, items: [] });
    const json = jest.fn();
    const req = {
      tenantId: 'org-from-token',
      userId: 'user-from-token',
      query: {},
    } as unknown as AuthRequest;
    await controller.list(req, { json } as never, jest.fn());
    expect(repo.listForRecipient).toHaveBeenCalledWith('org-from-token', 'user-from-token', {
      skip: 0,
      take: 25,
    });
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: [] }));
  });

  it('caps the page size', () => {
    expect(() => ListNotificationsQuerySchema.parse({ pageSize: '500' })).toThrow();
  });
});
