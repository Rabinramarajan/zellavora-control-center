import { Queue, Worker } from 'bullmq';
import { config } from '../config/env';
import { logger } from './logger';
import nodemailer from 'nodemailer';

const redisConnectionOptions = config.redisUrl ? { url: config.redisUrl } : undefined;

export const emailQueue = redisConnectionOptions && config.redisEnabled
  ? new Queue('email-queue', { connection: { host: '127.0.0.1', port: 6379 } })
  : null;

// Helper to queue a job
export const addQueueJob = async (name: string, data: any) => {
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

const processJobLocally = async (name: string, data: any) => {
  if (name === 'send-otp') {
    await sendOtpEmail(data.email, data.otp);
  } else if (name === 'send-welcome') {
    await sendWelcomeEmail(data.email, data.tenantName);
  }
};

// Mailer Setup
const transporter = nodemailer.createTransport({
  host: config.smtpHost || 'localhost',
  port: config.smtpPort || 2525,
  secure: config.smtpPort === 465,
  auth: config.smtpUser ? {
    user: config.smtpUser,
    pass: config.smtpPassword,
  } : undefined,
});

export const sendOtpEmail = async (email: string, otp: string) => {
  const mailOptions = {
    from: `"${config.smtpFromName}" <${config.smtpFromEmail}>`,
    to: email,
    subject: 'ZCC Registration OTP Verification',
    text: `Your ZELLAVORA CONTROL CENTER registration OTP is: ${otp}. Valid for 10 minutes.`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #6366f1;">ZELLAVORA CONTROL CENTER</h2>
        <p>Your verification OTP code for signing up is:</p>
        <div style="font-size: 32px; font-weight: bold; color: #4f46e5; letter-spacing: 4px; padding: 10px 0;">${otp}</div>
        <p>This code is valid for 10 minutes.</p>
        <hr style="border: 0; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #888;">If you did not initiate this request, please ignore this email.</p>
      </div>
    `,
  };

  try {
    if (config.emailProvider === 'console' || !config.smtpUser) {
      logger.info(`[SMTP-MOCK] Send OTP ${otp} to ${email}`);
    } else {
      await transporter.sendMail(mailOptions);
      logger.info(`[SMTP] Sent OTP email to ${email}`);
    }
  } catch (err: any) {
    logger.error(`[SMTP] Failed to send OTP email to ${email}: ${err.message}`);
  }
};

export const sendWelcomeEmail = async (email: string, tenantName: string) => {
  const mailOptions = {
    from: `"${config.smtpFromName}" <${config.smtpFromEmail}>`,
    to: email,
    subject: 'Welcome to ZELLAVORA CONTROL CENTER',
    text: `Welcome to ZCC! Your workspace for ${tenantName} is active and ready.`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #6366f1;">Welcome to ZELLAVORA CONTROL CENTER!</h2>
        <p>Your organization <strong>${tenantName}</strong> has been registered successfully.</p>
        <p>You can now log in to the administrative panel using your superadmin credentials.</p>
        <hr style="border: 0; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #888;">ZCC Platform Administrator Team</p>
      </div>
    `,
  };

  try {
    if (config.emailProvider === 'console' || !config.smtpUser) {
      logger.info(`[SMTP-MOCK] Send Welcome to ${email} for tenant ${tenantName}`);
    } else {
      await transporter.sendMail(mailOptions);
      logger.info(`[SMTP] Sent Welcome email to ${email}`);
    }
  } catch (err: any) {
    logger.error(`[SMTP] Failed to send Welcome email: ${err.message}`);
  }
};

// Worker initialization
if (emailQueue && config.redisEnabled) {
  const worker = new Worker(
    'email-queue',
    async (job) => {
      logger.info(`[Queue Worker] Processing job ${job.name} (${job.id})`);
      if (job.name === 'send-otp') {
        await sendOtpEmail(job.data.email, job.data.otp);
      } else if (job.name === 'send-welcome') {
        await sendWelcomeEmail(job.data.email, job.data.tenantName);
      }
    },
    { connection: { host: '127.0.0.1', port: 6379 } }
  );

  worker.on('completed', (job) => {
    logger.info(`[Queue Worker] Job ${job.name} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`[Queue Worker] Job ${job?.name} failed: ${err.message}`);
  });
}
