import nodemailer from 'nodemailer';
import { logger } from '../infrastructure/logger';
import { resolveEmailConfig, type ResolvedEmailConfig } from './email-config';

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

/** Identity of the transport a cached transporter was built from. */
const transportFingerprint = (cfg: ResolvedEmailConfig): string =>
  [cfg.smtpHost, cfg.smtpPort, cfg.smtpSecure, cfg.smtpUser, cfg.smtpPassword].join('|');

class EmailService {
  private smtpTransporter: nodemailer.Transporter | null = null;
  private smtpFingerprint: string | null = null;

  /**
   * Transports are built per send from the resolved configuration rather than
   * once in the constructor. Settings now live in the database and can change
   * at runtime, so a transporter pinned at construction would keep using
   * credentials an administrator had already replaced. The fingerprint check
   * keeps the connection pool alive while the configuration is unchanged.
   */
  private smtpTransport(cfg: ResolvedEmailConfig): nodemailer.Transporter {
    const fingerprint = transportFingerprint(cfg);
    if (this.smtpTransporter && this.smtpFingerprint === fingerprint) {
      return this.smtpTransporter;
    }

    this.smtpTransporter?.close();
    this.smtpTransporter = nodemailer.createTransport({
      host: cfg.smtpHost,
      port: cfg.smtpPort,
      // Implicit TLS on 465; 587 upgrades via STARTTLS, which nodemailer
      // negotiates on its own when secure is false.
      secure: cfg.smtpSecure || cfg.smtpPort === 465,
      auth: cfg.smtpUser ? { user: cfg.smtpUser, pass: cfg.smtpPassword } : undefined,
    });
    this.smtpFingerprint = fingerprint;
    return this.smtpTransporter;
  }


  async sendEmail(options: EmailOptions): Promise<SendEmailResponse> {
    try {
      const cfg = await resolveEmailConfig();

      if (cfg.provider === 'smtp' && cfg.smtpHost) {
        return await this.sendViaSMTP(options, cfg);
      }
      if (cfg.provider !== 'console') {
        logger.warn(
          `[Email] Provider "${cfg.provider}" is selected but not fully configured; falling back to console.`
        );
      }
      return this.sendViaConsole(options);
    } catch (err: any) {
      logger.error(`[Email] Failed to send email: ${err.message}`);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  private async sendViaSMTP(
    options: EmailOptions,
    cfg: ResolvedEmailConfig
  ): Promise<SendEmailResponse> {
    try {
      const mailOptions = {
        from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        cc: options.cc,
        bcc: options.bcc,
        replyTo: options.replyTo,
        attachments: options.attachments,
      };

      const info = await this.smtpTransport(cfg).sendMail(mailOptions);
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

  /** Handshake check that sends nothing. */
  async verifyConnection(): Promise<boolean> {
    try {
      const cfg = await resolveEmailConfig();
      if (cfg.provider === 'smtp' && cfg.smtpHost) {
        await this.smtpTransport(cfg).verify();
        return true;
      }
      return cfg.provider === 'console';
    } catch (err) {
      logger.error(`[Email] Connection verification failed: ${err}`);
      return false;
    }
  }
}

export const emailService = new EmailService();
