/**
 * Registration Routes — Enterprise Self-Registration Flow
 *
 * Complete registration flow endpoints:
 *
 * Public (no auth required):
 *   GET  /api/v1/register/status          → Check if registration is enabled
 *   POST /api/v1/register/check-email    → Check if email is available
 *   POST /api/v1/register/check-org      → Check if organization code is available
 *   POST /api/v1/register/init           → Initialize registration session
 *   POST /api/v1/register/send-email-otp → Send email OTP
 *   POST /api/v1/register/verify-email  → Verify email OTP
 *   POST /api/v1/register/send-mobile-otp → Send mobile OTP (optional)
 *   POST /api/v1/register/verify-mobile → Verify mobile OTP
 *   POST /api/v1/register/mfa-setup     → Get MFA setup (TOTP secret + QR)
 *   POST /api/v1/register/complete       → Complete registration
 *   GET  /api/v1/register/session/:id   → Get registration session status
 *   POST /api/v1/register/resend-otp    → Resend OTP with cooldown
 */

import { Router, type Router as ExpressRouter } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { config } from '../../config/env';
import { prisma } from '../../infrastructure/prisma';
import { logger } from '../../infrastructure/logger';
import { supabaseAdmin } from '../../config/supabase';
import { AppError } from '../../middleware/error';
import { PasswordService } from '../../services/auth/password.service';
import { TokenService } from '../../services/auth/token.service';
import { SessionService } from '../../services/auth/session.service';
import { EncryptionService } from '../../services/auth/encryption.service';
import { addQueueJob } from '../../infrastructure/queue';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import {
  checkEmailAvailability,
  checkOrganizationCodeAvailability,
  checkOrganizationNameAvailability,
  generateOrganizationCode,
  validatePasswordStrength,
  checkPasswordHistory,
} from './registration.service';

const router: ExpressRouter = Router();

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

const CheckEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const CheckOrgSchema = z.object({
  organizationCode: z
    .string()
    .min(2, 'Organization code must be at least 2 characters')
    .max(16, 'Organization code cannot exceed 16 characters')
    .regex(/^[A-Za-z0-9-]+$/, 'Organization code can only contain letters, numbers, and hyphens'),
});

const CheckOrgNameSchema = z.object({
  organizationName: z
    .string()
    .min(3, 'Organization name must be at least 3 characters')
    .max(100, 'Organization name cannot exceed 100 characters'),
});

const InitRegistrationSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(2, 'First name must be at least 2 characters').max(50),
  lastName: z.string().min(2, 'Last name must be at least 2 characters').max(50),
  displayName: z.string().max(100).optional(),
  mobile: z.string().optional(),
  country: z.string().min(1, 'Country is required'),
  timezone: z.string().optional(),
  language: z.string().default('en'),
  gender: z.string().optional(),
});

const SendEmailOtpSchema = z.object({
  sessionId: z.string().uuid().optional(),
  email: z.string().email(),
});

const VerifyEmailOtpSchema = z.object({
  sessionId: z.string().uuid().optional(),
  email: z.string().email(),
  code: z.string().length(6, 'OTP must be exactly 6 digits'),
});

const SendMobileOtpSchema = z.object({
  sessionId: z.string().uuid().optional(),
  mobile: z.string().min(10, 'Invalid mobile number'),
  countryCode: z.string().default('+91'),
});

const VerifyMobileOtpSchema = z.object({
  sessionId: z.string().uuid().optional(),
  mobile: z.string().min(10),
  code: z.string().length(6),
});

const MfaSetupSchema = z.object({
  sessionId: z.string().uuid().optional(),
  email: z.string().email(),
  method: z.enum(['authenticator', 'email_otp', 'sms']).default('authenticator'),
});

const VerifyMfaSchema = z.object({
  sessionId: z.string().uuid().optional(),
  email: z.string().email(),
  code: z.string().length(6, 'Code must be exactly 6 digits'),
});

