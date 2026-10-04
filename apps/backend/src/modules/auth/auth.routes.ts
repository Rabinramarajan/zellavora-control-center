/**
 * Authentication API — mounted at /api/v1/auth.
 *
 * Public:  config, login (+2FA / recovery code), refresh, register
 *          (feature-flagged), invitations, email verification, password recovery.
 * Authed:  logout, me, tenants, password change, 2FA management, sessions.
 */
import { Router, type Router as ExpressRouter } from 'express';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/async-handler';
import { AuthController } from './auth.controller';
import type { RateLimitRequestHandler } from 'express-rate-limit';
import { createRateLimiter } from '../../middleware/rate-limit';

const router: ExpressRouter = Router();
const controller = new AuthController();

// Each limiter needs its own bucket: a shared Redis prefix would merge the
// counters, letting login traffic exhaust the much tighter email quota.
const limit = (bucket: string, windowMinutes: number, max: number): RateLimitRequestHandler =>
  createRateLimiter({
    bucket: `auth:${bucket}`,
    windowMs: windowMinutes * 60 * 1000,
    limit: max,
  });

const loginLimiter = limit('login', 15, 30);
const challengeLimiter = limit('challenge', 5, 15);
const emailLimiter = limit('email', 15, 5);
const tokenLimiter = limit('token', 15, 20);
const registerLimiter = limit('register', 60, 5);
// The availability check runs on every blur of the code field, so it needs its
// own budget — the registration limiter's 5/hour would block normal typing.
const orgCodeLimiter = limit('register-org-code', 10, 30);
const sensitiveLimiter = limit('sensitive', 15, 10);

/**
 * @swagger
 * /api/v1/auth/config:
 *   get:
 *     summary: getAuthenticationConfig
 *     operationId: getAuthConfig
 *     description: Public policy flags (self-registration, verification, password policy).
 *     tags: [authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Authentication configuration
 */
router.get('/config', asyncHandler(controller.config));

/**
 * @swagger
 * /api/v1/auth/registration/organizations:
 *   get:
 *     summary: listOrganizationsOpenToRegistration
 *     operationId: getAuthRegistrationOrganizations
 *     description: >
 *       Organizations that have opted into member self-registration. Narrower
 *       than /auth/clients by design: this list is public, so it must not
 *       double as a directory of every customer. Empty when registration is off.
 *     tags: [authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Organizations accepting self-registration
 */
router.get('/registration/organizations', asyncHandler(controller.registrationOrganizations));

/**
 * @swagger
 * /api/v1/auth/registration/organization-code:
 *   get:
 *     summary: checkOrganizationCodeAvailability
 *     operationId: getAuthRegistrationOrganizationCode
 *     description: Whether an organization code is free, for inline feedback on the sign-up form.
 *     tags: [authentication]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: "{ code, available }"
 *       404:
 *         description: Organization registration is not available
 */
router.get(
  '/registration/organization-code',
  orgCodeLimiter,
  asyncHandler(controller.organizationCodeAvailability)
);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: signInWithEmailAndPassword
 *     operationId: postAuthLogin
 *     description: Returns tokens, or a 2FA challenge when the account has 2FA enabled.
 *     tags: [authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clientCode, email, password]
 *             properties:
 *               clientCode: { type: string }
 *               email: { type: string, format: email, maxLength: 254 }
 *               password: { type: string, format: password, maxLength: 128 }
 *               rememberMe: { type: boolean }
 *     responses:
 *       200:
 *         description: Signed in, or 2FA challenge issued (mfaRequired=true)
 *       401:
 *         description: Invalid email or password
 *       403:
 *         description: Email not verified, or account disabled
 *       423:
 *         description: Account locked
 *       429:
 *         description: Rate limited
 */
router.post('/login', loginLimiter, asyncHandler(controller.login));

/**
 * @swagger
 * /api/v1/auth/login/mfa:
 *   post:
 *     summary: completeTwoFactorChallenge
 *     operationId: postAuthLoginMfa
 *     tags: [authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mfaToken, code]
 *             properties:
 *               mfaToken: { type: string }
 *               code: { type: string, pattern: '^\d{6}$' }
 *     responses:
 *       200:
 *         description: Signed in
 *       401:
 *         description: Invalid code or expired challenge
 *       429:
 *         description: Too many attempts
 */
router.post('/login/mfa', challengeLimiter, asyncHandler(controller.verifyMfa));

/**
 * @swagger
 * /api/v1/auth/login/recovery-code:
 *   post:
 *     summary: completeTwoFactorChallengeWithRecoveryCode
 *     operationId: postAuthLoginRecoveryCode
 *     tags: [authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mfaToken, code]
 *             properties:
 *               mfaToken: { type: string }
 *               code: { type: string, example: ABCDE-FGHJK }
 *     responses:
 *       200:
 *         description: Signed in; includes recoveryCodesRemaining
 *       401:
 *         description: Invalid or used code
 */
