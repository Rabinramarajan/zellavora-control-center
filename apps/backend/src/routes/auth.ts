/**
 * Auth Routes — Enterprise Multi-Tenant Authentication.
 *
 *   POST   /api/v1/auth/validate-client        →  Validate client code
 *   POST   /api/v1/auth/login                  →  Email + Password (returns MFA challenge if enabled)
 *   POST   /api/v1/auth/login/mfa              →  Submit TOTP / recovery code
 *   POST   /api/v1/auth/refresh                →  Rotate access + refresh tokens
 *   POST   /api/v1/auth/logout                 →  Revoke current session
 *   POST   /api/v1/auth/logout-all             →  Revoke every session
 *   GET    /api/v1/auth/me                     →  Current user + tenant + roles + permissions + menus
 *   GET    /api/v1/auth/tenants                →  List user's tenants
 *   POST   /api/v1/auth/switch-tenant          →  Switch active tenant (rotate tokens)
 *   POST   /api/v1/auth/change-password        →  Change password (authed)
 *   POST   /api/v1/auth/forgot-password        →  Send reset email
 *   POST   /api/v1/auth/reset-password         →  Apply new password with token
 *   POST   /api/v1/auth/mfa/enroll             →  Start TOTP enrollment
 *   POST   /api/v1/auth/mfa/confirm            →  Confirm TOTP enrollment
 *   POST   /api/v1/auth/mfa/disable            →  Disable MFA
 *   POST   /api/v1/auth/mfa/recovery-codes     →  Regenerate recovery codes
 */
import { Router, type Router as ExpressRouter } from 'express';
import CryptoJS from 'crypto-js';
import crypto from 'crypto';
import { z } from 'zod';
import { config } from '../config/env';
import { supabase, supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/error';
import { prisma } from '../infrastructure/prisma';
import { addQueueJob } from '../infrastructure/queue';
import { authenticate, type AuthRequest, requirePermission } from '../middleware/auth';
import {
  PasswordService,
  TokenService,
  SessionService,
  TenantService,
  MfaService,
  PermissionService,
  MenuService,
  AuditService,
  RateLimitService,
} from '../services/auth';

const router: ExpressRouter = Router();

// ----------------------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------------------

const ValidateClientSchema = z.object({
  clientCode: z
    .string()
    .min(2)
    .max(16)
    .regex(/^[A-Za-z0-9-]+$/),
});

const LoginSchema = z.object({
  clientCode: z
    .string()
    .min(2)
    .max(16)
    .regex(/^[A-Za-z0-9-]+$/),
  email: z.string().email().max(255),
  password: z.string().min(1).max(128), // policy checked on hash
  rememberMe: z.boolean().optional(),

  // Legacy/Handshake properties accepted for compatibility
  confirmPassword: z.string().optional(),
  currentLoginDatetime: z.string().optional(),
  defaultLandingPage: z.string().optional(),
  emailId: z.string().optional(),
  enableTwoFactorAuthentication: z.boolean().optional(),
  isAccountLocked: z.boolean().optional(),
  lastLockedDate: z.string().optional(),
  keyToken: z.union([z.string(), z.array(z.string())]).optional(),
  lastLoginDatetime: z.string().optional(),
  msg: z.string().optional(),
  newPassword: z.string().optional(),
  oldPassword: z.string().optional(),
  otp: z.string().optional(),
  passwordResetFlag: z.boolean().optional(),
  statusValue: z.string().optional(),
  statusDescription: z.string().optional(),
  version: z.number().optional(),
  userName: z.string().optional(),
  successfulLoginAttempts: z.number().optional(),
});

const LoginMfaSchema = z.object({
  mfaToken: z.string().uuid(), // opaque token returned by /login when MFA is required
  code: z.string().min(6).max(20), // TOTP (6 digits) or recovery code
  rememberMe: z.boolean().optional(),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(10),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128),
});

const ForgotPasswordSchema = z.object({
  clientCode: z.string().min(2).max(16),
  email: z.string().email(),
});

const ResetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(12).max(128),
});

const MfaEnrollConfirmSchema = z.object({
  secret: z.string().min(16),
  code: z.string().regex(/^\d{6}$/),
});

const SwitchTenantSchema = z.object({
  organizationId: z.string().uuid(),
});

const ip = (req: any) =>
  (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? '0.0.0.0';
const ua = (req: any) => (req.headers['user-agent'] as string) ?? 'unknown';

const parseBrowser = (userAgent: string): string => {
  const u = userAgent.toLowerCase();
  if (u.includes('edg/')) return 'Edge';
  if (u.includes('opr/') || u.includes('opera')) return 'Opera';
  if (u.includes('firefox/')) return 'Firefox';
  if (u.includes('chrome/') || u.includes('crios/')) return 'Chrome';
  if (u.includes('safari/')) return 'Safari';
  return 'Unknown Browser';
};

const parseOs = (userAgent: string): string => {
  const u = userAgent.toLowerCase();
  if (u.includes('windows')) return 'Windows';
  if (u.includes('mac os') || u.includes('macintosh')) return 'macOS';
  if (u.includes('android')) return 'Android';
  if (u.includes('iphone') || u.includes('ipad') || u.includes('ios')) return 'iOS';
  if (u.includes('linux')) return 'Linux';
  return 'Unknown OS';
};

// In-memory store for short-lived MFA challenges (use Redis in production).
// Key: mfaToken, Value: { userId, organizationId, attempts, method, expiresAt }
const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const mfaChallenges = new Map<
  string,
  {
    userId: string;
    organizationId: string;
    attempts: number;
    method: 'totp' | 'email_otp' | 'sms';
    expiresAt: number;
  }
>();
const newMfaToken = () => crypto.randomUUID();
const remember = (
  token: string,
  value: Omit<NonNullable<ReturnType<typeof consumeMfa>>, 'expiresAt'>
) => {
  mfaChallenges.set(token, { ...value, expiresAt: Date.now() + MFA_CHALLENGE_TTL_MS });
};
const consumeMfa = (token: string) => {
  const v = mfaChallenges.get(token);
  if (!v || v.expiresAt < Date.now()) {
    mfaChallenges.delete(token);
    return null;
  }
  return v;
};

// ----------------------------------------------------------------------------
// POST /auth/validate-client
// ----------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/auth/validate-client:
 *   post:
 *     summary: validateAClienttenantCode
 *     tags: [auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clientCode]
 *             properties:
 *               clientCode:
 *                 type: string
 *                 example: acme
 *     responses:
 *       200:
 *         description: Tenant info returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                 tenant:
 *                   $ref: '#/components/schemas/Tenant'
 *       404:
 *         description: Client code not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
/**
 * @swagger
 * /api/v1/auth/clients:
 *   get:
 *     summary: listAllActiveClientsPublicly
 *     tags: [auth]
 *     security: []
 *     responses:
 *       200:
 *         description: List of active clients
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tenants:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Tenant'
 */
router.get('/clients', async (req, res, next) => {
  try {
    // Disable caching to ensure fresh 200 response
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const { data: orgs, error } = await supabaseAdmin
      .from('organizations')
      .select('id, name, client_code, logo_url, status')
      .eq('status', 'active')
      .is('deleted_at', null);

    if (error) {
      throw error;
    }

    res.status(200).json({
      tenants: (orgs || []).map((o) => ({
        id: o.id,
        name: o.name,
        clientCode: o.client_code,
        logoUrl: o.logo_url,
        status: o.status,
      })),
    });
  } catch (e) {
    next(e);
  }
});

router.post('/validate-client', async (req, res, next) => {
  try {
    const { clientCode } = ValidateClientSchema.parse(req.body);
    const tenant = await TenantService.resolveByClientCode(clientCode);
    res.json({
      valid: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        clientCode: tenant.clientCode,
        logoUrl: tenant.logoUrl,
        enforce2fa: tenant.enforce2fa,
        allowedDomains: tenant.allowedDomains,
      },
    });
  } catch (e) {
    next(e);
  }
});

