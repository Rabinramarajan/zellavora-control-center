const sessionFind = jest.fn();
const sessionUpdateMany = jest.fn();

jest.mock('../../infrastructure/prisma', () => ({
  prisma: {
    session: {
      findFirst: (...args: unknown[]) => sessionFind(...args),
      updateMany: (...args: unknown[]) => sessionUpdateMany(...args),
    },
  },
}));

import { SessionService } from './session.service';

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

describe('SessionService.touchIfActive', () => {
  beforeEach(() => {
    sessionFind.mockReset();
    sessionUpdateMany.mockReset().mockResolvedValue({ count: 1 });
  });

  it('is false for a revoked, expired or foreign session', async () => {
    sessionFind.mockResolvedValue(null);
    await expect(SessionService.touchIfActive('s', 'u', 30)).resolves.toBe(false);
    expect(sessionUpdateMany).not.toHaveBeenCalled();
  });

  it('does not write when the last activity is under a minute old', async () => {
    sessionFind.mockResolvedValue({ lastActivityAt: new Date(Date.now() - 10_000) });
    await expect(SessionService.touchIfActive('s', 'u', 30)).resolves.toBe(true);
    expect(sessionUpdateMany).not.toHaveBeenCalled();
  });

  it('writes once the last activity is a minute old', async () => {
    sessionFind.mockResolvedValue({ lastActivityAt: minutesAgo(2) });
    await expect(SessionService.touchIfActive('s', 'u', 30)).resolves.toBe(true);
    expect(sessionUpdateMany).toHaveBeenCalledTimes(1);
    expect(sessionUpdateMany.mock.calls[0][0].where).toMatchObject({ id: 's', userId: 'u' });
  });

  it('deactivates and rejects a session idle past the policy limit', async () => {
    sessionFind.mockResolvedValue({ lastActivityAt: minutesAgo(45) });
    await expect(SessionService.touchIfActive('s', 'u', 30)).resolves.toBe(false);
    expect(sessionUpdateMany.mock.calls[0][0].data).toEqual({ isActive: false });
  });

  it('applies no idle limit when the policy has none', async () => {
    sessionFind.mockResolvedValue({ lastActivityAt: minutesAgo(600) });
    await expect(SessionService.touchIfActive('s', 'u', 0)).resolves.toBe(true);
  });
});
