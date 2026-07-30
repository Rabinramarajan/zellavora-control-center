import { BaseRepository, TxClient } from '../../infrastructure/prisma';

export class UserRepository extends BaseRepository {
  async findById(id: string, tx?: TxClient) {
    return this.getDb(tx).user.findUnique({
      where: { id }
    });
  }

  async findByEmail(email: string, tx?: TxClient) {
    return this.getDb(tx).user.findUnique({
      where: { email }
    });
  }

  async findByUsername(username: string, tx?: TxClient) {
    return this.getDb(tx).user.findUnique({
      where: { username }
    });
  }

  async create(data: { email: string; emailId?: string | null; username: string; fullName: string; passwordHash: string; role?: string }, tx?: TxClient) {
    return this.getDb(tx).user.create({
      data: {
        email: data.email,
        emailId: data.emailId || data.email,
        username: data.username,
        fullName: data.fullName,
        passwordHash: data.passwordHash,
        role: data.role || 'user'
      }
    });
  }

  async update(id: string, data: { fullName?: string; passwordHash?: string; avatarUrl?: string | null; enable2fa?: boolean; mfaEnabled?: boolean; mfaEnrolledAt?: Date | null; otp?: string | null; isAccountLocked?: boolean; lastLockedDate?: Date | null; successfulLoginAttempts?: number; currentLoginDatetime?: Date | null; lastLoginDatetime?: Date | null; defaultLandingPage?: string | null; keyToken?: string | null; statusValue?: string | null; statusDescription?: string | null; version?: number; msg?: string | null }, tx?: TxClient) {
    return this.getDb(tx).user.update({
      where: { id },
      data
    });
  }

  async delete(id: string, tx?: TxClient) {
    return this.getDb(tx).user.delete({
      where: { id }
    });
  }
}
