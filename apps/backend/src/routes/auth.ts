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
import crypto from 'crypto';
import { z } from 'zod';
import { config } from '../config/env';
import { supabase, supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/error';
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
  clientCode: z.string().min(2).max(16).regex(/^[A-Za-z0-9-]+$/),
});

const LoginSchema = z.object({
  clientCode: z.string().min(2).max(16).regex(/^[A-Za-z0-9-]+$/),
  email: z.string().email().max(255),
  password: z.string().min(1).max(128), // policy checked on hash
  rememberMe: z.boolean().optional(),
});

const LoginMfaSchema = z.object({
  mfaToken: z.string().uuid(),             // opaque token returned by /login when MFA is required
  code: z.string().min(6).max(20),         // TOTP (6 digits) or recovery code
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
  ((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? '0.0.0.0');
const ua = (req: any) => (req.headers['user-agent'] as string) ?? 'unknown';

// In-memory store for short-lived MFA challenges (use Redis in production).
// Key: mfaToken, Value: { userId, organizationId, attempts, expiresAt }
const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const mfaChallenges = new Map<string, { userId: string; organizationId: string; attempts: number; expiresAt: number }>();
const newMfaToken = () => crypto.randomUUID();
const remember = (token: string, value: Omit<NonNullable<ReturnType<typeof consumeMfa>>, 'expiresAt'>) => {
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
 *     summary: Validate a client/tenant code
 *     tags: [Auth]
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
 *     summary: Retrieve temporary AES key and IV for payload encryption
 *     tags: [Auth]
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
    res.json([
      key.toString('binary'),
      iv.toString('binary'),
    ]);
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
 *     summary: Login with email and password
 *     description: Returns tokens on success, or an MFA challenge token if the user has 2FA enabled.
 *     tags: [Login]
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
    let loginData = { ...req.body };
    if (loginData.keyToken && Array.isArray(loginData.keyToken)) {
      try {
        const keyToken = loginData.keyToken;
        if (keyToken.length === 2) {
          const aesKey = Buffer.from(keyToken[0], 'binary');
          const aesIv = Buffer.from(keyToken[1], 'binary');

          const decryptAes = (cipherText: string) => {
            const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, aesIv);
            let decrypted = decipher.update(cipherText, 'base64', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
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

    // 1. Rate-limit the IP
    await RateLimitService.assertIpAllowed(ip(req));

    // 2. Resolve tenant by client code
    const tenant = await TenantService.resolveByClientCode(body.clientCode);

    // 3. Find user in this tenant
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, role, password_hash, mfa_enabled, is_active, deleted_at, locked_until, failed_login_attempts')
      .eq('email', body.email.toLowerCase())
      .eq('tenant_id', tenant.id)
      .maybeSingle();

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
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new AppError('Account is locked. Try again later.', 423, 'ACCOUNT_LOCKED');
    }

    // 4. Verify password
    const ok = await PasswordService.verify(body.password, user.password_hash ?? '');
    if (!ok) return invalid();

    // 5. Enforce org-level 2FA policy
    if (tenant.enforce2fa && !user.mfa_enabled) {
      throw new AppError('This organization requires two-factor authentication.', 403, 'MFA_REQUIRED_BY_ORG');
    }

    // 6. Issue MFA challenge if user has 2FA enabled
    if (user.mfa_enabled) {
      const mfaToken = newMfaToken();
      remember(mfaToken, { userId: user.id, organizationId: tenant.id, attempts: 0 });
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
    await supabaseAdmin
      .from('users')
      .update({
        last_login_at: new Date().toISOString(),
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
      user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role, mfaEnabled: user.mfa_enabled },
      tenant: { id: tenant.id, name: tenant.name, clientCode: tenant.clientCode, logoUrl: tenant.logoUrl },
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
 *     summary: Complete MFA challenge
 *     description: Submit a TOTP code or recovery code to finalize login after an MFA challenge.
 *     tags: [Auth]
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
    if (!challenge) throw new AppError('MFA challenge expired. Please log in again.', 401, 'MFA_CHALLENGE_EXPIRED');
    if (challenge.attempts >= 5) {
      mfaChallenges.delete(body.mfaToken);
      throw new AppError('Too many MFA attempts', 429, 'MFA_TOO_MANY_ATTEMPTS');
    }
    challenge.attempts++;

    const isRecovery = /[a-zA-Z]/.test(body.code);
    const ok = isRecovery
      ? await MfaService.verifyRecoveryCode(challenge.userId, body.code)
      : (await MfaService.verifyTotp(challenge.userId, body.code)).valid;

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
      user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role, mfaEnabled: user.mfa_enabled },
      tenant: tenant && {
        id: tenant.id, name: tenant.name, clientCode: tenant.clientCode, logoUrl: tenant.logoUrl,
      },
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
 *     summary: Rotate access and refresh tokens
 *     tags: [Auth]
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
 *     summary: Revoke current session
 *     tags: [Auth]
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
 *     summary: Revoke all sessions for the current user
 *     tags: [Auth]
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
 *     summary: Get current user profile with permissions and menu
 *     tags: [Auth]
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
 *                     type: object
 *       401:
 *         description: Unauthorized
 */
router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, role, mfa_enabled, mfa_enrolled_at, avatar_url, last_login_at, created_at')
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
 *     summary: List tenants the current user belongs to
 *     tags: [Auth]
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
 *     summary: Switch to a different tenant and get fresh tokens
 *     tags: [Auth]
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
      tenant: { id: tenant.id, name: tenant.name, clientCode: tenant.clientCode, logoUrl: tenant.logoUrl },
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
 *     summary: Change password (authenticated)
 *     tags: [Auth]
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
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('password_hash')
      .eq('id', req.userId!)
      .single();
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    const ok = await PasswordService.verify(currentPassword, user.password_hash ?? '');
    if (!ok) throw new AppError('Current password is incorrect', 401, 'INVALID_CURRENT_PASSWORD');

    const newHash = await PasswordService.hash(newPassword);
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
 *     summary: Send password reset email
 *     description: Always returns 200 to avoid email enumeration attacks.
 *     tags: [Auth]
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
        expires_at: new Date(Date.now() + config.passwordResetTokenExpiryMinutes * 60 * 1000).toISOString(),
      });
      // TODO: email the user. For now, log to console.
      // eslint-disable-next-line no-console
      console.log(`[password-reset] link for ${user.email}: /reset-password?token=${token}`);

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
 *     summary: Apply new password using a reset token
 *     tags: [ResetPassword]
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
 *     summary: Start TOTP enrollment — returns QR code and otpauth URI
 *     tags: [Auth]
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
 *     summary: Confirm TOTP enrollment with the first code
 *     tags: [Auth]
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
 *     summary: Disable MFA (requires current password)
 *     tags: [Auth]
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
 *     summary: Regenerate MFA recovery codes
 *     tags: [Auth]
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

export default router;