// ----------------------------------------------------------------------------
// GET /auth/gettoken
// ----------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/auth/gettoken:
 *   get:
 *     summary: retrieveTemporaryAESKeyAndIVForPayloadEncryption
 *     tags: [auth]
 *     security: []
 *     responses:
 *       200:
 *         description: Array containing AES key and IV as binary strings
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 */
router.get('/gettoken', (req, res, next) => {
  try {
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    res.json([key.toString('base64'), iv.toString('base64')]);
  } catch (e) {
    next(e);
  }
});

// ----------------------------------------------------------------------------
// POST /auth/login  —  primary login
// ----------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: loginWithEmailAndPassword
 *     description: Returns tokens on success, or an MFA challenge token if the user has 2FA enabled.
 *     tags: [login]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clientCode, email, password]
 *             properties:
 *               clientCode:
 *                 type: string
 *                 example: acme
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               rememberMe:
 *                 type: boolean
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *               currentLoginDatetime:
 *                 type: string
 *                 format: date-time
 *               defaultLandingPage:
 *                 type: string
 *               emailId:
 *                 type: string
 *               enableTwoFactorAuthentication:
 *                 type: boolean
 *               isAccountLocked:
 *                 type: boolean
 *               lastLockedDate:
 *                 type: string
 *                 format: date-time
 *               keyToken:
 *                 type: array
 *                 items:
 *                   type: string
 *               lastLoginDatetime:
 *                 type: string
 *                 format: date-time
 *               msg:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 format: password
 *               oldPassword:
 *                 type: string
 *                 format: password
 *               otp:
 *                 type: string
 *               passwordResetFlag:
 *                 type: boolean
 *               statusValue:
 *                 type: string
 *               statusDescription:
 *                 type: string
 *               version:
 *                 type: integer
 *               userName:
 *                 type: string
 *               successfulLoginAttempts:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Login success (no MFA) or MFA challenge issued
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/AuthResponse'
 *                 - $ref: '#/components/schemas/MfaChallengeResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       423:
 *         description: Account locked
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', async (req, res, next) => {
  try {
    const loginData = { ...req.body };
    // Map emailId or userName to email for compatibility if email is not directly specified
    if (!loginData.email && loginData.emailId) {
      loginData.email = loginData.emailId;
    }
    if (!loginData.email && loginData.userName) {
      loginData.email = loginData.userName;
    }

    if (loginData.keyToken && Array.isArray(loginData.keyToken)) {
      try {
        const keyToken = loginData.keyToken;
        if (keyToken.length === 2) {
          const keyBase64 = keyToken[0];
          const ivBase64 = keyToken[1];

          const decryptAes = (cipherText: string) => {
            const key = CryptoJS.enc.Base64.parse(keyBase64);
            const iv = CryptoJS.enc.Base64.parse(ivBase64);
            const decrypted = CryptoJS.AES.decrypt(cipherText, key, {
              iv: iv,
              mode: CryptoJS.mode.CBC,
              padding: CryptoJS.pad.Pkcs7,
            });
            return decrypted.toString(CryptoJS.enc.Utf8);
          };

          if (loginData.clientCode) loginData.clientCode = decryptAes(loginData.clientCode);
          if (loginData.email) loginData.email = decryptAes(loginData.email);
          if (loginData.password) loginData.password = decryptAes(loginData.password);
        }
      } catch (err) {
        throw new AppError('Failed to decrypt login payload', 400, 'AUTHENTICATION_FAILED');
      }
    }
    const body = LoginSchema.parse(loginData);

    // 1. Rate-limit the IP and check the account isn't locked
    await RateLimitService.assertIpAllowed(ip(req));
    await RateLimitService.assertAccountAllowed(body.email);

    // 2. Resolve tenant by client code
    const tenant = await TenantService.resolveByClientCode(body.clientCode);

    // 3. Find user in this tenant (using Prisma for reliable direct DB access)
    const prismaUser = await prisma.user.findFirst({
      where: {
        email: body.email.toLowerCase(),
        tenantId: tenant.id,
      },
    });
    const user = prismaUser
      ? {
          id: prismaUser.id,
          email: prismaUser.email,
          full_name: prismaUser.fullName,
          role: prismaUser.role,
          password_hash: prismaUser.passwordHash,
          mfa_enabled: prismaUser.mfaEnabled,
          is_active: !prismaUser.isDeleted && !prismaUser.isAccountLocked,
          deleted_at: prismaUser.deletedAt?.toISOString() ?? null,
          locked_until: prismaUser.lastLockedDate?.toISOString() ?? null,
          failed_login_attempts: prismaUser.failedLoginAttempts,
          current_login_datetime: prismaUser.currentLoginDatetime?.toISOString() ?? null,
          successful_login_attempts: prismaUser.successfulLoginAttempts,
          version: prismaUser.version,
        }
      : null;
    const error = null;

    // Same response shape whether user doesn't exist or password is wrong (anti-enumeration)
    const invalid = () => {
      RateLimitService.record({
        email: body.email,
        clientCode: body.clientCode,
        ipAddress: ip(req),
        userAgent: ua(req),
        success: false,
        failureReason: user ? 'invalid_password' : 'unknown_user',
      });
      AuditService.logLoginFailure({
        organizationId: tenant.id,
        email: body.email,
        reason: user ? 'invalid_password' : 'unknown_user',
        ipAddress: ip(req),
        userAgent: ua(req),
      });
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    };

    if (error || !user) return invalid();
    if (user.deleted_at) return invalid();
    if (user.is_active === false) return invalid();
    if (prismaUser.statusValue?.toLowerCase() === 'suspended') {
      throw new AppError('Account suspended. Contact your administrator.', 403, 'ACCOUNT_SUSPENDED');
    }
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new AppError('Account is locked. Try again later.', 423, 'ACCOUNT_LOCKED');
    }

    // 4. Verify password
    const ok = await PasswordService.verify(body.password, user.password_hash ?? '');
    if (!ok) return invalid();

    // 5. Enforce org-level 2FA policy
    if (tenant.enforce2fa && !user.mfa_enabled) {
      throw new AppError(
        'This organization requires two-factor authentication.',
        403,
        'MFA_REQUIRED_BY_ORG'
      );
    }

    // 6. Issue MFA challenge if user has 2FA enabled
    if (user.mfa_enabled) {
      const mfaToken = newMfaToken();
      const mfaMethod: 'totp' | 'email_otp' | 'sms' =
        prismaUser.mfaMethod === 'email_otp' || prismaUser.mfaMethod === 'sms'
          ? prismaUser.mfaMethod
          : 'totp';

      // Email/SMS OTP MFA — generate a one-time code and deliver it.
      if (mfaMethod !== 'totp') {
        const code = crypto.randomInt(100000, 1000000).toString();
        const target = mfaMethod === 'email_otp' ? user.email : (prismaUser.mobile ?? user.email);
        await prisma.otp.create({
          data: {
            type: 'mfa',
            target,
            code,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            userId: user.id,
            ipAddress: ip(req),
            userAgent: ua(req),
          },
        });
        await addQueueJob(mfaMethod === 'email_otp' ? 'send-2fa-code' : 'send-sms-otp', {
          email: user.email,
          mobile: target,
          code,
          expiryMinutes: 5,
        });

        remember(mfaToken, { userId: user.id, organizationId: tenant.id, attempts: 0, method: mfaMethod });
        res.status(200).json({
          mfaRequired: true,
          mfaToken,
          mfaMethods: [mfaMethod],
        });
        return;
      }

      remember(mfaToken, { userId: user.id, organizationId: tenant.id, attempts: 0, method: 'totp' });
      res.status(200).json({
        mfaRequired: true,
        mfaToken,
        mfaMethods: ['totp', 'recovery_code'],
      });
      return;
    }

    // 7. Issue tokens + session
    const { sessionId } = await SessionService.create({
      userId: user.id,
      organizationId: tenant.id,
      ipAddress: ip(req),
      userAgent: ua(req),
      rememberMe: body.rememberMe,
    });
    const tokens = await TokenService.issue({
      userId: user.id,
      tenantId: tenant.id,
      role: user.role,
      email: user.email,
      sessionId,
      rememberMe: body.rememberMe,
    });

    // 8. Clear rate-limit counters on success
    await RateLimitService.clearForEmail(user.email);

    const currentLogin = new Date().toISOString();
    const lastLogin = user.current_login_datetime || null;
    const nextAttempts = (user.successful_login_attempts || 0) + 1;
    const nextVersion = (user.version || 1) + 1;

    await supabaseAdmin
      .from('users')
      .update({
        last_login_at: currentLogin,
        current_login_datetime: currentLogin,
        last_login_datetime: lastLogin,
        successful_login_attempts: nextAttempts,
        key_token: tokens.accessToken,
        msg: 'Success',
        status_value: 'ACTIVE',
        status_description: 'Logged in successfully',
        version: nextVersion,
        failed_login_attempts: 0,
        locked_until: null,
      })
      .eq('id', user.id);

    // 9. Audit
    await AuditService.log({
      organizationId: tenant.id,
      actorId: user.id,
      action: 'login',
      ipAddress: ip(req),
      userAgent: ua(req),
      requestId: req.headers['x-request-id'] as string,
    });

    res.json({
      mfaRequired: false,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        mfaEnabled: user.mfa_enabled,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        clientCode: tenant.clientCode,
        logoUrl: tenant.logoUrl,
      },
      defaultLandingPage: prismaUser.defaultLandingPage ?? '/dashboard',
      currentLoginDatetime: currentLogin,
      lastLoginDatetime: lastLogin,
      successfulLoginAttempts: nextAttempts,
      keyToken: tokens.accessToken,
      msg: 'Success',
      statusValue: 'ACTIVE',
      statusDescription: 'Logged in successfully',
      version: nextVersion,
      userName: user.email,
      ...tokens,
    });
  } catch (e) {
    next(e);
  }
});

