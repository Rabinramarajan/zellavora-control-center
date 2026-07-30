import { BaseRepository, TxClient } from '../../infrastructure/prisma';

export class InvitationRepository extends BaseRepository {
  async findByCode(code: string, tx?: TxClient) {
    return this.getDb(tx).invitation.findFirst({
      where: { code, used: false }
    });
  }

  async markAsUsed(id: string, tx?: TxClient) {
    return this.getDb(tx).invitation.update({
      where: { id },
      data: { used: true }
    });
  }

  async create(email: string, code: string, tx?: TxClient) {
    return this.getDb(tx).invitation.create({
      data: { email, code, used: false }
    });
  }
}
