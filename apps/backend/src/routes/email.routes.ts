import { Router } from 'express';
import { emailService } from '../services/email.service';
import { logger } from '../infrastructure/logger';
import { addQueueJob, sendOtpEmail, sendWelcomeEmail } from '../infrastructure/queue';

const router = Router();

// Health check endpoint
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
