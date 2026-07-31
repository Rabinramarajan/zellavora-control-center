import { BaseRepository, TxClient } from '../../infrastructure/prisma';

export class AuthRepository extends BaseRepository {
  async findUserByUsernameOrEmail(identifier: string, tx?: TxClient) {
    return this.getDb(tx).user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
    });
  }

  async lockUser(id: string, tx?: TxClient) {
    return this.getDb(tx).user.update({
      where: { id },
      data: {
        isAccountLocked: true,
        lastLockedDate: new Date(),
      },
    });
  }

  async resetLoginAttempts(id: string, tx?: TxClient) {
    return this.getDb(tx).user.update({
      where: { id },
      data: {
        successfulLoginAttempts: 0,
      },
    });
  }

  async incrementLoginAttempts(id: string, tx?: TxClient) {
    return this.getDb(tx).user.update({
      where: { id },
      data: {
        successfulLoginAttempts: { increment: 1 },
      },
    });
  }
}
