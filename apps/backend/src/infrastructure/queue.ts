import { Queue, Worker } from 'bullmq';
import { config } from '../config/env';
import { logger } from './logger';
import { emailService } from '../services/email.service';
import { emailTemplates } from '../services/email.templates';

const redisConnectionOptions = config.redisUrl ? { url: config.redisUrl } : undefined;

export const emailQueue =
  redisConnectionOptions && config.redisEnabled
    ? new Queue('email-queue', { connection: { host: '127.0.0.1', port: 6379 } })
    : null;

export interface EmailJob {
  name: string;
  data: Record<string, any>;
}

// Helper to queue a job
export const addQueueJob = async (name: string, data: any): Promise<void> => {
  if (emailQueue && config.redisEnabled) {
    try {
      await emailQueue.add(name, data);
      logger.info(`[Queue] Added job ${name} to Redis queue`);
    } catch (err: any) {
      logger.error(`[Queue] Failed to add job to Redis queue: ${err.message}. Executing locally.`);
      await processJobLocally(name, data);
    }
  } else {
    logger.info(`[Queue] Redis disabled, processing job ${name} locally`);
    await processJobLocally(name, data);
  }
};

const processJobLocally = async (name: string, data: any): Promise<void> => {
  try {
    switch (name) {
      case 'send-otp':
        await sendOtpEmail(data.email, data.otp, data.expiryMinutes);
        break;
      case 'send-registration-otp':
        await sendOtpEmail(data.email, data.code, data.expiryMinutes);
        break;
      case 'send-sms-otp':
        logger.warn(`[Queue] SMS service not configured; SMS OTP for ${data.mobile} skipped`);
        break;
      case 'send-welcome-email':
        await sendWelcomeEmail(data.email, data.organizationName || data.tenantName);
        break;
      case 'send-welcome':
        await sendWelcomeEmail(data.email, data.tenantName);
        break;
      case 'send-email-verification':
        await sendEmailVerificationEmail(data.email, data.verificationLink);
        break;
      case 'send-password-reset':
        await sendPasswordResetEmail(data.email, data.resetLink, data.expiryHours);
        break;
      case 'send-user-invitation':
        await sendUserInvitationEmail(
          data.email,
          data.invitationLink,
          data.invitedBy,
          data.tenantName
        );
        break;
      case 'send-2fa-code':
        await send2FACodeEmail(data.email, data.code, data.expiryMinutes);
        break;
      case 'send-security-alert':
        await sendSecurityAlertEmail(data.email, data.alertType, data.timestamp);
        break;
      default:
        logger.warn(`[Queue] Unknown job type: ${name}`);
    }
  } catch (err: any) {
    logger.error(`[Queue] Error processing job ${name}: ${err.message}`);
    throw err;
  }
};