// ----------------------------------------------------------------------------
// POST /auth/login/mfa  —  submit TOTP or recovery code
// ----------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/auth/login/mfa:
 *   post:
 *     summary: completeMFAChallenge
 *     description: Submit a TOTP code or recovery code to finalize login after an MFA challenge.
 *     tags: [auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mfaToken, code]
 *             properties:
 *               mfaToken:
 *                 type: string
 *                 format: uuid
 *                 description: Opaque token returned by POST /auth/login when MFA is required
 *               code:
 *                 type: string
 *                 description: 6-digit TOTP or alphanumeric recovery code
 *               rememberMe:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: MFA verified — tokens issued
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid or expired MFA code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Too many MFA attempts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login/mfa', async (req, res, next) => {
  try {
    const body = LoginMfaSchema.parse(req.body);
    const challenge = consumeMfa(body.mfaToken);
    if (!challenge)
      throw new AppError(
        'MFA challenge expired. Please log in again.',
        401,
        'MFA_CHALLENGE_EXPIRED'
      );
    if (challenge.attempts >= 5) {
      mfaChallenges.delete(body.mfaToken);
      throw new AppError('Too many MFA attempts', 429, 'MFA_TOO_MANY_ATTEMPTS');
    }
    challenge.attempts++;

    // Verify the code against the challenge's method:
    //  - email_otp / sms  → one-time code from the otps table
    //  - totp / recovery  → authenticator TOTP or recovery code
    let ok: boolean;
    let isRecovery = false;
    if (challenge.method === 'email_otp' || challenge.method === 'sms') {
      const otpRow = await prisma.otp.findFirst({
        where: {
          type: 'mfa',
          userId: challenge.userId,
          code: body.code,
          verified: false,
          expiresAt: { gte: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });
      ok = !!otpRow;
      if (otpRow) {
        await prisma.otp.update({ where: { id: otpRow.id }, data: { verified: true } });
      }
    } else {
      isRecovery = /[a-zA-Z]/.test(body.code);
      ok = isRecovery
        ? await MfaService.verifyRecoveryCode(challenge.userId, body.code)
        : (await MfaService.verifyTotp(challenge.userId, body.code)).valid;
    }

    if (!ok) {
      await AuditService.logLoginFailure({
        organizationId: challenge.organizationId,
        email: '',
        reason: 'mfa_failed',
        ipAddress: ip(req),
        userAgent: ua(req),
      });
      throw new AppError('Invalid verification code', 401, 'MFA_INVALID_CODE');
    }
    mfaChallenges.delete(body.mfaToken);

    // Load user, finish login
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, role, mfa_enabled')
      .eq('id', challenge.userId)
      .single();

    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    const prismaMfaUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (prismaMfaUser?.statusValue?.toLowerCase() === 'suspended') {
      throw new AppError('Account suspended. Contact your administrator.', 403, 'ACCOUNT_SUSPENDED');
    }

    const { sessionId } = await SessionService.create({
      userId: user.id,
      organizationId: challenge.organizationId,
      ipAddress: ip(req),
      userAgent: ua(req),
      rememberMe: body.rememberMe,
    });
    const tokens = await TokenService.issue({
      userId: user.id,
      tenantId: challenge.organizationId,
      role: user.role,
      email: user.email,
      sessionId,
      rememberMe: body.rememberMe,
    });

    await supabaseAdmin
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    if (isRecovery) {
      await AuditService.log({
        organizationId: challenge.organizationId,
        actorId: user.id,
        action: 'mfa_recovery_used',
        ipAddress: ip(req),
        userAgent: ua(req),
      });
    }

    const tenant = await TenantService.getById(challenge.organizationId);

    res.json({
      mfaRequired: false,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        mfaEnabled: user.mfa_enabled,
      },
      tenant: tenant && {
        id: tenant.id,
        name: tenant.name,
        clientCode: tenant.clientCode,
        logoUrl: tenant.logoUrl,
      },
      defaultLandingPage: prismaMfaUser?.defaultLandingPage ?? '/dashboard',
      ...tokens,
    });
  } catch (e) {
    next(e);
  }
});

