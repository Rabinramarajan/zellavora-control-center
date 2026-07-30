import { VerificationRepository } from './verification.repository';
import { AppError } from '../../middleware/error';
import { addQueueJob } from '../../infrastructure/queue';
import { logger } from '../../infrastructure/logger';

export class VerificationService {
  private readonly repo = new VerificationRepository();

  async sendOtp(type: 'email' | 'phone', target: string) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await this.repo.createOtp({ type, target, code, expiresAt });

    if (type === 'email') {
      await addQueueJob('send-otp', { email: target, otp: code });
    } else {
      logger.info(`[SMS-MOCK] OTP ${code} sent to phone ${target}`);
    }

    return { success: true };
  }

  async verifyOtp(type: 'email' | 'phone', target: string, code: string) {
    const otp = await this.repo.findValidOtp(type, target, code);
    if (!otp) {
      throw new AppError('Invalid or expired OTP code', 400, 'INVALID_OTP');
    }
    await this.repo.markAsVerified(otp.id);
    return { verified: true };
  }
}
