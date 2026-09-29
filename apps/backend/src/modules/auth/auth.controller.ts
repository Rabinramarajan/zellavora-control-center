import type { Request, Response } from 'express';
import crypto from 'crypto';
import type { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { AuthService } from './auth.service';
import type { AuthenticatedActor, RequestMeta } from './auth.types';
import {
  AcceptInvitationSchema,
  ChangePasswordSchema,
  EmailOnlySchema,
  InvitationTokenSchema,
  LoginSchema,
  MfaDisableSchema,
  MfaEnrollConfirmSchema,
  MfaVerifySchema,
  PasswordConfirmSchema,
  RecoveryCodeSchema,
  RefreshSchema,
  RegisterSchema,
  ResetPasswordSchema,
  ResetTokenSchema,
  SessionIdSchema,
  SwitchTenantSchema,
  UpdateAvatarSchema,
  VerifyEmailSchema,
} from './auth.dto';

// Routes wrap every handler in asyncHandler, which forwards rejections to the error
// middleware, so handlers stay free of try/catch boilerplate.

const meta = (req: Request): RequestMeta => ({
  // req.ip honours the configured `trust proxy` hop count; raw X-Forwarded-For is spoofable.
  ipAddress: req.ip ?? '0.0.0.0',
  userAgent: req.get('user-agent') ?? 'unknown',
  requestId: req.get('x-request-id') ?? crypto.randomUUID(),
});

const actor = (req: AuthRequest): AuthenticatedActor => {
  if (!req.userId || !req.tenantId || !req.sessionId || !req.userEmail) {
    throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  }
  return {
    ...meta(req),
    userId: req.userId,
    tenantId: req.tenantId,
    sessionId: req.sessionId,
    email: req.userEmail,
  };
};

const noStore = (res: Response): Response => res.set('Cache-Control', 'no-store');

export class AuthController {
  constructor(private readonly service = new AuthService()) {}

  // --- Public ---------------------------------------------------------------

  config = (_req: Request, res: Response) => {
    res.json(this.service.getPublicConfig());
  };

  tenants = async (_req: Request, res: Response) => {
    noStore(res).json({ tenants: await this.service.listTenants() });
  };

  login = async (req: Request, res: Response) => {
    const dto = LoginSchema.parse(req.body);
    noStore(res).json(await this.service.login(dto, meta(req)));
  };

  verifyMfa = async (req: Request, res: Response) => {
    const { mfaToken, code } = MfaVerifySchema.parse(req.body);
    noStore(res).json(await this.service.verifyMfa(mfaToken, code, meta(req)));
  };

  verifyRecoveryCode = async (req: Request, res: Response) => {
    const { mfaToken, code } = RecoveryCodeSchema.parse(req.body);
    noStore(res).json(await this.service.verifyRecoveryCode(mfaToken, code, meta(req)));
  };

  refresh = async (req: Request, res: Response) => {
    const { refreshToken } = RefreshSchema.parse(req.body);
    noStore(res).json(await this.service.refresh(refreshToken));
  };

  register = async (req: Request, res: Response) => {
    const dto = RegisterSchema.parse(req.body);
    res.status(202).json(await this.service.register(dto, meta(req)));
  };

  previewInvitation = async (req: Request, res: Response) => {
    const { token } = InvitationTokenSchema.parse(req.body);
    noStore(res).json(await this.service.previewInvitation(token));
  };

  acceptInvitation = async (req: Request, res: Response) => {
    const dto = AcceptInvitationSchema.parse(req.body);
    res.json(await this.service.acceptInvitation(dto, meta(req)));
  };

  verifyEmail = async (req: Request, res: Response) => {
    const { token } = VerifyEmailSchema.parse(req.body);
    res.json(await this.service.verifyEmail(token, meta(req)));
  };

  resendVerification = async (req: Request, res: Response) => {
    const { email } = EmailOnlySchema.parse(req.body);
    res.status(202).json(await this.service.resendVerification(email));
  };

  forgotPassword = async (req: Request, res: Response) => {
    const { email } = EmailOnlySchema.parse(req.body);
    res.status(202).json(await this.service.forgotPassword(email, meta(req)));
  };

  validateResetToken = async (req: Request, res: Response) => {
    const { token } = ResetTokenSchema.parse(req.body);
    noStore(res).json(await this.service.validateResetToken(token));
  };

  resetPassword = async (req: Request, res: Response) => {
    const { token, newPassword } = ResetPasswordSchema.parse(req.body);
    res.json(await this.service.resetPassword(token, newPassword, meta(req)));
  };

  // --- Authenticated ----------------------------------------------------------

  logout = async (req: AuthRequest, res: Response) => {
    await this.service.logout(actor(req));
    res.json({ ok: true });
  };

  logoutAll = async (req: AuthRequest, res: Response) => {
    const { password } = PasswordConfirmSchema.parse(req.body);
    await this.service.logoutAll(actor(req), password);
    res.json({ ok: true });
  };

  me = async (req: AuthRequest, res: Response) => {
    noStore(res).json(await this.service.me(actor(req)));
  };

  userTenants = async (req: AuthRequest, res: Response) => {
    res.json({ tenants: await this.service.listUserTenants(actor(req).userId) });
  };

  switchTenant = async (req: AuthRequest, res: Response) => {
    const { organizationId } = SwitchTenantSchema.parse(req.body);
    noStore(res).json(await this.service.switchTenant(actor(req), organizationId));
  };

  updateAvatar = async (req: AuthRequest, res: Response) => {
    const { avatar } = UpdateAvatarSchema.parse(req.body);
    res.json(await this.service.updateAvatar(actor(req), avatar));
  };

  changePassword = async (req: AuthRequest, res: Response) => {
    const { currentPassword, newPassword } = ChangePasswordSchema.parse(req.body);
    res.json(await this.service.changePassword(actor(req), currentPassword, newPassword));
  };

  security = async (req: AuthRequest, res: Response) => {
    noStore(res).json(await this.service.securityOverview(actor(req)));
  };

  startMfaEnrollment = async (req: AuthRequest, res: Response) => {
    const { password } = PasswordConfirmSchema.parse(req.body);
    noStore(res).json(await this.service.startMfaEnrollment(actor(req), password));
  };

  confirmMfaEnrollment = async (req: AuthRequest, res: Response) => {
    const { enrollmentToken, code } = MfaEnrollConfirmSchema.parse(req.body);
    noStore(res).json(await this.service.confirmMfaEnrollment(actor(req), enrollmentToken, code));
  };

  disableMfa = async (req: AuthRequest, res: Response) => {
    const { password, code } = MfaDisableSchema.parse(req.body);
    res.json(await this.service.disableMfa(actor(req), password, code));
  };

  regenerateRecoveryCodes = async (req: AuthRequest, res: Response) => {
    const { password } = PasswordConfirmSchema.parse(req.body);
    noStore(res).json(await this.service.regenerateRecoveryCodes(actor(req), password));
  };

  sessions = async (req: AuthRequest, res: Response) => {
    noStore(res).json(await this.service.listSessions(actor(req)));
  };

  revokeSession = async (req: AuthRequest, res: Response) => {
    const { sessionId } = SessionIdSchema.parse(req.params);
    res.json(await this.service.revokeSession(actor(req), sessionId));
  };

  revokeOtherSessions = async (req: AuthRequest, res: Response) => {
    res.json(await this.service.revokeOtherSessions(actor(req)));
  };
}
