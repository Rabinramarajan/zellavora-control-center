import type { TokenPair } from '../../services/auth';

/** Client metadata captured for audit, rate limiting and session records. */
export interface RequestMeta {
  ipAddress: string;
  userAgent: string;
  requestId?: string;
}

export interface AuthenticatedActor extends RequestMeta {
  userId: string;
  tenantId: string;
  sessionId: string;
  email: string;
}

export interface LoginUserView {
  id: string;
  email: string;
  fullName: string;
  role: string;
  mfaEnabled: boolean;
  avatarUrl: string | null;
}

export interface TenantView {
  id: string;
  name: string;
  clientCode: string;
  logoUrl: string | null;
}

export interface LoginSuccess extends TokenPair {
  mfaRequired: false;
  user: LoginUserView;
  tenant: TenantView;
  defaultLandingPage: string;
  /** Organization policy requires 2FA and the user has not enrolled yet. */
  mfaSetupRequired: boolean;
  recoveryCodesRemaining?: number;
}

export interface MfaChallenge {
  mfaRequired: true;
  mfaToken: string;
  mfaMethod: 'totp' | 'email_otp';
  expiresAt: Date;
}

export type LoginResult = LoginSuccess | MfaChallenge;

export type InvitationState = 'valid' | 'expired' | 'used' | 'revoked' | 'invalid';
