import jwt from 'jsonwebtoken';
import { AuthRepository } from './auth.repository';
import { IamUserRepository } from '../users/iam-user.repository';
import { PasswordService } from '../../services/auth/password.service';
import { AppError } from '../../middleware/error';
import { config } from '../../config/env';
import { authenticator } from 'otplib';

export class AuthService {
  private readonly repo = new AuthRepository();
  private readonly userRepo = new IamUserRepository();

  async login(identifier: string, passwordPlain: string) {
    const user = await this.repo.findUserByUsernameOrEmail(identifier);
    if (!user) {
      throw new AppError('Invalid username or password', 401, 'INVALID_CREDENTIALS');
    }

    if (user.isAccountLocked && user.lastLockedDate) {
      const lockDurationMs = 15 * 60 * 1000; // 15 mins lock
      if (Date.now() - user.lastLockedDate.getTime() < lockDurationMs) {
        throw new AppError(
          'Account is temporarily locked. Try again later.',
          403,
          'ACCOUNT_LOCKED'
        );
      } else {
        // Unlock
        await this.userRepo.update(user.id, { isAccountLocked: false, lastLockedDate: null });
      }
    }

    const passwordValid = await PasswordService.verify(passwordPlain, user.passwordHash || '');
    if (!passwordValid) {
      const updated = await this.repo.incrementLoginAttempts(user.id);
      if (updated.successfulLoginAttempts >= 5) {
        await this.repo.lockUser(user.id);
        throw new AppError('Account locked due to too many failed attempts', 403, 'ACCOUNT_LOCKED');
      }
      throw new AppError('Invalid username or password', 401, 'INVALID_CREDENTIALS');
    }

    await this.repo.resetLoginAttempts(user.id);

    // If MFA is enabled, return challenge
    if (user.mfaEnabled) {
      return { mfaRequired: true, userId: user.id };
    }

    return this.generateTokens(user.id, user.email, user.role);
  }

  async verifyMfaChallenge(userId: string, code: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Verify MFA OTP pin
    const mfaSecret = user.otp; // In real impl, decrypted from database
    if (!mfaSecret || !authenticator.check(code, mfaSecret)) {
      throw new AppError('Invalid MFA verification code', 401, 'MFA_INVALID_CODE');
    }

    return this.generateTokens(user.id, user.email, user.role);
  }

  async refreshUserTokens(refreshToken: string) {
    try {
      const payload = jwt.verify(refreshToken, config.refreshTokenSecret) as any;
      const user = await this.userRepo.findById(payload.userId);
      if (!user) {
        throw new AppError('Invalid token session', 401, 'INVALID_SESSION');
      }
      return this.generateTokens(user.id, user.email, user.role);
    } catch {
      throw new AppError('Expired or invalid refresh session token', 401, 'INVALID_SESSION');
    }
  }

  private generateTokens(userId: string, email: string, role: string) {
    const accessToken = jwt.sign({ userId, email, role }, config.jwtSecret as string, {
      expiresIn: config.jwtExpiry as any,
    });

    const refreshToken = jwt.sign({ userId }, config.refreshTokenSecret as string, {
      expiresIn: config.refreshTokenExpiry as any,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: config.jwtExpiry,
    };
  }
}