// ----------------------------------------------------------------------------
// POST /auth/refresh
// ----------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: rotateAccessAndRefreshTokens
 *     tags: [auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: New token pair
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenPair'
 *       401:
 *         description: Invalid or reused refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = RefreshSchema.parse(req.body);
    const claims = TokenService.verifyRefresh(refreshToken);
    const hash = TokenService.hashRefresh(refreshToken);
    const session = await SessionService.findByRefreshTokenHash(hash);

    if (session.id !== claims.sid) {
      // Token from a different session than its claims say — kill family.
      await supabaseAdmin
        .from('sessions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('refresh_token_family', session.refresh_token_family)
        .is('revoked_at', null);
      throw new AppError('Refresh token session mismatch', 401, 'REFRESH_TOKEN_REUSE');
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, email, role, tenant_id')
      .eq('id', session.user_id)
      .single();
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    const role = await TenantService.assertMembership(user.id, user.tenant_id);
    const tokens = await TokenService.issue({
      userId: user.id,
      tenantId: user.tenant_id,
      role,
      email: user.email,
      sessionId: session.id,
      family: session.refresh_token_family ?? undefined,
    });

    res.json(tokens);
  } catch (e) {
    next(e);
  }
});

// ----------------------------------------------------------------------------
// POST /auth/logout
// ----------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: revokeCurrentSession
 *     tags: [auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Session revoked
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OkResponse'
 *       401:
 *         description: Unauthorized
 */
router.post('/logout', authenticate, async (req: AuthRequest, res, next) => {
  try {
    if (!req.sessionId || !req.tokenClaims) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    await SessionService.revoke(req.sessionId);
    await TokenService.revokeAccess(
      req.tokenClaims.jti,
      req.userId!,
      'logout',
      new Date(req.tokenClaims.exp * 1000)
    );
    await AuditService.log({
      organizationId: req.tenantId!,
      actorId: req.userId!,
      action: 'logout',
      ipAddress: req.ipAddress,
      userAgent: req.userAgent,
      requestId: req.requestId,
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ----------------------------------------------------------------------------
// POST /auth/logout-all
// ----------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/auth/logout-all:
 *   post:
 *     summary: revokeAllSessionsForTheCurrentUser
 *     tags: [auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: All sessions revoked
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OkResponse'
 *       401:
 *         description: Unauthorized
 */
router.post('/logout-all', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await TokenService.revokeAllForUser(req.userId!);
    await AuditService.log({
      organizationId: req.tenantId!,
      actorId: req.userId!,
      action: 'all_sessions_revoked',
      severity: 'warn',
      ipAddress: req.ipAddress,
      userAgent: req.userAgent,
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ----------------------------------------------------------------------------
// GET /auth/me
// ----------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: getCurrentUserProfileWithPermissionsAndMenu
 *     tags: [auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Current user info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 tenant:
 *                   $ref: '#/components/schemas/Tenant'
 *                 permissions:
 *                   type: array
 *                   items:
 *                     type: string
  *                 menu:
  *                   type: array
  *                   items:
  *                     $ref: '#/components/schemas/MenuItem'
  *       401:
  *         description: Unauthorized
  */
router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { data: user } = await supabaseAdmin
      .from('users')
      .select(
        'id, email, full_name, role, mfa_enabled, mfa_enrolled_at, avatar_url, last_login_at, created_at'
      )
      .eq('id', req.userId!)
      .single();
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    const [tenant, permissions, menu] = await Promise.all([
      TenantService.getById(req.tenantId!),
      PermissionService.loadForUser(req.userId!, req.tenantId!),
      MenuService.loadForUser(req.userId!, req.tenantId!),
    ]);
    if (!tenant) throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        avatarUrl: user.avatar_url,
        role: user.role,
        mfaEnabled: user.mfa_enabled,
        mfaEnrolledAt: user.mfa_enrolled_at,
        lastLoginAt: user.last_login_at,
        createdAt: user.created_at,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        clientCode: tenant.clientCode,
        logoUrl: tenant.logoUrl,
        plan: tenant.plan,
        enforce2fa: tenant.enforce2fa,
      },
      permissions: Array.from(permissions),
      menu,
    });
  } catch (e) {
    next(e);
  }
});

// ----------------------------------------------------------------------------
// GET /auth/tenants
// ----------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/auth/tenants:
 *   get:
 *     summary: listTenantsTheCurrentUserBelongsTo
 *     tags: [auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of tenants
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tenants:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Tenant'
 *       401:
 *         description: Unauthorized
 */
router.get('/tenants', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const tenants = await TenantService.listForUser(req.userId!);
    res.json({ tenants });
  } catch (e) {
    next(e);
  }
});

// ----------------------------------------------------------------------------
// POST /auth/switch-tenant
// ----------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/auth/switch-tenant:
 *   post:
 *     summary: switchToADifferentTenantAndGetFreshTokens
 *     tags: [auth]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [organizationId]
 *             properties:
 *               organizationId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Switched tenant — new token pair
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/TokenPair'
 *                 - type: object
 *                   properties:
 *                     tenant:
 *                       $ref: '#/components/schemas/Tenant'
 *       403:
 *         description: User is not a member of the target tenant
 */
router.post('/switch-tenant', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { organizationId } = SwitchTenantSchema.parse(req.body);
    const role = await TenantService.assertMembership(req.userId!, organizationId);
    const tenant = await TenantService.getById(organizationId);
    if (!tenant) throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');

    // New session bound to the new tenant (old session is NOT revoked —
    // a user can be logged into multiple tenants).
    const { sessionId } = await SessionService.create({
      userId: req.userId!,
      organizationId,
      ipAddress: ip(req),
      userAgent: ua(req),
    });
    const tokens = await TokenService.issue({
      userId: req.userId!,
      tenantId: organizationId,
      role,
      email: req.userEmail!,
      sessionId,
    });

    await AuditService.log({
      organizationId,
      actorId: req.userId!,
      action: 'tenant_switched',
      ipAddress: ip(req),
      userAgent: ua(req),
    });

    res.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        clientCode: tenant.clientCode,
        logoUrl: tenant.logoUrl,
      },
      ...tokens,
    });
  } catch (e) {
    next(e);
  }
});

