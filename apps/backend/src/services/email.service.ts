import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';
import { config } from '../config/env';
import { logger } from '../infrastructure/logger';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content?: string | Buffer;
    path?: string;
    contentType?: string;
  }>;
}

export interface SendEmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

class EmailService {
  private smtpTransporter: nodemailer.Transporter | null = null;
  private provider: 'console' | 'smtp' | 'sendgrid';

  constructor() {
    this.provider = config.emailProvider;

    if (this.provider === 'smtp' && config.smtpHost && config.smtpUser) {
      this.initializeSMTP();
    } else if (this.provider === 'sendgrid' && config.sendgridApiKey) {
      this.initializeSendGrid();
    }
  }

  private initializeSMTP(): void {
    try {
      this.smtpTransporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpPort === 465,
        auth: config.smtpUser ? {
          user: config.smtpUser,
          pass: config.smtpPassword,
        } : undefined,
      });

      this.smtpTransporter.verify((err, success) => {
        if (err) {
          logger.error(`[SMTP] Connection verification failed: ${err.message}`);
        } else if (success) {
          logger.info('[SMTP] Email service ready');
        }
      });
    } catch (err: any) {
      logger.error(`[SMTP] Initialization failed: ${err.message}`);
    }
  }

  private initializeSendGrid(): void {
    try {
      sgMail.setApiKey(config.sendgridApiKey);
      logger.info('[SendGrid] Email service configured');
    } catch (err: any) {
      logger.error(`[SendGrid] Initialization failed: ${err.message}`);
    }
  }

  async sendEmail(options: EmailOptions): Promise<SendEmailResponse> {
    try {
      if (this.provider === 'console') {
        return this.sendViaConsole(options);
      } else if (this.provider === 'smtp' && this.smtpTransporter) {
        return this.sendViaSMTP(options);
      } else if (this.provider === 'sendgrid') {
        return this.sendViaSendGrid(options);
      }

      logger.warn('[Email] No email provider configured, using console fallback');
      return this.sendViaConsole(options);
    } catch (err: any) {
      logger.error(`[Email] Failed to send email: ${err.message}`);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  private async sendViaSMTP(options: EmailOptions): Promise<SendEmailResponse> {
    try {
      const mailOptions = {
        from: `"${config.smtpFromName}" <${config.smtpFromEmail}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        cc: options.cc,
        bcc: options.bcc,
        replyTo: options.replyTo,
        attachments: options.attachments,
      };

      const info = await this.smtpTransporter!.sendMail(mailOptions);
      logger.info(`[SMTP] Email sent successfully: ${info.messageId}`);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (err: any) {
      logger.error(`[SMTP] Send failed: ${err.message}`);
      throw err;
    }
  }

  private async sendViaSendGrid(options: EmailOptions): Promise<SendEmailResponse> {
    try {
      const recipients = Array.isArray(options.to) ? options.to : [options.to];

      const msg = {
        to: recipients,
        from: config.sendgridFromEmail,
        subject: options.subject,
        text: options.text,
        html: options.html,
        cc: options.cc,
        bcc: options.bcc,
        replyTo: options.replyTo,
        attachments: options.attachments?.map(att => ({
          filename: att.filename,
          content: att.content || (att.path ? require('fs').readFileSync(att.path) : ''),
          type: att.contentType,
        })),
      };

      const response = await sgMail.send(msg);
      logger.info(`[SendGrid] Email sent successfully: ${response[0].headers['x-message-id']}`);
      return {
        success: true,
        messageId: response[0].headers['x-message-id'],
      };
    } catch (err: any) {
      logger.error(`[SendGrid] Send failed: ${err.message}`);
      throw err;
    }
  }

  private async sendViaConsole(options: EmailOptions): Promise<SendEmailResponse> {
    const recipients = Array.isArray(options.to) ? options.to.join(', ') : options.to;
    logger.info(`[Email-Console] To: ${recipients}`);
    logger.info(`[Email-Console] Subject: ${options.subject}`);
    logger.info(`[Email-Console] Text: ${options.text}`);

    return {
      success: true,
      messageId: `console-${Date.now()}`,
    };
  }

  async sendBatch(emailsList: EmailOptions[]): Promise<SendEmailResponse[]> {
    const results = await Promise.allSettled(
      emailsList.map(email => this.sendEmail(email))
    );

    return results.map(result => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        success: false,
        error: result.reason?.message || 'Unknown error',
      };
    });
  }

  async verifyConnection(): Promise<boolean> {
    try {
      if (this.provider === 'smtp' && this.smtpTransporter) {
        await this.smtpTransporter.verify();
        return true;
      } else if (this.provider === 'sendgrid') {
        const testEmail = {
          to: 'test@example.com',
          subject: 'Test',
          text: 'Test',
          html: '<p>Test</p>',
        };
        const response = await this.sendEmail(testEmail);
        return response.success;
      }
      return this.provider === 'console';
    } catch (err) {
      logger.error(`[Email] Connection verification failed: ${err}`);
      return false;
    }
  }
}

export const emailService = new EmailService();
