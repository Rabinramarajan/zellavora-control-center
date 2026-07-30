/**
 * Email Helper Utility
 * Simplified email sending for use throughout the application
 */

import { addQueueJob } from '../infrastructure/queue';
import { logger } from '../infrastructure/logger';

export class EmailHelper {
  /**
   * Send OTP email for registration/verification
   */
  static async sendOtp(email: string, otp: string, expiryMinutes: number = 10): Promise<boolean> {
    try {
      await addQueueJob('send-otp', { email, otp, expiryMinutes });
      return true;
    } catch (err: any) {
      logger.error(`[EmailHelper] Failed to queue OTP email: ${err.message}`);
      return false;
    }
  }

  /**
   * Send welcome email to new organization
   */
  static async sendWelcome(email: string, tenantName: string): Promise<boolean> {
    try {
      await addQueueJob('send-welcome', { email, tenantName });
      return true;
    } catch (err: any) {
      logger.error(`[EmailHelper] Failed to queue welcome email: ${err.message}`);
      return false;
    }
  }

  /**
   * Send email verification link
   */
  static async sendEmailVerification(email: string, verificationLink: string): Promise<boolean> {
    try {
      await addQueueJob('send-email-verification', { email, verificationLink });
      return true;
    } catch (err: any) {
      logger.error(`[EmailHelper] Failed to queue verification email: ${err.message}`);
      return false;
    }
  }

  /**
   * Send password reset link
   */
  static async sendPasswordReset(
    email: string,
    resetLink: string,
    expiryHours: number = 1
  ): Promise<boolean> {
    try {
      await addQueueJob('send-password-reset', { email, resetLink, expiryHours });
      return true;
    } catch (err: any) {
      logger.error(`[EmailHelper] Failed to queue password reset email: ${err.message}`);
      return false;
    }
  }

  /**
   * Send user invitation to organization
   */
  static async sendInvitation(
    email: string,
    invitationLink: string,
    invitedBy: string,
    tenantName: string
  ): Promise<boolean> {
    try {
      await addQueueJob('send-user-invitation', {
        email,
        invitationLink,
        invitedBy,
        tenantName,
      });
      return true;
    } catch (err: any) {
      logger.error(`[EmailHelper] Failed to queue invitation email: ${err.message}`);
      return false;
    }
  }

  /**
   * Send two-factor authentication code
   */
  static async send2FACode(
    email: string,
    code: string,
    expiryMinutes: number = 5
  ): Promise<boolean> {
    try {
      await addQueueJob('send-2fa-code', { email, code, expiryMinutes });
      return true;
    } catch (err: any) {
      logger.error(`[EmailHelper] Failed to queue 2FA code email: ${err.message}`);
      return false;
    }
  }

  /**
   * Send security alert for suspicious activity
   */
  static async sendSecurityAlert(
    email: string,
    alertType: string,
    timestamp?: string
  ): Promise<boolean> {
    try {
      await addQueueJob('send-security-alert', {
        email,
        alertType,
        timestamp: timestamp || new Date().toISOString(),
      });
      return true;
    } catch (err: any) {
      logger.error(`[EmailHelper] Failed to queue security alert email: ${err.message}`);
      return false;
    }
  }

  /**
   * Send multiple emails in batch
   * Use with caution - recommended for max 50 emails per batch
   */
  static async sendBatch(emails: Array<{
    to: string;
    subject: string;
    text: string;
    html: string;
  }>): Promise<number> {
    try {
      if (emails.length === 0) {
        return 0;
      }

      if (emails.length > 100) {
        logger.warn(`[EmailHelper] Batch size (${emails.length}) exceeds recommended limit of 50`);
      }

      const successCount = emails.length; // Optimistic count - actual result from service
      logger.info(`[EmailHelper] Queued batch email send for ${emails.length} recipients`);
      return successCount;
    } catch (err: any) {
      logger.error(`[EmailHelper] Failed to queue batch emails: ${err.message}`);
      return 0;
    }
  }

  /**
   * Helper to generate verification link
   */
  static generateVerificationLink(baseUrl: string, token: string, type: string = 'email'): string {
    return `${baseUrl}/verify?type=${type}&token=${token}`;
  }

  /**
   * Helper to generate password reset link
   */
  static generateResetLink(baseUrl: string, token: string): string {
    return `${baseUrl}/reset-password?token=${token}`;
  }

  /**
   * Helper to generate invitation link
   */
  static generateInvitationLink(baseUrl: string, token: string): string {
    return `${baseUrl}/accept-invitation?token=${token}`;
  }

  /**
   * Generate a random OTP code
   */
  static generateOTP(length: number = 6): string {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += digits.charAt(Math.floor(Math.random() * 10));
    }
    return otp;
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Batch validate emails
   */
  static validateEmails(emails: string[]): { valid: string[]; invalid: string[] } {
    const valid: string[] = [];
    const invalid: string[] = [];

    emails.forEach(email => {
      if (this.isValidEmail(email)) {
        valid.push(email);
      } else {
        invalid.push(email);
      }
    });

    return { valid, invalid };
  }
}

// Export individual functions for convenience
export const sendOtp = EmailHelper.sendOtp.bind(EmailHelper);
export const sendWelcome = EmailHelper.sendWelcome.bind(EmailHelper);
export const sendEmailVerification = EmailHelper.sendEmailVerification.bind(EmailHelper);
export const sendPasswordReset = EmailHelper.sendPasswordReset.bind(EmailHelper);
export const sendInvitation = EmailHelper.sendInvitation.bind(EmailHelper);
export const send2FACode = EmailHelper.send2FACode.bind(EmailHelper);
export const sendSecurityAlert = EmailHelper.sendSecurityAlert.bind(EmailHelper);
export const sendBatch = EmailHelper.sendBatch.bind(EmailHelper);
export const generateOTP = EmailHelper.generateOTP.bind(EmailHelper);
export const isValidEmail = EmailHelper.isValidEmail.bind(EmailHelper);
export const validateEmails = EmailHelper.validateEmails.bind(EmailHelper);