const CompleteRegistrationSchema = z.object({
  // Session reference
  sessionId: z.string().uuid().optional(),

  // Personal Info (for verification)
  email: z.string().email(),
  emailVerified: z.boolean(),

  // Organization Info
  organizationName: z.string().min(2, 'Organization name is required').max(100),
  organizationCode: z
    .string()
    .min(2)
    .max(16)
    .regex(/^[A-Za-z0-9-]+$/),
  industry: z.string().optional(),
  size: z.enum(['1-10', '10-50', '50-100', '100-500', '500+']).optional(),
  website: z.string().url().optional().or(z.literal('')),
  gstNumber: z.string().optional(),
  taxNumber: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  useCases: z.array(z.string()).optional(),

  // Branch Info
  branchName: z.string().min(2, 'Branch name is required').max(100),
  branchCode: z.string().optional(),
  branchAddress: z.string().optional(),
  branchCity: z.string().optional(),
  branchState: z.string().optional(),
  branchCountry: z.string().optional(),
  branchPincode: z.string().optional(),
  branchPhone: z.string().optional(),
  branchEmail: z.string().email().optional().or(z.literal('')),
  branchLatitude: z.union([z.string(), z.number()]).optional(),
  branchLongitude: z.union([z.string(), z.number()]).optional(),

  // Organization Financials
  currency: z.string().optional(),
  fiscalYear: z.string().optional(),

  // Admin Info
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  displayName: z.string().max(100).optional(),
  mobile: z.string().optional(),
  mobileVerified: z.boolean().default(false),

  // Location & Preferences
  country: z.string(),
  timezone: z.string().optional(),
  language: z.string().default('en'),
  gender: z.string().optional(),

  // Credentials
  password: z.string().min(12, 'Password must be at least 12 characters'),
  confirmPassword: z.string(),

  // MFA
  mfaEnabled: z.boolean().default(true),
  mfaMethod: z.enum(['authenticator', 'email_otp', 'sms']).default('email_otp'),
  mfaCode: z.string().optional(), // Required if mfaEnabled and method is authenticator

  // Terms & Consent
  termsAccepted: z.boolean().refine((v) => v === true, 'You must accept the Terms of Service'),
  privacyAccepted: z.boolean().refine((v) => v === true, 'You must accept the Privacy Policy'),
  cookieAccepted: z.boolean().default(false),
  marketingConsent: z.boolean().default(false),

  // Optional invite code
  inviteCode: z.string().optional(),
});

const ResendOtpSchema = z.object({
  sessionId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  type: z.enum(['email', 'mobile']).default('email'),
});

const SaveProgressSchema = z.object({
  sessionId: z.string().uuid(),
  currentStep: z.number().int().min(1).max(13).optional(),
  firstName: z.string().min(2).max(50).optional(),
  lastName: z.string().min(2).max(50).optional(),
  displayName: z.string().max(100).optional(),
  email: z.string().email().optional(),
  mobile: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().optional(),
  language: z.string().optional(),
  gender: z.string().optional(),
  emailVerified: z.boolean().optional(),
  mobileVerified: z.boolean().optional(),
  organizationName: z.string().min(2).max(100).optional(),
  organizationCode: z.string().min(2).max(16).regex(/^[A-Za-z0-9-]+$/).optional(),
  industry: z.string().optional(),
  organizationSize: z.enum(['1-10', '10-50', '50-100', '100-500', '500+']).optional(),
  website: z.string().url().optional().or(z.literal('')),
  gstNumber: z.string().optional(),
  taxNumber: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  useCases: z.array(z.string()).optional(),
  branchName: z.string().min(2).max(100).optional(),
  branchAddress: z.string().optional(),
  branchCity: z.string().optional(),
  branchState: z.string().optional(),
  branchCountry: z.string().optional(),
  branchPincode: z.string().optional(),
  branchPhone: z.string().optional(),
  branchEmail: z.string().email().optional().or(z.literal('')),
  branchLatitude: z.union([z.string(), z.number()]).optional(),
  branchLongitude: z.union([z.string(), z.number()]).optional(),
  currency: z.string().optional(),
  fiscalYear: z.string().optional(),
  mfaMethod: z.enum(['email_otp', 'authenticator', 'sms']).optional(),
  mfaEnabled: z.boolean().optional(),
  termsAccepted: z.boolean().optional(),
  privacyAccepted: z.boolean().optional(),
  cookieAccepted: z.boolean().optional(),
  securityAlertsEnabled: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
});

// =============================================================================
// HELPERS
// =============================================================================