// ----------------------------------------------------------------------------
// POST /auth/change-password
// ----------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/auth/change-password:
 *   post:
 *     summary: changePasswordAuthenticated
 *     tags: [auth]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 12
 *     responses:
 *       200:
 *         description: Password changed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OkResponse'
 *       401:
 *         description: Current password incorrect
 */
router.post('/change-password', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { currentPassword, newPassword } = ChangePasswordSchema.parse(req.body);

    // Login verifies against the Prisma user, so use that as the source of truth.
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    const ok = await PasswordService.verify(currentPassword, user.passwordHash ?? '');
    if (!ok) throw new AppError('Current password is incorrect', 401, 'INVALID_CURRENT_PASSWORD');

    // Enforce "no reusing recent passwords" using the password history.
    const recent = await prisma.passwordHistory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    for (const entry of recent) {
      if (await PasswordService.verify(newPassword, entry.passwordHash)) {
        throw new AppError(
          'New password cannot match any of your last 5 passwords',
          400,
          'PASSWORD_REUSE'
        );
      }
    }

    const newHash = await PasswordService.hash(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash, passwordChangedAt: new Date() },
    });
    await prisma.passwordHistory.create({
      data: { userId: user.id, passwordHash: newHash },
    });
    // Keep the Supabase handshake row in sync.
    await supabaseAdmin
      .from('users')
      .update({
        password_hash: newHash,
        password_changed_at: new Date().toISOString(),
      })
      .eq('id', req.userId!);

    await AuditService.log({
      organizationId: req.tenantId!,
      actorId: req.userId!,
      action: 'password_change',
      severity: 'warn',
      ipAddress: req.ipAddress,
      userAgent: req.userAgent,
    });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ----------------------------------------------------------------------------
