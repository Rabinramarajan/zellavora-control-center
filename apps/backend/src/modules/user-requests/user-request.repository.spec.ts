jest.mock('../../infrastructure/prisma', () => ({
  BaseRepository: class {},
}));

import type { TxClient } from '../../infrastructure/prisma';
import { UserRequestRepository } from './user-request.repository';

const txWith = (count: number) => {
  const updateMany = jest.fn(async () => ({ count }));
  return { tx: { userRequest: { updateMany } } as unknown as TxClient, updateMany };
};

describe('UserRequestRepository.claim (optimistic concurrency)', () => {
  it('bumps the version only when status and version still match', async () => {
    const { tx, updateMany } = txWith(1);
    await new UserRequestRepository().claim('r1', { status: 'PENDING_APPROVAL', version: 4 }, tx);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', status: 'PENDING_APPROVAL', version: 4 },
      data: { version: { increment: 1 } },
    });
  });

  it('rejects with 409 when another actor changed the request first', async () => {
    const { tx } = txWith(0);
    await expect(
      new UserRequestRepository().claim('r1', { status: 'PENDING_APPROVAL', version: 4 }, tx)
    ).rejects.toMatchObject({ status: 409, code: 'REQUEST_CHANGED' });
  });
});
