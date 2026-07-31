import { UserRepository } from './user.repository';
import { PasswordService } from '../../services/auth/password.service';
import { AppError } from '../../middleware/error';

export class UserService {
  private readonly repo = new UserRepository();

  async getUser(id: string) {
    const user = await this.repo.findById(id);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    return user;
  }

  async getUserByEmail(email: string) {
    const user = await this.repo.findByEmail(email);
    if (!user) {
      throw new AppError('User with this email not found', 404, 'USER_NOT_FOUND');
    }
    return user;
  }

  async createUser(data: {
    email: string;
    username: string;
    fullName: string;
    passwordPlain: string;
    role?: string;
  }) {
    // Check duplicates
    const dupEmail = await this.repo.findByEmail(data.email);
    if (dupEmail) throw new AppError('Email address already registered', 400, 'EMAIL_TAKEN');

    const dupUser = await this.repo.findByUsername(data.username);
    if (dupUser) throw new AppError('Username already taken', 400, 'USERNAME_TAKEN');

    const passwordHash = await PasswordService.hash(data.passwordPlain);

    return this.repo.create({
      email: data.email,
      username: data.username,
      fullName: data.fullName,
      passwordHash,
      role: data.role,
    });
  }

  async updateUser(
    id: string,
    data: { fullName?: string; passwordPlain?: string; avatarUrl?: string | null }
  ) {
    await this.getUser(id);
    const updateData: any = { ...data };

    if (data.passwordPlain) {
      updateData.passwordHash = await PasswordService.hash(data.passwordPlain);
      delete updateData.passwordPlain;
    }

    return this.repo.update(id, updateData);
  }
}
