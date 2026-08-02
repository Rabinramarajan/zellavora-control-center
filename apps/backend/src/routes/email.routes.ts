import { Router } from 'express';
import { emailService } from '../services/email.service';
import { logger } from '../infrastructure/logger';
import { addQueueJob, sendOtpEmail, sendWelcomeEmail } from '../infrastructure/queue';

const router = Router();

// Health check endpoint
/**
 * @swagger
 * /api/v1/email/health:
 *   get:
 *     summary: emailServiceHealthCheck
 *     description: Verifies the email service connection.
 *     tags: [emailCommunication]
 *     security: []
 *     responses:
 *       200:
 *         description: Email service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *       503:
 *         description: Email service is not available
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: unavailable
 *                 message:
 *                   type: string
 *       500:
 *         description: Health check failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/health', async (req, res) => {
  try {
    const isHealthy = await emailService.verifyConnection();
    if (isHealthy) {
      return res.status(200).json({
        status: 'ok',
        message: 'Email service is healthy',
      });
    }
    return res.status(503).json({
      status: 'unavailable',
      message: 'Email service is not available',
    });
  } catch (err: any) {
    logger.error(`[Email Health] Check failed: ${err.message}`);
    return res.status(500).json({
      status: 'error',
      message: err.message,
    });
  }
});

// Send OTP email
/**
 * @swagger
 * /api/v1/email/send-otp:
 *   post:
 *     summary: sendOtpEmail
 *     description: Queues an OTP email for delivery.
 *     tags: [emailCommunication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *               expiryMinutes:
 *                 type: integer
 *                 default: 10
 *     responses:
 *       202:
 *         description: OTP email queued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Email and OTP are required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Failed to queue OTP email
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/send-otp', async (req, res) => {
  try {
    const { email, otp, expiryMinutes = 10 } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    await addQueueJob('send-otp', {
      email,
      otp,
      expiryMinutes,
    });

    return res.status(202).json({
      message: 'OTP email queued successfully',
    });
  } catch (err: any) {
    logger.error(`[Email] Failed to queue OTP: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// Send welcome email
/**
 * @swagger
 * /api/v1/email/send-welcome:
 *   post:
 *     summary: sendWelcomeEmail
 *     description: Queues a welcome email for delivery.
 *     tags: [emailCommunication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, tenantName]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               tenantName:
 *                 type: string
 *     responses:
 *       202:
 *         description: Welcome email queued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Email and tenantName are required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Failed to queue welcome email
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/send-welcome', async (req, res) => {
  try {
    const { email, tenantName } = req.body;

    if (!email || !tenantName) {
      return res.status(400).json({ error: 'Email and tenantName are required' });
    }

    await addQueueJob('send-welcome', {
      email,
      tenantName,
    });

    return res.status(202).json({
      message: 'Welcome email queued successfully',
    });
  } catch (err: any) {
    logger.error(`[Email] Failed to queue welcome email: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// Send email verification
/**
 * @swagger
 * /api/v1/email/send-verification:
 *   post:
 *     summary: sendEmailVerification
 *     description: Queues an email verification message for delivery.
 *     tags: [emailCommunication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, verificationLink]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               verificationLink:
 *                 type: string
 *                 format: uri
 *     responses:
 *       202:
 *         description: Verification email queued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Email and verificationLink are required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Failed to queue verification email
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/send-verification', async (req, res) => {
  try {
    const { email, verificationLink } = req.body;

    if (!email || !verificationLink) {
      return res.status(400).json({ error: 'Email and verificationLink are required' });
    }

    await addQueueJob('send-email-verification', {
      email,
      verificationLink,
    });

    return res.status(202).json({
      message: 'Verification email queued successfully',
    });
  } catch (err: any) {
    logger.error(`[Email] Failed to queue verification email: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// Send password reset email
/**
 * @swagger
 * /api/v1/email/send-password-reset:
 *   post:
 *     summary: sendPasswordResetEmail
 *     description: Queues a password reset email for delivery.
 *     tags: [emailCommunication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, resetLink]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               resetLink:
 *                 type: string
 *                 format: uri
 *               expiryHours:
 *                 type: integer
 *                 default: 1
 *     responses:
 *       202:
 *         description: Password reset email queued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Email and resetLink are required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Failed to queue password reset email
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/send-password-reset', async (req, res) => {
  try {
    const { email, resetLink, expiryHours = 1 } = req.body;

    if (!email || !resetLink) {
      return res.status(400).json({ error: 'Email and resetLink are required' });
    }

    await addQueueJob('send-password-reset', {
      email,
      resetLink,
      expiryHours,
    });

    return res.status(202).json({
      message: 'Password reset email queued successfully',
    });
  } catch (err: any) {
    logger.error(`[Email] Failed to queue password reset email: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// Send user invitation
/**
 * @swagger
 * /api/v1/email/send-invitation:
 *   post:
 *     summary: sendUserInvitationEmail
 *     description: Queues a user invitation email for delivery.
 *     tags: [emailCommunication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, invitationLink, invitedBy, tenantName]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               invitationLink:
 *                 type: string
 *                 format: uri
 *               invitedBy:
 *                 type: string
 *               tenantName:
 *                 type: string
 *     responses:
 *       202:
 *         description: Invitation email queued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Email, invitationLink, invitedBy, and tenantName are required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Failed to queue invitation email
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/send-invitation', async (req, res) => {
  try {
    const { email, invitationLink, invitedBy, tenantName } = req.body;

    if (!email || !invitationLink || !invitedBy || !tenantName) {
      return res.status(400).json({
        error: 'Email, invitationLink, invitedBy, and tenantName are required',
      });
    }

    await addQueueJob('send-user-invitation', {
      email,
      invitationLink,
      invitedBy,
      tenantName,
    });

    return res.status(202).json({
      message: 'Invitation email queued successfully',
    });
  } catch (err: any) {
    logger.error(`[Email] Failed to queue invitation email: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// Send 2FA code
/**
 * @swagger
 * /api/v1/email/send-2fa-code:
 *   post:
 *     summary: send2FaCodeEmail
 *     description: Queues a 2FA code email for delivery.
 *     tags: [emailCommunication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               code:
 *                 type: string
 *               expiryMinutes:
 *                 type: integer
 *                 default: 5
 *     responses:
 *       202:
 *         description: 2FA code email queued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Email and code are required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Failed to queue 2FA code email
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/send-2fa-code', async (req, res) => {
  try {
    const { email, code, expiryMinutes = 5 } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }

    await addQueueJob('send-2fa-code', {
      email,
      code,
      expiryMinutes,
    });

    return res.status(202).json({
      message: '2FA code email queued successfully',
    });
  } catch (err: any) {
    logger.error(`[Email] Failed to queue 2FA code: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// Send security alert
/**
 * @swagger
 * /api/v1/email/send-security-alert:
 *   post:
 *     summary: sendSecurityAlertEmail
 *     description: Queues a security alert email for delivery.
 *     tags: [emailCommunication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, alertType]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               alertType:
 *                 type: string
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       202:
 *         description: Security alert email queued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Email and alertType are required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Failed to queue security alert email
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/send-security-alert', async (req, res) => {
  try {
    const { email, alertType, timestamp } = req.body;

    if (!email || !alertType) {
      return res.status(400).json({ error: 'Email and alertType are required' });
    }

    await addQueueJob('send-security-alert', {
      email,
      alertType,
      timestamp: timestamp || new Date().toISOString(),
    });

    return res.status(202).json({
      message: 'Security alert email queued successfully',
    });
  } catch (err: any) {
    logger.error(`[Email] Failed to queue security alert: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