router.post('/login/recovery-code', challengeLimiter, asyncHandler(controller.verifyRecoveryCode));

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: refreshAccessAndRefreshTokens
 *     operationId: postAuthRefresh
 *     tags: [authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: New token pair
 *       401:
 *         description: Invalid, revoked or reused refresh token
 */
router.post('/refresh', asyncHandler(controller.refresh));

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: registerAccount
 *     operationId: postAuthRegister
 *     description: >
 *       Only available when ALLOW_SELF_REGISTRATION=true. Generic response for
 *       existing emails. The body is conditional on registrationType:
 *       ORGANIZATION_MEMBER requires clientCode and ends in PENDING_APPROVAL;
 *       INDIVIDUAL takes no organization fields and ends ACTIVE behind email
 *       verification; CREATE_ORGANIZATION requires an organization object
 *       (name, code, businessEmail, country, timezone) and ends in
 *       PENDING_APPROVAL by a platform administrator. Omitting registrationType
 *       is read as ORGANIZATION_MEMBER for clients that predate types.
 *     tags: [authentication]
 *     security: []
 *     responses:
 *       202:
 *         description: >
 *           Accepted; verification email sent when applicable. Body carries
 *           registrationType and outcome (PENDING_APPROVAL,
 *           PENDING_EMAIL_VERIFICATION or ACTIVE).
 *       404:
 *         description: Registration disabled, or that registration type is not offered
 *       409:
 *         description: Organization code already taken (CREATE_ORGANIZATION only)
 */
router.post('/register', registerLimiter, asyncHandler(controller.register));

/**
 * @swagger
 * /api/v1/auth/invitations/preview:
 *   post:
 *     summary: previewInvitation
 *     operationId: postAuthInvitationsPreview
 *     tags: [authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Invitation state (valid, expired, used, revoked, invalid) and prefill data
 */
router.post('/invitations/preview', tokenLimiter, asyncHandler(controller.previewInvitation));

/**
 * @swagger
 * /api/v1/auth/invitations/accept:
 *   post:
 *     summary: acceptInvitation
 *     operationId: postAuthInvitationsAccept
 *     tags: [authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Account activated
 *       400:
 *         description: Invitation invalid, expired, used or revoked
 *       409:
 *         description: Account already active
 */
router.post('/invitations/accept', tokenLimiter, asyncHandler(controller.acceptInvitation));

/**
 * @swagger
 * /api/v1/auth/verify-email:
 *   post:
 *     summary: verifyEmailAddress
 *     operationId: postAuthVerifyEmail
 *     tags: [authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Verified (alreadyVerified=true when previously verified)
 *       400:
 *         description: Invalid or expired link
 */
router.post('/verify-email', tokenLimiter, asyncHandler(controller.verifyEmail));

/**
 * @swagger
 * /api/v1/auth/resend-verification:
 *   post:
 *     summary: resendVerificationEmail
 *     operationId: postAuthResendVerification
 *     tags: [authentication]
 *     security: []
 *     responses:
 *       202:
 *         description: Generic confirmation (enumeration-resistant)
 */
router.post('/resend-verification', emailLimiter, asyncHandler(controller.resendVerification));

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: requestPasswordReset
 *     operationId: postAuthForgotPassword
 *     tags: [authentication]
 *     security: []
 *     responses:
 *       202:
 *         description: Generic confirmation (enumeration-resistant)
 */
router.post('/forgot-password', emailLimiter, asyncHandler(controller.forgotPassword));

/**
 * @swagger
 * /api/v1/auth/reset-password/validate:
 *   post:
 *     summary: validatePasswordResetToken
 *     operationId: postAuthResetPasswordValidate
 *     tags: [authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: "{ valid: boolean }"
 */
router.post('/reset-password/validate', tokenLimiter, asyncHandler(controller.validateResetToken));

/**
 * @swagger
 * /api/v1/auth/reset-password:
 *   post:
 *     summary: resetPassword
 *     operationId: postAuthResetPassword
 *     tags: [authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Password updated; sessions revoked per policy
 *       400:
 *         description: Invalid token or password policy failure
 */
router.post('/reset-password', tokenLimiter, asyncHandler(controller.resetPassword));

// ---------------------------------------------------------------------------
// Authenticated
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: revokeCurrentSession
 *     operationId: postAuthLogout
 *     tags: [authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Session revoked
 */
router.post('/logout', authenticate, asyncHandler(controller.logout));

/**
 * @swagger
 * /api/v1/auth/logout-all:
 *   post:
 *     summary: revokeAllSessions
 *     operationId: postAuthLogoutAll
 *     description: Requires the current password.
 *     tags: [authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Every session revoked
 */
router.post('/logout-all', authenticate, sensitiveLimiter, asyncHandler(controller.logoutAll));

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: getCurrentUserProfileWithPermissionsAndMenu
 *     operationId: getAuthMe
 *     tags: [authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User, tenant, permissions and permission-filtered menu
 */
router.get('/me', authenticate, asyncHandler(controller.me));

/**
 * @swagger
 * /api/v1/auth/me/avatar:
 *   put:
 *     summary: updateCurrentUserAvatar
 *     operationId: putAuthMeAvatar
 *     tags: [authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Avatar updated
 */
router.put('/me/avatar', authenticate, asyncHandler(controller.updateAvatar));

/**
 * @swagger
 * /api/v1/auth/tenants:
 *   get:
 *     summary: listTenantsTheCurrentUserBelongsTo
 *     operationId: getAuthTenants
 *     tags: [authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Tenant memberships
 */
router.get('/tenants', authenticate, asyncHandler(controller.userTenants));

/**
 * @swagger
 * /api/v1/auth/switch-tenant:
 *   post:
 *     summary: switchActiveTenant
 *     operationId: postAuthSwitchTenant
 *     tags: [authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: New token pair bound to the target tenant
 */
router.post('/switch-tenant', authenticate, asyncHandler(controller.switchTenant));

/**
 * @swagger
 * /api/v1/auth/change-password:
 *   post:
 *     summary: changeAccountPassword
 *     operationId: postAuthChangePassword
 *     tags: [authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Password changed; other sessions revoked per policy
 *       400:
 *         description: Wrong current password, reuse, or policy failure
 */
router.post(
  '/change-password',
  authenticate,
  sensitiveLimiter,
  asyncHandler(controller.changePassword)
);

/**
 * @swagger
 * /api/v1/auth/security:
 *   get:
 *     summary: getAccountSecurityOverview
 *     operationId: getAuthSecurity
 *     tags: [authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Password, 2FA, recovery-code status and recent security events
 */
router.get('/security', authenticate, asyncHandler(controller.security));

/**
 * @swagger
 * /api/v1/auth/mfa/enroll:
 *   post:
 *     summary: startTotpEnrollment
 *     operationId: postAuthMfaEnroll
 *     description: Requires the current password.
 *     tags: [authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Enrollment token, QR code and manual-entry secret
 */
router.post(
  '/mfa/enroll',
  authenticate,
  sensitiveLimiter,
  asyncHandler(controller.startMfaEnrollment)
);

/**
 * @swagger
 * /api/v1/auth/mfa/confirm:
 *   post:
 *     summary: confirmTotpEnrollment
 *     operationId: postAuthMfaConfirm
 *     tags: [authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA enabled; recovery codes returned once
 */
router.post(
  '/mfa/confirm',
  authenticate,
  sensitiveLimiter,
  asyncHandler(controller.confirmMfaEnrollment)
);

/**
 * @swagger
 * /api/v1/auth/mfa/disable:
 *   post:
 *     summary: disableTwoFactorAuthentication
 *     operationId: postAuthMfaDisable
 *     description: Requires the current password and an authenticator or recovery code.
 *     tags: [authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA disabled
 */
router.post('/mfa/disable', authenticate, sensitiveLimiter, asyncHandler(controller.disableMfa));

/**
 * @swagger
 * /api/v1/auth/mfa/recovery-codes:
 *   post:
 *     summary: regenerateMfaRecoveryCodes
 *     operationId: postAuthMfaRecoveryCodes
 *     description: Requires the current password. Invalidates the previous set.
 *     tags: [authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: New recovery codes (shown once)
 */
router.post(
  '/mfa/recovery-codes',
  authenticate,
  sensitiveLimiter,
  asyncHandler(controller.regenerateRecoveryCodes)
);

/**
 * @swagger
 * /api/v1/auth/sessions:
 *   get:
 *     summary: listActiveSessions
 *     operationId: getAuthSessions
 *     tags: [authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Active sessions with the current one marked
 *   delete:
 *     summary: revokeAllOtherSessions
 *     operationId: deleteAuthSessions
 *     tags: [authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Every session except the current one revoked
 */
router.get('/sessions', authenticate, asyncHandler(controller.sessions));
router.delete('/sessions', authenticate, asyncHandler(controller.revokeOtherSessions));

/**
 * @swagger
 * /api/v1/auth/sessions/{sessionId}:
 *   delete:
 *     summary: revokeSession
 *     operationId: deleteAuthSessionsBySessionId
 *     tags: [authentication]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Session revoked
 *       404:
 *         description: No such session for this user
 */
router.delete('/sessions/:sessionId', authenticate, asyncHandler(controller.revokeSession));

export default router;
