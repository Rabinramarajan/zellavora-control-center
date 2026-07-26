import { Hono } from 'https://esm.sh/hono@3.11.8';
import { z } from 'npm:zod@3.22.4';
import { getSupabaseAdmin } from '../_shared/db.ts';
import { AppError, handleError } from '../_shared/errors.ts';
import { jsonResponse, errorResponse, corsResponse } from '../_shared/response.ts';
import { authenticate, PermissionService } from '../_shared/auth.ts';
import {
  TenantService,
  SessionService,
  AuditService,
  RateLimitService,
} from '../_shared/services.ts';
import { PasswordService } from '../_shared/password.ts';
import { TokenService } from '../_shared/token.ts';
import { MfaService } from '../_shared/mfa.ts';
import { MenuService } from '../_shared/menus.ts';

const app = new Hono();

// ----------------------------------------------------------------------------
// Middleware & CORS
// ----------------------------------------------------------------------------
app.options('*', () => corsResponse());

// Helper to extract IP and User Agent in Deno
const getClientMeta = (c: any) => {
  const req = c.req.raw;
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';
  const userAgent = req.headers.get('user-agent') ?? 'unknown';
  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();
  return { ipAddress, userAgent, requestId };
};

// ----------------------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------------------
const ValidateClientSchema = z.object({
  clientCode: z.string().min(2).max(16).regex(/^[A-Za-z0-9-]+$/),
});

const LoginSchema = z.object({
  clientCode: z.string().min(2).max(16).regex(/^[A-Za-z0-9-]+$/),
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
  rememberMe: z.boolean().optional(),
});

