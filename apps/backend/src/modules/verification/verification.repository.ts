import { BaseRepository, TxClient } from '../../infrastructure/prisma';

export class VerificationRepository extends BaseRepository {
  async createOtp(
    data: { type: string; target: string; code: string; expiresAt: Date },
    tx?: TxClient
  ) {
    return this.getDb(tx).otp.create({
      data: {
        type: data.type,
        target: data.target,
        code: data.code,
        expiresAt: data.expiresAt,
        verified: false,
      },
    });
  }

  async findValidOtp(type: string, target: string, code: string, tx?: TxClient) {
    return this.getDb(tx).otp.findFirst({
      where: {
        type,
        target,
        code,
        verified: false,
        expiresAt: { gte: new Date() },
      },
    });
  }

  async markAsVerified(id: string, tx?: TxClient) {
    return this.getDb(tx).otp.update({
      where: { id },
      data: { verified: true },
    });
  }
}