// POST /auth/forgot-password
// ----------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: sendPasswordResetEmail
 *     description: Always returns 200 to avoid email enumeration attacks.
 *     tags: [auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clientCode, email]
 *             properties:
 *               clientCode:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Reset link sent (if account exists)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.post('/forgot-password', async (req, res, next) => {
  try {
    const body = ForgotPasswordSchema.parse(req.body);
    const tenant = await TenantService.resolveByClientCode(body.clientCode);

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('email', body.email.toLowerCase())
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    // Always return 200 to avoid email enumeration
    if (user) {
      const token = crypto.randomUUID();
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await supabaseAdmin.from('password_reset_tokens').insert({
        user_id: user.id,
        token_hash: tokenHash,
        email: user.email,
        expires_at: new Date(
          Date.now() + config.passwordResetTokenExpiryMinutes * 60 * 1000
        ).toISOString(),
      });
      // Queue the reset email (falls back to console logging when email/queue is unavailable).
      const baseUrl = req.get('origin') ?? `https://${req.get('host') ?? 'zcc-backend.vercel.app'}`;
      const resetLink = `${baseUrl}/reset-password?token=${token}`;
      await addQueueJob('send-password-reset', {
        email: user.email,
        resetLink,
        expiryHours: Math.max(config.passwordResetTokenExpiryMinutes / 60, 1),
      });

      await AuditService.log({
        organizationId: tenant.id,
        actorId: user.id,
        action: 'password_reset_requested',
        ipAddress: ip(req),
        userAgent: ua(req),
      });
    }

    res.json({ ok: true, message: 'If an account exists, a reset link has been sent.' });
  } catch (e) {
    next(e);
  }
});

// ----------------------------------------------------------------------------
// POST /auth/reset-password
// ----------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/auth/reset-password:
 *   post:
 *     summary: applyNewPasswordUsingAResetToken
 *     tags: [resetPassword]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 12
 *     responses:
 *       200:
 *         description: Password reset successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OkResponse'
 *       400:
 *         description: Invalid or expired token
 */
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = ResetPasswordSchema.parse(req.body);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const { data: row } = await supabaseAdmin
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
      throw new AppError('Invalid or expired token', 400, 'INVALID_RESET_TOKEN');
    }
    const newHash = await PasswordService.hash(newPassword);
    await supabaseAdmin
      .from('users')
      .update({ password_hash: newHash, password_changed_at: new Date().toISOString() })
      .eq('id', row.user_id);
    // Login verifies against the Prisma user, so keep both stores in sync.
    await prisma.user.update({
      where: { id: row.user_id },
      data: { passwordHash: newHash, passwordChangedAt: new Date() },
    });
    await supabaseAdmin
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', row.id);
    // Invalidate all sessions for the user (force re-login everywhere)
    await TokenService.revokeAllForUser(row.user_id);

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ----------------------------------------------------------------------------
// MFA endpoints
// ----------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/auth/mfa/enroll:
 *   post:
 *     summary: startTOTPEnrollmentReturnsQRCodeAndOtpauthURI
 *     tags: [auth]
 *     security:
 *       - BearerAuth: []
  *     responses:
  *       200:
  *         description: Enrollment started
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 otpauth:
  *                   type: string
  *                 qrCodeDataUrl:
  *                   type: string
  *                 secret:
  *                   type: string
  */
router.post('/mfa/enroll', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const tenant = await TenantService.getById(req.tenantId!);
    if (!tenant) throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', req.userId!)
      .single();
    const enrollment = await MfaService.startEnrollment(req.userId!, user!.email, tenant.name);
    // Stash the secret temporarily so /confirm can re-use it.
    pendingMfaSecrets.set(req.userId!, enrollment.secret);
    res.json({
      otpauth: enrollment.otpauth,
      qrCodeDataUrl: enrollment.qrCodeDataUrl,
      secret: enrollment.secret, // needed by the client to complete /confirm
    });
  } catch (e) {
    next(e);
  }
});

const pendingMfaSecrets = new Map<string, string>(); // userId -> secret (5 min TTL)

/**
 * @swagger
 * /api/v1/auth/mfa/confirm:
 *   post:
 *     summary: confirmTOTPEnrollmentWithTheFirstCode
 *     tags: [auth]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [secret, code]
 *             properties:
 *               secret:
 *                 type: string
 *               code:
 *                 type: string
 *                 pattern: '^\\d{6}$'
 *     responses:
 *       200:
 *         description: MFA enrolled — recovery codes returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 recoveryCodes:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Enrollment expired or invalid code
 */
router.post('/mfa/confirm', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { secret, code } = MfaEnrollConfirmSchema.parse(req.body);
    const expected = pendingMfaSecrets.get(req.userId!);
    if (!expected || expected !== secret) {
      throw new AppError('Enrollment expired. Please start again.', 400, 'MFA_ENROLLMENT_EXPIRED');
    }
    const { recoveryCodes } = await MfaService.confirmEnrollment({
      userId: req.userId!,
      secret,
      code,
    });
    pendingMfaSecrets.delete(req.userId!);
    await AuditService.log({
      organizationId: req.tenantId!,
      actorId: req.userId!,
      action: 'mfa_enrolled',
      severity: 'warn',
      ipAddress: req.ipAddress,
      userAgent: req.userAgent,
    });
    res.json({ ok: true, recoveryCodes });
  } catch (e) {
    next(e);
  }
});

/**
 * @swagger
 * /api/v1/auth/mfa/disable:
 *   post:
 *     summary: disableMFARequiresCurrentPassword
 *     tags: [auth]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: MFA disabled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OkResponse'
 *       401:
 *         description: Password incorrect
 */