const LoginMfaSchema = z.object({
  mfaToken: z.string().uuid(),
  code: z.string().min(6).max(20),
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

// Short-lived in-memory MFA challenge stashing (matches Express)
const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const mfaChallenges = new Map<string, { userId: string; organizationId: string; attempts: number; expiresAt: number }>();
const pendingMfaSecrets = new Map<string, string>(); // userId -> secret

// ----------------------------------------------------------------------------
// Handlers
// ----------------------------------------------------------------------------

app.post('/validate-client', async (c) => {
  try {
    const body = await c.req.json();
    const { clientCode } = ValidateClientSchema.parse(body);
    const tenant = await TenantService.resolveByClientCode(clientCode);
    return jsonResponse({
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
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const data = LoginSchema.parse(body);
    const { ipAddress, userAgent, requestId } = getClientMeta(c);

    await RateLimitService.assertIpAllowed(ipAddress);
    const tenant = await TenantService.resolveByClientCode(data.clientCode);

    const admin = getSupabaseAdmin();
    const { data: user, error } = await admin
      .from('users')
      .select('id, email, full_name, role, password_hash, mfa_enabled, is_active, deleted_at, locked_until, failed_login_attempts')
      .eq('email', data.email.toLowerCase())
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    const invalid = () => {
      RateLimitService.record({
        email: data.email,
        clientCode: data.clientCode,
        ipAddress,
        userAgent,
        success: false,
        failureReason: user ? 'invalid_password' : 'unknown_user',
      });
      AuditService.logLoginFailure({
        organizationId: tenant.id,
        email: data.email,
        reason: user ? 'invalid_password' : 'unknown_user',
        ipAddress,
        userAgent,
      });
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    };

    if (error || !user) return invalid();
    if (user.deleted_at) return invalid();
    if (user.is_active === false) return invalid();
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new AppError('Account is locked. Try again later.', 423, 'ACCOUNT_LOCKED');
    }

    const ok = await PasswordService.verify(data.password, user.password_hash ?? '');
    if (!ok) return invalid();

    if (tenant.enforce2fa && !user.mfa_enabled) {
      throw new AppError('This organization requires two-factor authentication.', 403, 'MFA_REQUIRED_BY_ORG');
    }

    if (user.mfa_enabled) {
      const mfaToken = crypto.randomUUID();
      mfaChallenges.set(mfaToken, {
        userId: user.id,
        organizationId: tenant.id,
        attempts: 0,
        expiresAt: Date.now() + MFA_CHALLENGE_TTL_MS,
      });
      return jsonResponse({
        mfaRequired: true,
        mfaToken,
        mfaMethods: ['totp', 'recovery_code'],
      });
    }

    const { sessionId } = await SessionService.create({
      userId: user.id,
      organizationId: tenant.id,
      ipAddress,
      userAgent,
      rememberMe: data.rememberMe,
    });

    const tokens = await TokenService.issue({
      userId: user.id,
      tenantId: tenant.id,
      role: user.role,
      email: user.email,
      sessionId,
      rememberMe: data.rememberMe,
    });

    await RateLimitService.clearForEmail(user.email);
    await admin
      .from('users')
      .update({
        last_login_at: new Date().toISOString(),
        failed_login_attempts: 0,
        locked_until: null,
      })
      .eq('id', user.id);

    await AuditService.log({
      organizationId: tenant.id,
      actorId: user.id,
      action: 'login',
      ipAddress,
      userAgent,
      requestId,
    });

    return jsonResponse({
      mfaRequired: false,
      user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role, mfaEnabled: user.mfa_enabled },
      tenant: { id: tenant.id, name: tenant.name, clientCode: tenant.clientCode, logoUrl: tenant.logoUrl },
      ...tokens,
    });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.post('/login/mfa', async (c) => {
  try {
    const body = await c.req.json();
    const data = LoginMfaSchema.parse(body);
    const { ipAddress, userAgent } = getClientMeta(c);

    const challenge = mfaChallenges.get(data.mfaToken);
    if (!challenge || challenge.expiresAt < Date.now()) {
      mfaChallenges.delete(data.mfaToken);
      throw new AppError('MFA challenge expired. Please log in again.', 401, 'MFA_CHALLENGE_EXPIRED');
    }

    if (challenge.attempts >= 5) {
      mfaChallenges.delete(data.mfaToken);
      throw new AppError('Too many MFA attempts', 429, 'MFA_TOO_MANY_ATTEMPTS');
    }
    challenge.attempts++;

    const isRecovery = /[a-zA-Z]/.test(data.code);
    const ok = isRecovery
      ? await MfaService.verifyRecoveryCode(challenge.userId, data.code)
      : (await MfaService.verifyTotp(challenge.userId, data.code)).valid;

    if (!ok) {
      await AuditService.logLoginFailure({
        organizationId: challenge.organizationId,
        email: '',
        reason: 'mfa_failed',
        ipAddress,
        userAgent,
      });
      throw new AppError('Invalid verification code', 401, 'MFA_INVALID_CODE');
    }
    mfaChallenges.delete(data.mfaToken);

    const admin = getSupabaseAdmin();
    const { data: user } = await admin
      .from('users')
      .select('id, email, full_name, role, mfa_enabled')
      .eq('id', challenge.userId)
      .single();

    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    const { sessionId } = await SessionService.create({
      userId: user.id,
      organizationId: challenge.organizationId,
      ipAddress,
      userAgent,
      rememberMe: data.rememberMe,
    });

    const tokens = await TokenService.issue({
      userId: user.id,
      tenantId: challenge.organizationId,
      role: user.role,
      email: user.email,
      sessionId,
      rememberMe: data.rememberMe,
    });

    await admin
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    if (isRecovery) {
      await AuditService.log({
        organizationId: challenge.organizationId,
        actorId: user.id,
        action: 'mfa_recovery_used',
        ipAddress,
        userAgent,
      });
    }

    const tenant = await TenantService.getById(challenge.organizationId);

    return jsonResponse({
      mfaRequired: false,
      user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role, mfaEnabled: user.mfa_enabled },
      tenant: tenant && {
        id: tenant.id, name: tenant.name, clientCode: tenant.clientCode, logoUrl: tenant.logoUrl,
      },
      ...tokens,
    });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.post('/refresh', async (c) => {
  try {
    const body = await c.req.json();
    const { refreshToken } = RefreshSchema.parse(body);

    const claims = TokenService.verifyRefresh(refreshToken);
    const hash = TokenService.hashRefresh(refreshToken);
    const session = await SessionService.findByRefreshTokenHash(hash);

    const admin = getSupabaseAdmin();
    if (session.id !== claims.sid) {
      await admin
        .from('sessions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('refresh_token_family', session.refresh_token_family)
        .is('revoked_at', null);
      throw new AppError('Refresh token session mismatch', 401, 'REFRESH_TOKEN_REUSE');
    }

    const { data: user } = await admin
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

    return jsonResponse(tokens);
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.post('/logout', async (c) => {
  try {
    const claims = await authenticate(c.req.raw);
    const { ipAddress, userAgent, requestId } = getClientMeta(c);

    await SessionService.revoke(claims.sid);
    const expDate = new Date(claims.exp * 1000);
    const token = c.req.raw.headers.get('authorization')?.split(' ')[1] ?? '';

    const admin = getSupabaseAdmin();
    await admin.from('revoked_tokens').upsert({
      jti: claims.jti,
      user_id: claims.sub,
      reason: 'logout',
      expires_at: expDate.toISOString(),
    });

    await AuditService.log({
      organizationId: claims.tid,
      actorId: claims.sub,
      action: 'logout',
      ipAddress,
      userAgent,
      requestId,
    });

    return jsonResponse({ ok: true });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.post('/logout-all', async (c) => {
  try {
    const claims = await authenticate(c.req.raw);
    const { ipAddress, userAgent } = getClientMeta(c);

    await TokenService.revokeAllForUser(claims.sub);
    await AuditService.log({
      organizationId: claims.tid,
      actorId: claims.sub,
      action: 'all_sessions_revoked',
      severity: 'warn',
      ipAddress,
      userAgent,
    });

    return jsonResponse({ ok: true });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.get('/me', async (c) => {
  try {
    const claims = await authenticate(c.req.raw);
    const admin = getSupabaseAdmin();

    const { data: user } = await admin
      .from('users')
      .select('id, email, full_name, role, mfa_enabled, mfa_enrolled_at, avatar_url, last_login_at, created_at')
      .eq('id', claims.sub)
      .single();
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    const [tenant, permissions, menu] = await Promise.all([
      TenantService.getById(claims.tid),
      PermissionService.loadForUser(claims.sub, claims.tid),
      MenuService.loadForUser(claims.sub, claims.tid),
    ]);
    if (!tenant) throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');

    return jsonResponse({
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
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.get('/tenants', async (c) => {
  try {
    const claims = await authenticate(c.req.raw);
    const tenants = await TenantService.listForUser(claims.sub);
    return jsonResponse({ tenants });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.post('/switch-tenant', async (c) => {
  try {
    const claims = await authenticate(c.req.raw);
    const body = await c.req.json();
    const { organizationId } = SwitchTenantSchema.parse(body);
    const { ipAddress, userAgent } = getClientMeta(c);

    const role = await TenantService.assertMembership(claims.sub, organizationId);
    const tenant = await TenantService.getById(organizationId);
    if (!tenant) throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');

    const { sessionId } = await SessionService.create({
      userId: claims.sub,
      organizationId,
      ipAddress,
      userAgent,
    });

    const tokens = await TokenService.issue({
      userId: claims.sub,
      tenantId: organizationId,
      role,
      email: claims.email,
      sessionId,
    });

    await AuditService.log({
      organizationId,
      actorId: claims.sub,
      action: 'tenant_switched',
      ipAddress,
      userAgent,
    });

    return jsonResponse({
      tenant: { id: tenant.id, name: tenant.name, clientCode: tenant.clientCode, logoUrl: tenant.logoUrl },
      ...tokens,
    });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.post('/change-password', async (c) => {
  try {
    const claims = await authenticate(c.req.raw);
    const body = await c.req.json();
    const { currentPassword, newPassword } = ChangePasswordSchema.parse(body);
    const { ipAddress, userAgent } = getClientMeta(c);

    const admin = getSupabaseAdmin();
    const { data: user } = await admin
      .from('users')
      .select('password_hash')
      .eq('id', claims.sub)
      .single();
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    const ok = await PasswordService.verify(currentPassword, user.password_hash ?? '');
    if (!ok) throw new AppError('Current password is incorrect', 401, 'INVALID_CURRENT_PASSWORD');

    const newHash = await PasswordService.hash(newPassword);
    await admin
      .from('users')
      .update({
        password_hash: newHash,
        password_changed_at: new Date().toISOString(),
      })
      .eq('id', claims.sub);

    await AuditService.log({
      organizationId: claims.tid,
      actorId: claims.sub,
      action: 'password_change',
      severity: 'warn',
      ipAddress,
      userAgent,
    });

    return jsonResponse({ ok: true });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.post('/forgot-password', async (c) => {
  try {
    const body = await c.req.json();
    const data = ForgotPasswordSchema.parse(body);
    const { ipAddress, userAgent } = getClientMeta(c);

    const tenant = await TenantService.resolveByClientCode(data.clientCode);
    const admin = getSupabaseAdmin();

    const { data: user } = await admin
      .from('users')
      .select('id, email')
      .eq('email', data.email.toLowerCase())
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    if (user) {
      const token = crypto.randomUUID();
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const resetExpiryMinutes = parseInt(Deno.env.get('PASSWORD_RESET_TOKEN_EXPIRY_MINUTES') ?? '15', 10);
      await admin.from('password_reset_tokens').insert({
        user_id: user.id,
        token_hash: tokenHash,
        email: user.email,
        expires_at: new Date(Date.now() + resetExpiryMinutes * 60 * 1000).toISOString(),
      });

      console.log(`[password-reset] link for ${user.email}: /reset-password?token=${token}`);

      await AuditService.log({
        organizationId: tenant.id,
        actorId: user.id,
        action: 'password_reset_requested',
        ipAddress,
        userAgent,
      });
    }

    return jsonResponse({ ok: true, message: 'If an account exists, a reset link has been sent.' });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.post('/reset-password', async (c) => {
  try {
    const body = await c.req.json();
    const { token, newPassword } = ResetPasswordSchema.parse(body);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const admin = getSupabaseAdmin();
    const { data: row } = await admin
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
      throw new AppError('Invalid or expired token', 400, 'INVALID_RESET_TOKEN');
    }

    const newHash = await PasswordService.hash(newPassword);
    await admin
      .from('users')
      .update({ password_hash: newHash, password_changed_at: new Date().toISOString() })
      .eq('id', row.user_id);

    await admin
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', row.id);

    await TokenService.revokeAllForUser(row.user_id);

    return jsonResponse({ ok: true });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.post('/mfa/enroll', async (c) => {
  try {
    const claims = await authenticate(c.req.raw);
    const tenant = await TenantService.getById(claims.tid);
    if (!tenant) throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');

    const admin = getSupabaseAdmin();
    const { data: user } = await admin
      .from('users')
      .select('email')
      .eq('id', claims.sub)
      .single();

    const enrollment = await MfaService.startEnrollment(claims.sub, user!.email, tenant.name);
    pendingMfaSecrets.set(claims.sub, enrollment.secret);

    return jsonResponse({
      otpauth: enrollment.otpauth,
      qrCodeDataUrl: enrollment.qrCodeDataUrl,
    });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.post('/mfa/confirm', async (c) => {
  try {
    const claims = await authenticate(c.req.raw);
    const body = await c.req.json();
    const { secret, code } = MfaEnrollConfirmSchema.parse(body);
    const { ipAddress, userAgent } = getClientMeta(c);

    const expected = pendingMfaSecrets.get(claims.sub);
    if (!expected || expected !== secret) {
      throw new AppError('Enrollment expired. Please start again.', 400, 'MFA_ENROLLMENT_EXPIRED');
    }

    const { recoveryCodes } = await MfaService.confirmEnrollment({
      userId: claims.sub,
      secret,
      code,
    });
    pendingMfaSecrets.delete(claims.sub);

    await AuditService.log({
      organizationId: claims.tid,
      actorId: claims.sub,
      action: 'mfa_enrolled',
      severity: 'warn',
      ipAddress,
      userAgent,
    });

    return jsonResponse({ ok: true, recoveryCodes });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.post('/mfa/disable', async (c) => {
  try {
    const claims = await authenticate(c.req.raw);
    const body = await c.req.json();
    const { password } = z.object({ password: z.string().min(1) }).parse(body);
    const { ipAddress, userAgent } = getClientMeta(c);

    const admin = getSupabaseAdmin();
    const { data: user } = await admin
      .from('users')
      .select('password_hash')
      .eq('id', claims.sub)
      .single();

    const ok = await PasswordService.verify(password, user?.password_hash ?? '');
    if (!ok) throw new AppError('Password incorrect', 401, 'INVALID_PASSWORD');

    await MfaService.disable(claims.sub);
    await AuditService.log({
      organizationId: claims.tid,
      actorId: claims.sub,
      action: 'mfa_disabled',
      severity: 'critical',
      ipAddress,
      userAgent,
    });

    return jsonResponse({ ok: true });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.post('/mfa/recovery-codes', async (c) => {
  try {
    const claims = await authenticate(c.req.raw);
    const codes = await MfaService.regenerateRecoveryCodes(claims.sub);
    return jsonResponse({ recoveryCodes: codes });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

// Start Deno server listening on Hono requests
Deno.serve(app.fetch);