// OTP Email
export const sendOtpEmail = async (
  email: string,
  otp: string,
  expiryMinutes: number = 10
): Promise<boolean> => {
  try {
    const template = emailTemplates.otpVerification(otp, expiryMinutes);
    const result = await emailService.sendEmail({
      to: email,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    if (result.success) {
      logger.info(`[Email] OTP sent to ${email}`);
    } else {
      logger.error(`[Email] Failed to send OTP to ${email}: ${result.error}`);
    }
    return result.success;
  } catch (err: any) {
    logger.error(`[Email] Error sending OTP email: ${err.message}`);
    return false;
  }
};

// Welcome Email
export const sendWelcomeEmail = async (email: string, tenantName: string): Promise<boolean> => {
  try {
    const template = emailTemplates.welcomeEmail(tenantName);
    const result = await emailService.sendEmail({
      to: email,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    if (result.success) {
      logger.info(`[Email] Welcome email sent to ${email}`);
    } else {
      logger.error(`[Email] Failed to send welcome email to ${email}: ${result.error}`);
    }
    return result.success;
  } catch (err: any) {
    logger.error(`[Email] Error sending welcome email: ${err.message}`);
    return false;
  }
};

// Email Verification
export const sendEmailVerificationEmail = async (
  email: string,
  verificationLink: string
): Promise<boolean> => {
  try {
    const template = emailTemplates.emailVerification(verificationLink);
    const result = await emailService.sendEmail({
      to: email,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    if (result.success) {
      logger.info(`[Email] Verification email sent to ${email}`);
    } else {
      logger.error(`[Email] Failed to send verification email to ${email}: ${result.error}`);
    }
    return result.success;
  } catch (err: any) {
    logger.error(`[Email] Error sending verification email: ${err.message}`);
    return false;
  }
};

// Password Reset Email
export const sendPasswordResetEmail = async (
  email: string,
  resetLink: string,
  expiryHours: number = 1
): Promise<boolean> => {
  try {
    const template = emailTemplates.passwordResetEmail(resetLink, expiryHours);
    const result = await emailService.sendEmail({
      to: email,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    if (result.success) {
      logger.info(`[Email] Password reset email sent to ${email}`);
    } else {
      logger.error(`[Email] Failed to send password reset email to ${email}: ${result.error}`);
    }
    return result.success;
  } catch (err: any) {
    logger.error(`[Email] Error sending password reset email: ${err.message}`);
    return false;
  }
};

// User Invitation Email
export const sendUserInvitationEmail = async (
  email: string,
  invitationLink: string,
  invitedBy: string,
  tenantName: string
): Promise<boolean> => {
  try {
    const template = emailTemplates.userInvitation(invitationLink, invitedBy, tenantName);
    const result = await emailService.sendEmail({
      to: email,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    if (result.success) {
      logger.info(`[Email] Invitation email sent to ${email}`);
    } else {
      logger.error(`[Email] Failed to send invitation email to ${email}: ${result.error}`);
    }
    return result.success;
  } catch (err: any) {
    logger.error(`[Email] Error sending invitation email: ${err.message}`);
    return false;
  }
};

// 2FA Code Email
export const send2FACodeEmail = async (
  email: string,
  code: string,
  expiryMinutes: number = 5
): Promise<boolean> => {
  try {
    const template = emailTemplates.twoFactorCode(code, expiryMinutes);
    const result = await emailService.sendEmail({
      to: email,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    if (result.success) {
      logger.info(`[Email] 2FA code sent to ${email}`);
    } else {
      logger.error(`[Email] Failed to send 2FA code to ${email}: ${result.error}`);
    }
    return result.success;
  } catch (err: any) {
    logger.error(`[Email] Error sending 2FA code: ${err.message}`);
    return false;
  }
};

// Security Alert Email
export const sendSecurityAlertEmail = async (
  email: string,
  alertType: string,
  timestamp: string
): Promise<boolean> => {
  try {
    const template = emailTemplates.accountSecurityAlert(alertType, timestamp);
    const result = await emailService.sendEmail({
      to: email,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    if (result.success) {
      logger.info(`[Email] Security alert sent to ${email}`);
    } else {
      logger.error(`[Email] Failed to send security alert to ${email}: ${result.error}`);
    }
    return result.success;
  } catch (err: any) {
    logger.error(`[Email] Error sending security alert: ${err.message}`);
    return false;
  }
};

// Batch Email Sending
export const sendBatchEmails = async (emailList: Array<any>): Promise<any[]> => {
  try {
    logger.info(`[Queue] Processing batch of ${emailList.length} emails`);
    const results = await emailService.sendBatch(emailList);
    const successful = results.filter((r) => r.success).length;
    logger.info(`[Queue] Batch email send completed: ${successful}/${emailList.length} successful`);
    return results;
  } catch (err: any) {
    logger.error(`[Queue] Error sending batch emails: ${err.message}`);
    throw err;
  }
};

// Worker initialization
if (emailQueue && config.redisEnabled) {
  const worker = new Worker(
    'email-queue',
    async (job) => {
      logger.info(`[Queue Worker] Processing job ${job.name} (${job.id})`);
      try {
        await processJobLocally(job.name, job.data);
        logger.info(`[Queue Worker] Job ${job.name} completed successfully`);
      } catch (err: any) {
        logger.error(`[Queue Worker] Job ${job.name} failed: ${err.message}`);
        throw err;
      }
    },
    { connection: { host: '127.0.0.1', port: 6379 } }
  );

  worker.on('completed', (job) => {
    logger.info(`[Queue Worker] Job ${job.name} completed (${job.id})`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`[Queue Worker] Job ${job?.name} (${job?.id}) failed: ${err.message}`);
  });

  worker.on('error', (err) => {
    logger.error(`[Queue Worker] Worker error: ${err.message}`);
  });
}