const ip = (req: any) =>
  (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? '0.0.0.0';
const ua = (req: any) => (req.headers['user-agent'] as string) ?? 'unknown';

const OTP_EXPIRY_MINUTES = 15;
const OTP_MAX_RESENDS = 5;
const OTP_COOLDOWN_SECONDS = 60;
const REGISTRATION_SESSION_EXPIRY_HOURS = 24;

// =============================================================================
// PUBLIC ENDPOINTS
// =============================================================================

/**
 * GET /api/v1/register/status
 * Check if self-registration is enabled
 */
router.get('/status', async (req, res, next) => {
  try {
    // Check if self-registration is enabled
    const registrationEnabled = config.ALLOW_SELF_REGISTRATION === true;

    res.json({
      enabled: registrationEnabled,
      features: {
        emailVerification: true,
        mobileVerification: false, // Optional
        mfaRequired: false,
        inviteRequired: false,
      },
      supportedPlans: ['free', 'starter', 'professional', 'enterprise'],
      supportedLanguages: ['en', 'es', 'fr', 'de', 'zh', 'ja'],
    });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/register/check-email
 * Check if email is available
 */
router.post('/check-email', async (req, res, next) => {
  try {
    const { email } = CheckEmailSchema.parse(req.body);
    const result = await checkEmailAvailability(email);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/register/check-org
 * Check if organization code is available
 */
router.post('/check-org', async (req, res, next) => {
  try {
    const { organizationCode } = CheckOrgSchema.parse(req.body);
    const normalizedCode = organizationCode.toLowerCase().replace(/\s+/g, '-');
    const result = await checkOrganizationCodeAvailability(normalizedCode);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/register/check-org-name
 * Check if an organization name is available
 */
router.post('/check-org-name', async (req, res, next) => {
  try {
    const { organizationName } = CheckOrgNameSchema.parse(req.body);
    const result = await checkOrganizationNameAvailability(organizationName);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/register/init
 * Initialize a new registration session
 */
router.post('/init', async (req, res, next) => {
  try {
    const data = InitRegistrationSchema.parse(req.body);

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existingUser) {
      throw new AppError('Email is already registered', 400, 'EMAIL_EXISTS');
    }

    // Create registration session
    const session = await prisma.registrationSession.create({
      data: {
        email: data.email.toLowerCase(),
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: data.displayName,
        mobile: data.mobile,
        country: data.country,
        timezone: data.timezone,
        language: data.language,
        gender: data.gender,
        status: 'in_progress',
        currentStep: 1,
        expiresAt: new Date(Date.now() + REGISTRATION_SESSION_EXPIRY_HOURS * 60 * 60 * 1000),
        ipAddress: ip(req),
        userAgent: ua(req),
      },
    });

    res.status(201).json({
      sessionId: session.id,
      email: session.email,
      expiresAt: session.expiresAt,
      nextStep: 'email_verification',
    });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/register/send-email-otp
 * Send OTP to email for verification
 */
router.post('/send-email-otp', async (req, res, next) => {
  try {
    const { sessionId, email } = SendEmailOtpSchema.parse(req.body);

    // Rate limiting check
    const recentOtps = await prisma.otp.count({
      where: {
        target: email.toLowerCase(),
        type: 'email',
        createdAt: {
          gte: new Date(Date.now() - 60000), // Last minute
        },
      },
    });

    if (recentOtps >= 3) {
      throw new AppError(
        'Too many OTP requests. Please wait before trying again.',
        429,
        'RATE_LIMITED'
      );
    }

    // Generate OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Get or create session reference
    let sessionData: any = {};
    if (sessionId) {
      const session = await prisma.registrationSession.findUnique({
        where: { id: sessionId },
      });
      if (session) {
        sessionData = { sessionId: session.id };
      }
    }

    await prisma.otp.create({
      data: {
        type: 'email',
        target: email.toLowerCase(),
        code,
        expiresAt,
        ipAddress: ip(req),
        userAgent: ua(req),
        ...sessionData,
      },
    });

    // Queue email job
    await addQueueJob('send-registration-otp', {
      email: email.toLowerCase(),
      code,
      type: 'email_verification',
    });

    // Calculate resend cooldown
    const lastOtp = await prisma.otp.findFirst({
      where: {
        target: email.toLowerCase(),
        type: 'email',
      },
      orderBy: { createdAt: 'desc' },
    });

    const cooldownEnd = lastOtp
      ? new Date(lastOtp.createdAt.getTime() + OTP_COOLDOWN_SECONDS * 1000)
      : new Date();

    res.json({
      success: true,
      message: 'OTP sent successfully',
      expiresIn: OTP_EXPIRY_MINUTES * 60,
      resendCooldown: OTP_COOLDOWN_SECONDS,
      cooldownEndsAt: cooldownEnd > new Date() ? cooldownEnd : null,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/register/verify-email
 * Verify email OTP
 */
router.post('/verify-email', async (req, res, next) => {
  try {
    const { sessionId, email, code } = VerifyEmailOtpSchema.parse(req.body);

    const otp = await prisma.otp.findFirst({
      where: {
        type: 'email',
        target: email.toLowerCase(),
        verified: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new AppError('Invalid or expired OTP', 400, 'INVALID_OTP');
    }

    // Check attempts
    if (otp.attempts >= otp.maxAttempts) {
      await prisma.otp.update({
        where: { id: otp.id },
        data: { expiresAt: new Date() }, // Expire it
      });
      throw new AppError('Too many attempts. Please request a new OTP.', 400, 'OTP_EXHAUSTED');
    }

    // Verify code
    if (otp.code !== code) {
      await prisma.otp.update({
        where: { id: otp.id },
        data: { attempts: otp.attempts + 1 },
      });
      throw new AppError('Incorrect OTP', 400, 'INVALID_OTP');
    }

    // Mark OTP as verified
    await prisma.otp.update({
      where: { id: otp.id },
      data: { verified: true },
    });

    // Update session if provided
    if (sessionId) {
      await prisma.registrationSession.update({
        where: { id: sessionId },
        data: { emailVerified: true, currentStep: 2 },
      });
    }

    res.json({
      success: true,
      message: 'Email verified successfully',
      verified: true,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/register/send-mobile-otp
 * Send OTP to mobile (optional step)
 */
router.post('/send-mobile-otp', async (req, res, next) => {
  try {
    const { sessionId, mobile, countryCode } = SendMobileOtpSchema.parse(req.body);

    // Generate OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    let sessionData: any = {};
    if (sessionId) {
      sessionData = { sessionId };
    }

    await prisma.otp.create({
      data: {
        type: 'mobile',
        target: `${countryCode}${mobile}`,
        code,
        expiresAt,
        ipAddress: ip(req),
        userAgent: ua(req),
        ...sessionData,
      },
    });

    // Queue SMS job
    await addQueueJob('send-sms-otp', {
      mobile: `${countryCode}${mobile}`,
      code,
    });

    res.json({
      success: true,
      message: 'SMS OTP sent successfully',
      expiresIn: OTP_EXPIRY_MINUTES * 60,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/register/verify-mobile
 * Verify mobile OTP
 */
router.post('/verify-mobile', async (req, res, next) => {
  try {
    const { sessionId, mobile, code } = VerifyMobileOtpSchema.parse(req.body);

    const otp = await prisma.otp.findFirst({
      where: {
        type: 'mobile',
        target: mobile,
        verified: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new AppError('Invalid or expired OTP', 400, 'INVALID_OTP');
    }

    if (otp.code !== code) {
      await prisma.otp.update({
        where: { id: otp.id },
        data: { attempts: otp.attempts + 1 },
      });
      throw new AppError('Incorrect OTP', 400, 'INVALID_OTP');
    }

    await prisma.otp.update({
      where: { id: otp.id },
      data: { verified: true },
    });

    if (sessionId) {
      await prisma.registrationSession.update({
        where: { id: sessionId },
        data: { mobileVerified: true, currentStep: 3 },
      });
    }

    res.json({
      success: true,
      message: 'Mobile verified successfully',
      verified: true,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/register/resend-otp
 * Resend OTP with cooldown
 */
router.post('/resend-otp', async (req, res, next) => {
  try {
    const { sessionId, email, type } = ResendOtpSchema.parse(req.body);

    // Check cooldown
    const lastOtp = await prisma.otp.findFirst({
      where: {
        target: email?.toLowerCase() || '',
        type: type,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (lastOtp) {
      const timeSinceLastOtp = Date.now() - lastOtp.createdAt.getTime();
      if (timeSinceLastOtp < OTP_COOLDOWN_SECONDS * 1000) {
        const remainingSeconds = Math.ceil((OTP_COOLDOWN_SECONDS * 1000 - timeSinceLastOtp) / 1000);
        throw new AppError(
          `Please wait ${remainingSeconds} seconds before requesting a new OTP`,
          429,
          'COOLDOWN_ACTIVE'
        );
      }

      // Check max resends
      const resendCount = await prisma.otp.count({
        where: {
          target: email?.toLowerCase() || '',
          type: type,
          createdAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
          },
        },
      });

      if (resendCount >= OTP_MAX_RESENDS) {
        throw new AppError(
          'Maximum resend limit reached. Please try again later.',
          429,
          'RESEND_LIMIT_EXCEEDED'
        );
      }
    }

    // Send new OTP
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.otp.create({
      data: {
        type: type,
        target: email?.toLowerCase() || '',
        code: newCode,
        expiresAt,
        ipAddress: ip(req),
        userAgent: ua(req),
        sessionId: sessionId || undefined,
      },
    });

    // Queue job
    if (type === 'email') {
      await addQueueJob('send-registration-otp', {
        email: email?.toLowerCase(),
        code: newCode,
        type: 'email_verification',
      });
    } else {
      await addQueueJob('send-sms-otp', {
        mobile: email, // Reuse email field for mobile
        code: newCode,
      });
    }

    res.json({
      success: true,
      message: 'OTP resent successfully',
      expiresIn: OTP_EXPIRY_MINUTES * 60,
      resendCooldown: OTP_COOLDOWN_SECONDS,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/register/mfa-setup
 * Get MFA setup (TOTP secret + QR code)
 */
router.post('/mfa-setup', async (req, res, next) => {
  try {
    const { sessionId, email, method } = MfaSetupSchema.parse(req.body);

    if (method === 'authenticator') {
      // Generate TOTP secret
      const secret = authenticator.generateSecret();
      const otpauth = authenticator.keyuri(email, 'ZELLAVORA', secret);
      const qrCodeDataUrl = await qrcode.toDataURL(otpauth);

      // Store secret in session if available
      if (sessionId) {
        await prisma.registrationSession.update({
          where: { id: sessionId },
          data: {
            mfaEnabled: true,
            mfaMethod: method,
            mfaSecret: secret,
          },
        });
      }

      res.json({
        method,
        secret,
        qrCode: qrCodeDataUrl,
        instructions:
          'Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)',
      });
    } else {
      // Email OTP method - no setup needed, just verify email first
      res.json({
        method,
        instructions: 'A verification code will be sent to your email during login',
      });
    }
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/register/verify-mfa
 * Verify the 6-digit TOTP code against the registration session's MFA secret
 */
router.post('/verify-mfa', async (req, res, next) => {
  try {
    const { sessionId, email, code } = VerifyMfaSchema.parse(req.body);

    const session = sessionId
      ? await prisma.registrationSession.findUnique({ where: { id: sessionId } })
      : await prisma.registrationSession.findFirst({
          where: { email: email.toLowerCase(), status: { not: 'completed' } },
          orderBy: { createdAt: 'desc' },
        });

    if (!session) {
      throw new AppError('Registration session not found', 404, 'SESSION_NOT_FOUND');
    }

    if (new Date() > session.expiresAt) {
      throw new AppError('Registration session has expired', 400, 'SESSION_EXPIRED');
    }

    if (!session.mfaSecret) {
      throw new AppError(
        'MFA has not been configured for this session. Request a new QR code.',
        400,
        'MFA_NOT_CONFIGURED'
      );
    }

    const valid = authenticator.check(code, session.mfaSecret);
    if (!valid) {
      throw new AppError('Incorrect authentication code. Please try again.', 400, 'INVALID_MFA_CODE');
    }

    res.json({
      success: true,
      message: 'Authentication code verified',
      verified: true,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/v1/register/session/:id
 * Get registration session status
 */
router.get('/session/:id', async (req, res, next) => {
  try {
    const session = await prisma.registrationSession.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        mobileVerified: true,
        firstName: true,
        lastName: true,
        displayName: true,
        country: true,
        timezone: true,
        language: true,
        organizationName: true,
        organizationCode: true,
        industry: true,
        size: true,
        branchName: true,
        mfaEnabled: true,
        mfaMethod: true,
        termsAccepted: true,
        privacyAccepted: true,
        status: true,
        currentStep: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    if (!session) {
      throw new AppError('Registration session not found', 404, 'SESSION_NOT_FOUND');
    }

    if (new Date() > session.expiresAt) {
      throw new AppError('Registration session has expired', 400, 'SESSION_EXPIRED');
    }

    res.json({
      ...session,
      isExpired: new Date() > session.expiresAt,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/register/complete
 * Complete registration - creates organization, branch, and user
 */
router.post('/complete', async (req, res, next) => {
  try {
    const data = CompleteRegistrationSchema.parse(req.body);

    // Validate password match
    if (data.password !== data.confirmPassword) {
      throw new AppError('Passwords do not match', 400, 'PASSWORD_MISMATCH');
    }

    // Validate password strength
    const passwordValidation = await validatePasswordStrength(data.password);
    if (!passwordValidation.isValid) {
      throw new AppError(passwordValidation.errors.join(', '), 400, 'WEAK_PASSWORD');
    }

    // Check email verification
    if (!data.emailVerified) {
      throw new AppError(
        'Email must be verified before completing registration',
        400,
        'EMAIL_NOT_VERIFIED'
      );
    }

    // Check organization code availability
    const orgCheck = await checkOrganizationCodeAvailability(data.organizationCode);
    if (!orgCheck.available) {
      throw new AppError('Organization code is already taken', 400, 'ORG_CODE_TAKEN');
    }

    // Check organization name availability
    const orgNameCheck = await checkOrganizationNameAvailability(data.organizationName);
    if (!orgNameCheck.available) {
      throw new AppError('Organization name is already taken', 400, 'ORG_NAME_TAKEN');
    }

    // Hash password
    const passwordHash = await PasswordService.hash(data.password);

    // Verify MFA if enabled with authenticator
    let mfaSecret: string | null = null;
    if (data.mfaEnabled && data.mfaMethod === 'authenticator') {
      // Resolve the registration session to get the stored TOTP secret
      const session = data.sessionId
        ? await prisma.registrationSession.findUnique({ where: { id: data.sessionId } })
        : await prisma.registrationSession.findFirst({
            where: { email: data.email.toLowerCase(), status: { not: 'completed' } },
            orderBy: { createdAt: 'desc' },
          });

      mfaSecret = session?.mfaSecret || null;

      if (!mfaSecret) {
        throw new AppError(
          'MFA has not been configured. Please complete the security setup step.',
          400,
          'MFA_NOT_CONFIGURED'
        );
      }

      if (!data.mfaCode || !authenticator.check(data.mfaCode, mfaSecret)) {
        throw new AppError(
          'Incorrect authentication code. Please go back and verify your authenticator code.',
          400,
          'INVALID_MFA_CODE'
        );
      }
    }

    // Get owner role
    const ownerRole = await prisma.role.findFirst({
      where: { key: 'owner' },
    });

    if (!ownerRole) {
      throw new AppError('System configuration error', 500, 'ROLE_NOT_FOUND');
    }

    // Create everything in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Organization
      const organization = await tx.organization.create({
        data: {
          name: data.organizationName,
          clientCode: data.organizationCode.toLowerCase(),
          industry: data.industry,
          size: data.size,
          website: data.website || null,
          gstNumber: data.gstNumber || null,
          taxNumber: data.taxNumber || null,
          logoUrl: data.logoUrl || null,
          useCases: data.useCases || [],
          email: data.email,
          country: data.country,
          termsAccepted: data.termsAccepted,
          termsAcceptedAt: data.termsAccepted ? new Date() : null,
          privacyAccepted: data.privacyAccepted,
          privacyAcceptedAt: data.privacyAccepted ? new Date() : null,
          cookieAccepted: data.cookieAccepted,
          cookieAcceptedAt: data.cookieAccepted ? new Date() : null,
          marketingConsent: data.marketingConsent,
          marketingConsentAt: data.marketingConsent ? new Date() : null,
          registrationSource: data.inviteCode ? 'invite' : 'organic',
          inviteCode: data.inviteCode || null,
          status: 'active',
        },
      });

      // 2. Create Head Office Branch
      const branch = await tx.branch.create({
        data: {
          organizationId: organization.id,
          name: data.branchName || 'Head Office',
          code: data.branchCode || 'HQ',
          isHeadOffice: true,
          address: data.branchAddress || null,
          city: data.branchCity || null,
          state: data.branchState || null,
          country: data.branchCountry || data.country,
          pincode: data.branchPincode || null,
          phone: data.branchPhone || null,
          email: data.branchEmail || null,
          latitude: data.branchLatitude !== undefined ? String(data.branchLatitude) : null,
          longitude: data.branchLongitude !== undefined ? String(data.branchLongitude) : null,
          status: 'active',
        },
      });

      // 3. Create Owner User
      const user = await tx.user.create({
        data: {
          email: data.email.toLowerCase(),
          emailId: data.email.toLowerCase(),
          fullName: `${data.firstName} ${data.lastName}`,
          firstName: data.firstName,
          lastName: data.lastName,
          displayName: data.displayName || null,
          mobile: data.mobile || null,
          mobileVerified: data.mobileVerified,
          country: data.country,
          timezone: data.timezone || null,
          language: data.language || 'en',
          passwordHash,
          role: 'owner',
          tenantId: organization.id,
          emailVerified: true,
          emailVerifiedAt: new Date(),
          mfaEnabled: data.mfaEnabled,
          mfaMethod: data.mfaMethod,
          mfaSecret: data.mfaEnabled ? mfaSecret : null,
          termsAccepted: data.termsAccepted,
          termsAcceptedAt: data.termsAccepted ? new Date() : null,
          privacyAccepted: data.privacyAccepted,
          privacyAcceptedAt: data.privacyAccepted ? new Date() : null,
          securityAlerts: true,
          marketingEmails: data.marketingConsent,
          statusValue: 'active',
          statusDescription: 'Active',
        },
      });

      // 4. Create User-Tenant membership
      await tx.userTenant.create({
        data: {
          userId: user.id,
          tenantId: organization.id,
          role: 'owner',
          departmentId: null,
          isDefault: true,
          joinedAt: new Date(),
        },
      });

      // 5. Create User Role Assignment
      await tx.userRoleAssignment.create({
        data: {
          userId: user.id,
          roleId: ownerRole.id,
          organizationId: organization.id,
        },
      });

      // 6. Create Profile
      await tx.profile.create({
        data: {
          userId: user.id,
        },
      });

      // 7. Create Default Workspace
      await tx.workspace.create({
        data: {
          organizationId: organization.id,
          name: 'Default Workspace',
          slug: 'default',
          description: 'Default workspace for your organization',
        },
      });

      // 8. Create Default Settings
      await tx.organizationSettings.createMany({
        data: [
          {
            organizationId: organization.id,
            key: 'default_language',
            value: data.language || 'en',
            category: 'general',
          },
          {
            organizationId: organization.id,
            key: 'default_timezone',
            value: data.timezone || 'UTC',
            category: 'general',
          },
          {
            organizationId: organization.id,
            key: 'session_timeout',
            value: '3600',
            category: 'security',
          },
          {
            organizationId: organization.id,
            key: 'mfa_required',
            value: data.mfaEnabled ? 'true' : 'false',
            category: 'security',
          },
          {
            organizationId: organization.id,
            key: 'default_currency',
            value: data.currency || 'USD',
            category: 'finance',
          },
          {
            organizationId: organization.id,
            key: 'fiscal_year',
            value: data.fiscalYear || 'january-december',
            category: 'finance',
          },
        ],
      });

      // 9. Create Default Departments
      const defaultDepartments = [
        { name: 'Human Resources', code: 'hr', description: 'People, culture and talent management' },
        { name: 'Finance', code: 'finance', description: 'Accounting, budgeting and financial planning' },
        { name: 'Information Technology', code: 'it', description: 'Technology infrastructure and support' },
        { name: 'Sales', code: 'sales', description: 'Revenue generation and client acquisition' },
        { name: 'Operations', code: 'ops', description: 'Day-to-day business operations' },
      ];
      const departments = await tx.department.createManyAndReturn({
        data: defaultDepartments.map((d) => ({
          organizationId: organization.id,
          name: d.name,
          code: d.code,
          description: d.description,
        })),
      });

      // 10. Create Audit Log
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'organization_created',
          resource: 'organization',
          resourceId: organization.id,
          organizationId: organization.id,
          severity: 'info',
          ipAddress: ip(req),
          userAgent: ua(req),
          metadata: {
            organizationName: data.organizationName,
            organizationCode: data.organizationCode,
            registrationSource: data.inviteCode ? 'invite' : 'organic',
          },
        },
      });

      // 11. Create Welcome Notification (in-app)
      await tx.notification.create({
        data: {
          organizationId: organization.id,
          recipientId: user.id,
          title: 'Welcome to Zellavora Control Center',
          body: `Your organization "${data.organizationName}" is ready. Complete your workspace setup to get started.`,
          type: 'success',
          channels: ['in_app', 'email'],
        },
      });

      // 12. Store password in history
      await tx.passwordHistory.create({
        data: {
          userId: user.id,
          passwordHash,
        },
      });

      return { organization, branch, user, departments };
    });

    // Update registration session if exists
    if (data.sessionId) {
      await prisma.registrationSession.update({
        where: { id: data.sessionId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          organizationName: data.organizationName,
          organizationCode: data.organizationCode,
        },
      });
    }

    // Mirror the owner into the Supabase users table (the auth "handshake"
    // layer). Login reads users.mfa_secret_encrypted + mfa_last_used_counter for
    // MFA and writes last_login_at there, so self-registered owners must exist
    // in Supabase with the encrypted TOTP secret.
    const mfaSecretEncrypted =
      data.mfaEnabled && data.mfaMethod === 'authenticator' && mfaSecret
        ? EncryptionService.encrypt(mfaSecret)
        : null;

    await supabaseAdmin.from('users').upsert(
      {
        id: result.user.id,
        email: result.user.email,
        full_name: result.user.fullName,
        role: 'owner',
        tenant_id: result.organization.id,
        email_verified: true,
        email_verified_at: new Date().toISOString(),
        mfa_enabled: data.mfaEnabled,
        mfa_method: data.mfaMethod,
        mfa_enrolled_at: mfaSecretEncrypted ? new Date().toISOString() : null,
        mfa_secret_encrypted: mfaSecretEncrypted,
        mfa_last_used_counter: mfaSecretEncrypted ? 0 : null,
        status_value: 'ACTIVE',
        status_description: 'Active',
        version: 1,
      },
      { onConflict: 'id' }
    );

    // Issue access + refresh tokens and create a session so the owner is signed in
    let session: { id: string; accessToken: string; refreshToken: string } | null = null;
    try {
      // Use the canonical Supabase-backed session so refresh-token rotation
      // (/auth/refresh) can find and rotate the token.
      const { sessionId } = await SessionService.create({
        userId: result.user.id,
        organizationId: result.organization.id,
        ipAddress: ip(req),
        userAgent: ua(req),
        rememberMe: true,
      });

      const tokenPair = await TokenService.issue({
        userId: result.user.id,
        tenantId: result.organization.id,
        role: 'owner',
        email: data.email.toLowerCase(),
        sessionId,
      });

      session = {
        id: sessionId,
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
      };
    } catch (sessionErr: any) {
      logger.warn(`[Registration] Session/token issuance skipped: ${sessionErr.message}`);
    }

    // Send welcome email
    await addQueueJob('send-welcome-email', {
      email: data.email.toLowerCase(),
      firstName: data.firstName,
      organizationName: data.organizationName,
      clientCode: data.organizationCode,
    });

    logger.info(`Organization created: ${result.organization.id}`, {
      organizationId: result.organization.id,
      userId: result.user.id,
      organizationCode: data.organizationCode,
    });

    res.status(201).json({
      success: true,
      message: 'Registration completed successfully',
      data: {
        organization: {
          id: result.organization.id,
          name: result.organization.name,
          clientCode: result.organization.clientCode,
        },
        user: {
          id: result.user.id,
          email: result.user.email,
          fullName: result.user.fullName,
          role: 'owner',
        },
        branch: {
          id: result.branch.id,
          name: result.branch.name,
        },
        departments: result.departments.map((d) => ({ id: d.id, name: d.name, code: d.code })),
        session: session
          ? {
              id: session.id,
              accessToken: session.accessToken,
              refreshToken: session.refreshToken,
            }
          : null,
      },
      nextSteps: [
        'Verify your email if not already done',
        'Set up two-factor authentication',
        'Explore your dashboard',
        'Invite team members',
      ],
    });
  } catch (e) {
    next(e);
  }
});

/**
 * PUT /api/v1/register/save-progress
 * Save partial registration progress to backend session
 */
router.put('/save-progress', async (req, res, next) => {
  try {
    const data = SaveProgressSchema.parse(req.body);

    const session = await prisma.registrationSession.findUnique({
      where: { id: data.sessionId },
    });

    if (!session) {
      throw new AppError('Registration session not found', 404, 'SESSION_NOT_FOUND');
    }

    if (new Date() > session.expiresAt) {
      throw new AppError('Registration session has expired', 400, 'SESSION_EXPIRED');
    }

    const updateData: any = {};

    if (data.currentStep !== undefined) updateData.currentStep = data.currentStep;
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.email !== undefined) updateData.email = data.email?.toLowerCase();
    if (data.mobile !== undefined) updateData.mobile = data.mobile;
    if (data.country !== undefined) updateData.country = data.country;
    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.language !== undefined) updateData.language = data.language;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.emailVerified !== undefined) updateData.emailVerified = data.emailVerified;
    if (data.mobileVerified !== undefined) updateData.mobileVerified = data.mobileVerified;
    if (data.organizationName !== undefined) updateData.organizationName = data.organizationName;
    if (data.organizationCode !== undefined) updateData.organizationCode = data.organizationCode?.toLowerCase();
    if (data.industry !== undefined) updateData.industry = data.industry;
    if (data.organizationSize !== undefined) updateData.size = data.organizationSize;
    if (data.website !== undefined) updateData.website = data.website || null;
    if (data.gstNumber !== undefined) updateData.gstNumber = data.gstNumber;
    if (data.taxNumber !== undefined) updateData.taxNumber = data.taxNumber;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl || null;
    if (data.useCases !== undefined) updateData.useCases = data.useCases;
    if (data.branchName !== undefined) updateData.branchName = data.branchName;
    if (data.branchAddress !== undefined) updateData.branchAddress = data.branchAddress;
    if (data.branchCity !== undefined) updateData.branchCity = data.branchCity;
    if (data.branchState !== undefined) updateData.branchState = data.branchState;
    if (data.branchCountry !== undefined) updateData.branchCountry = data.branchCountry;
    if (data.branchPincode !== undefined) updateData.branchPincode = data.branchPincode;
    if (data.mfaMethod !== undefined) updateData.mfaMethod = data.mfaMethod;
    if (data.mfaEnabled !== undefined) updateData.mfaEnabled = data.mfaEnabled;
    if (data.termsAccepted !== undefined) updateData.termsAccepted = data.termsAccepted;
    if (data.privacyAccepted !== undefined) updateData.privacyAccepted = data.privacyAccepted;
    if (data.cookieAccepted !== undefined) updateData.cookieAccepted = data.cookieAccepted;
    if (data.securityAlertsEnabled !== undefined) updateData.securityAlertsEnabled = data.securityAlertsEnabled;
    if (data.marketingEmails !== undefined) updateData.marketingConsent = data.marketingEmails;

    await prisma.registrationSession.update({
      where: { id: data.sessionId },
      data: updateData,
    });

    res.json({
      success: true,
      message: 'Progress saved',
      sessionId: data.sessionId,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