router.post('/mfa/disable', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { password } = z.object({ password: z.string().min(1) }).parse(req.body);
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('password_hash')
      .eq('id', req.userId!)
      .single();
    const ok = await PasswordService.verify(password, user?.password_hash ?? '');
    if (!ok) throw new AppError('Password incorrect', 401, 'INVALID_PASSWORD');

    await MfaService.disable(req.userId!);
    await AuditService.log({
      organizationId: req.tenantId!,
      actorId: req.userId!,
      action: 'mfa_disabled',
      severity: 'critical',
      ipAddress: req.ipAddress,
      userAgent: req.userAgent,
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/**
 * @swagger
 * /api/v1/auth/mfa/recovery-codes:
 *   post:
 *     summary: regenerateMFARecoveryCodes
 *     tags: [auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: New recovery codes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 recoveryCodes:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.post(
  '/mfa/recovery-codes',
  authenticate,
  requirePermission('settings:manage'),
  async (req: AuthRequest, res, next) => {
    try {
      const codes = await MfaService.regenerateRecoveryCodes(req.userId!);
      res.json({ recoveryCodes: codes });
    } catch (e) {
      next(e);
    }
  }
);

// ----------------------------------------------------------------------------
// OAuth Social Sign-In (Google, Microsoft, GitHub)
// ----------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/auth/oauth/{provider}:
 *   get:
 *     summary: initiateOAuthSignInRedirectsToTheIdentityProvider
 *     tags: [auth]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [google, github, microsoft]
 *     responses:
 *       302:
 *         description: Redirect to the identity provider
 *       400:
 *         description: Failed to initiate OAuth
 */
router.get('/oauth/:provider', async (req, res, next) => {
  try {
    const provider = req.params.provider;
    // Map provider names if necessary (e.g. microsoft -> azure)
    const supabaseProvider = provider === 'microsoft' ? 'azure' : provider;

    const redirectUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/oauth/callback`;

    // Create Supabase Anon client for sign-in redirection URL generation
    const { supabaseAnon } = await import('../config/supabase');
    const { data, error } = await supabaseAnon.auth.signInWithOAuth({
      provider: supabaseProvider as any,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error || !data?.url) {
      throw new AppError(
        error?.message || 'Failed to initiate OAuth',
        400,
        'OAUTH_INITIATION_FAILED'
      );
    }

    res.redirect(data.url);
  } catch (e) {
    next(e);
  }
});

/**
 * @swagger
 * /api/v1/auth/oauth/callback:
 *   get:
 *     summary: handleOAuthCallbackRedirectsBackToTheFrontendWithTokens
 *     tags: [auth]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: Redirect to the frontend with accessToken/refreshToken or an error
 */
router.get('/oauth/callback', async (req, res, next) => {
  try {
    const code = req.query.code as string;
    const frontendUrl = config.corsOrigins[0] || 'http://localhost:4200';

    if (!code) {
      return res.redirect(`${frontendUrl}/#/auth/login?error=OAUTH_CODE_MISSING`);
    }

    const { supabaseAnon } = await import('../config/supabase');
    const { data: sessionData, error } = await supabaseAnon.auth.exchangeCodeForSession(code);

    if (error || !sessionData?.user?.email) {
      return res.redirect(`${frontendUrl}/#/auth/login?error=OAUTH_EXCHANGE_FAILED`);
    }

    const email = sessionData.user.email.toLowerCase();

    // Look up the user in our custom database
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, role, tenant_id, is_active, deleted_at')
      .eq('email', email)
      .maybeSingle();

    if (userError || !user || user.deleted_at || user.is_active === false) {
      return res.redirect(`${frontendUrl}/#/auth/login?error=USER_NOT_FOUND`);
    }

    // Create session and issue ZCC tokens
    const { sessionId } = await SessionService.create({
      userId: user.id,
      organizationId: user.tenant_id,
      ipAddress: ip(req),
      userAgent: ua(req),
    });

    const tokens = await TokenService.issue({
      userId: user.id,
      tenantId: user.tenant_id,
      role: user.role,
      email: user.email,
      sessionId,
    });

    // Update user login audit metadata
    await supabaseAdmin
      .from('users')
      .update({
        last_login_at: new Date().toISOString(),
        failed_login_attempts: 0,
        locked_until: null,
      })
      .eq('id', user.id);

    // Audit
    await AuditService.log({
      organizationId: user.tenant_id,
      actorId: user.id,
      action: 'login',
      ipAddress: ip(req),
      userAgent: ua(req),
      requestId: (req.headers['x-request-id'] as string) || crypto.randomUUID(),
    });

    // Redirect to Angular app with credentials
    res.redirect(
      `${frontendUrl}/#/auth/login?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`
    );
  } catch (e) {
    next(e);
  }
});

// ----------------------------------------------------------------------------
// GET /auth/sessions — List all active sessions for the authenticated user
// ----------------------------------------------------------------------------
/**
 * @swagger
 * /api/v1/auth/sessions:
 *   get:
 *     summary: listAllActiveSessionsForTheAuthenticatedUser
 *     tags: [auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of active sessions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     sessions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           deviceName:
 *                             type: string
 *                           browser:
 *                             type: string
 *                           os:
 *                             type: string
 *                           ipAddress:
 *                             type: string
 *                           country:
 *                             type: string
 *                           lastLogin:
 *                             type: string
 *                             format: date-time
 *                           loginTime:
 *                             type: string
 *                             format: date-time
 *                           isCurrent:
 *                             type: boolean
 *       401:
 *         description: Unauthorized
 */
router.get('/sessions', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;
    const rows = await SessionService.listForUser(userId);

    res.json({
      success: true,
      data: {
        sessions: rows.map((s) => ({
          id: s.id,
          deviceName: s.device_fingerprint || 'Unknown Device',
          browser: parseBrowser(s.user_agent),
          os: parseOs(s.user_agent),
          ipAddress: s.ip_address || 'Unknown',
          country: '',
          lastLogin: s.last_activity_at,
          loginTime: s.created_at,
          isCurrent: s.id === req.sessionId,
        })),
      },
    });
  } catch (e) {
    next(e);
  }
});

