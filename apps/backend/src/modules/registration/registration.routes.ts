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
import { AppError } from '../../middleware/error';
import { PasswordService } from '../../services/auth/password.service';
import { addQueueJob } from '../../infrastructure/queue';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import {
  checkEmailAvailability,
  checkOrganizationCodeAvailability,
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

    // Hash password
    const passwordHash = await PasswordService.hash(data.password);

    // Verify MFA if enabled with authenticator
    if (data.mfaEnabled && data.mfaMethod === 'authenticator' && data.mfaCode) {
      // MFA verification would happen here
      // For now, we'll store the secret and verify on first login
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
          mfaSecret: data.mfaEnabled ? req.body.mfaSecret || null : null,
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
        ],
      });

      // 9. Create Audit Log
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

      // 10. Store password in history
      await tx.passwordHistory.create({
        data: {
          userId: user.id,
          passwordHash,
        },
      });

      return { organization, branch, user };
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

export default router;