// ----------------------------------------------------------------------------
// DELETE /auth/sessions/:sessionId — Revoke a specific session
// ----------------------------------------------------------------------------
/**
 * @swagger
 * /api/v1/auth/sessions/{sessionId}:
 *   delete:
 *     summary: revokeASpecificSession
 *     tags: [auth]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Session revoked
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
router.delete('/sessions/:sessionId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;
    const { sessionId } = req.params;

    await SessionService.revoke(sessionId);

    await AuditService.log({
      organizationId: req.tenantId!,
      actorId: userId,
      action: 'session_revoked',
      metadata: { sessionId },
      ipAddress: ip(req),
      userAgent: ua(req),
      requestId: (req.headers['x-request-id'] as string) || crypto.randomUUID(),
    });

    res.json({ success: true, message: 'Session revoked successfully' });
  } catch (e) {
    next(e);
  }
});

// ----------------------------------------------------------------------------
// DELETE /auth/sessions — Revoke all sessions except the current one
// ----------------------------------------------------------------------------
/**
 * @swagger
 * /api/v1/auth/sessions:
 *   delete:
 *     summary: revokeAllSessionsExceptTheCurrentOne
 *     tags: [auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: All other sessions revoked
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
router.delete('/sessions', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;
    const currentSessionId = req.sessionId;

    const { data: sessions, error } = await supabaseAdmin
      .from('sessions')
      .select('id')
      .eq('user_id', userId)
      .is('revoked_at', null);

    if (error) throw new AppError('Failed to revoke sessions', 500, 'SESSION_REVOKE_ALL_FAILED');

    const others = (sessions ?? [])
      .filter((s: any) => s.id !== currentSessionId)
      .map((s: any) => s.id);

    if (others.length) {
      await supabaseAdmin
        .from('sessions')
        .update({ revoked_at: new Date().toISOString() })
        .in('id', others);
    }

    await AuditService.log({
      organizationId: req.tenantId!,
      actorId: userId,
      action: 'all_sessions_revoked',
      ipAddress: ip(req),
      userAgent: ua(req),
      requestId: (req.headers['x-request-id'] as string) || crypto.randomUUID(),
    });

    res.json({ success: true, message: 'All other sessions revoked' });
  } catch (e) {
    next(e);
  }
});

// ----------------------------------------------------------------------------
// POST /auth/send-verification — Send email verification OTP/link
// ----------------------------------------------------------------------------
const SendVerificationSchema = z.object({
  email: z.string().email(),
});

/**
 * @swagger
 * /api/v1/auth/send-verification:
 *   post:
 *     summary: sendOrResendEmailVerificationCode
 *     tags: [auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Verification code sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       429:
 *         description: Too many requests
 */
router.post('/send-verification', async (req, res, next) => {
  try {
    const { email } = SendVerificationSchema.parse(req.body);
    const normalized = email.toLowerCase();

    // Prisma user is the source of truth (mirrored to Supabase on registration).
    const user = await prisma.user.findUnique({ where: { email: normalized } });

    if (!user || user.emailVerified) {
      // Return success even if not found to prevent email enumeration.
      res.json({
        success: true,
        message: 'If this email exists, a verification code has been sent.',
      });
      return;
    }

    // Rate-limit OTP sends per address (3 per minute).
    const recentOtps = await prisma.otp.count({
      where: {
        type: 'email_verification',
        target: normalized,
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
    });
    if (recentOtps >= 3) {
      throw new AppError('Too many requests. Please wait before trying again.', 429, 'RATE_LIMITED');
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    await prisma.otp.create({
      data: {
        type: 'email_verification',
        target: normalized,
        code: otp,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        userId: user.id,
        ipAddress: ip(req),
        userAgent: ua(req),
      },
    });

    await addQueueJob('send-registration-otp', {
      email: normalized,
      code: otp,
      type: 'email_verification',
    });

    res.json({ success: true, message: 'Verification code sent to your email.' });
  } catch (e) {
    next(e);
  }
});

// ----------------------------------------------------------------------------
// POST /auth/verify-email — Verify email via token or OTP code
// ----------------------------------------------------------------------------
const VerifyEmailSchema = z.object({
  token: z.string().optional(),
  otp: z.string().optional(),
  email: z.string().email().optional(),
});

/**
 * @swagger
 * /api/v1/auth/verify-email:
 *   post:
 *     summary: verifyEmailWithATokenOrOtpCode
 *     tags: [auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *               otp:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Email verified
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid or expired code/token
 */
router.post('/verify-email', async (req, res, next) => {
  try {
    const { token, otp, email } = VerifyEmailSchema.parse(req.body);

    if (!token && !otp) {
      throw new AppError('Either a token or OTP is required', 400, 'MISSING_VERIFICATION');
    }

    let userId: string | null = null;

    if (otp) {
      // OTP-based verification (stored in the shared otps table).
      const otpRow = await prisma.otp.findFirst({
        where: {
          type: 'email_verification',
          code: otp,
          verified: false,
          expiresAt: { gte: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!otpRow) throw new AppError('Invalid or expired verification code', 400, 'INVALID_OTP');

      userId = otpRow.userId;
      await prisma.otp.update({ where: { id: otpRow.id }, data: { verified: true } });
    } else if (token) {
      // Token-based verification (from an email link).
      const row = await prisma.emailVerification.findFirst({
        where: { token, verified: false, expiresAt: { gte: new Date() } },
      });

      if (!row) throw new AppError('Invalid or expired verification token', 400, 'INVALID_TOKEN');

      userId = row.userId;
      await prisma.emailVerification.update({
        where: { id: row.id },
        data: { verified: true, verifiedAt: new Date() },
      });
    }

    if (!userId) throw new AppError('Verification failed', 400, 'VERIFICATION_FAILED');

    // Mark the user verified in both stores.
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    });
    await supabaseAdmin
      .from('users')
      .update({ email_verified: true, email_verified_at: new Date().toISOString() })
      .eq('id', userId);

    res.json({ success: true, message: 'Email verified successfully.' });
  } catch (e) {
    next(e);
  }
});

// ----------------------------------------------------------------------------
// POST /auth/resend-otp — Resend verification OTP
// ----------------------------------------------------------------------------
/**
 * @swagger
 * /api/v1/auth/resend-otp:
 *   post:
 *     summary: resendEmailVerificationOtp
 *     tags: [auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: OTP resent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.post('/resend-otp', async (req, res, next) => {
  try {
    const { email } = SendVerificationSchema.parse(req.body);
    const normalized = email.toLowerCase();

    const user = await prisma.user.findUnique({ where: { email: normalized } });

    if (!user || user.emailVerified) {
      res.json({
        success: true,
        message: 'If this email exists and is unverified, a new code has been sent.',
      });
      return;
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    await prisma.otp.create({
      data: {
        type: 'email_verification',
        target: normalized,
        code: otp,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        userId: user.id,
        ipAddress: ip(req),
        userAgent: ua(req),
      },
    });

    await addQueueJob('send-registration-otp', {
      email: normalized,
      code: otp,
      type: 'email_verification',
    });

    res.json({ success: true, message: 'Verification code resent to your email.' });
  } catch (e) {
    next(e);
  }
});

export default router;
