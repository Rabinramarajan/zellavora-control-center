/**
 * Authentication contracts — mirror of /api/v1/auth (apps/backend/src/modules/auth).
 */
import type { MenuNode, TenantSummary, UserRole } from './index';

// ============================================================================
// Public configuration
// ============================================================================

export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSymbol: boolean;
}

export interface AuthConfig {
  selfRegistrationEnabled: boolean;
  /** Types the server will accept. Empty when registration is off. */
  registrationTypes: RegistrationType[];
  requireEmailVerification: boolean;
  supportEmail: string;
  passwordPolicy: PasswordPolicy;
}

// ============================================================================
// Login & two-factor
// ============================================================================

export interface LoginRequest {
  clientCode: string;
  email: string;
  password: string;
  rememberMe?: boolean;
}

export type MfaChallengeMethod = 'totp' | 'email_otp';

export interface MfaChallengeResponse {
  mfaRequired: true;
  mfaToken: string;
  mfaMethod: MfaChallengeMethod;
  expiresAt: string;
}

export interface TokenPairResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  sessionId: string;
}

export interface LoginSuccessResponse extends TokenPairResponse {
  mfaRequired: false;
  user: AuthUser;
  tenant: TenantSummary;
  defaultLandingPage?: string;
  mfaSetupRequired: boolean;
  recoveryCodesRemaining?: number;
}

export type LoginResponse = MfaChallengeResponse | LoginSuccessResponse;

export type RefreshResponse = TokenPairResponse;

/** State of a pending 2FA sign-in, kept in sessionStorage between /login and /auth/two-factor. */
export interface PendingMfaChallenge {
  mfaToken: string;
  mfaMethod: MfaChallengeMethod;
  expiresAt: string;
}

// ============================================================================
// Onboarding
// ============================================================================

/** Self-service registration types. Mirrors the backend's narrowed enum. */
export type RegistrationType = 'ORGANIZATION_MEMBER' | 'INDIVIDUAL' | 'CREATE_ORGANIZATION';

interface RegisterRequestBase {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  acceptTerms: true;
}

export interface RegisterOrganizationMemberRequest extends RegisterRequestBase {
  registrationType: 'ORGANIZATION_MEMBER';
  clientCode: string;
}

export interface RegisterIndividualRequest extends RegisterRequestBase {
  registrationType: 'INDIVIDUAL';
}

export interface RegisterOrganizationRequest extends RegisterRequestBase {
  registrationType: 'CREATE_ORGANIZATION';
  organization: {
    name: string;
    code: string;
    businessEmail: string;
    /** ISO 3166-1 alpha-2. */
    country: string;
    /** IANA zone, e.g. Asia/Kolkata. */
    timezone: string;
  };
}

/**
 * Discriminated so the compiler rejects an individual registration that
 * carries a clientCode, or an organization one that omits its details.
 */
export type RegisterRequest =
  RegisterOrganizationMemberRequest | RegisterIndividualRequest | RegisterOrganizationRequest;

/** Where a registration left the account, which decides the success panel. */
export type RegistrationOutcome = 'PENDING_APPROVAL' | 'PENDING_EMAIL_VERIFICATION' | 'ACTIVE';

export interface RegisterResponse {
  ok: boolean;
  message: string;
  registrationType: RegistrationType;
  outcome: RegistrationOutcome;
}

export type InvitationState = 'valid' | 'expired' | 'used' | 'revoked' | 'invalid';

export interface InvitationPreview {
  state: InvitationState;
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  organizationName?: string | null;
}

export interface AcceptInvitationRequest {
  token: string;
  firstName: string;
  lastName: string;
  password: string;
}

export interface AcceptInvitationResponse {
  ok: true;
  clientCode: string | null;
}

export interface VerifyEmailResponse {
  ok: true;
  alreadyVerified: boolean;
}

export interface GenericMessageResponse {
  ok: true;
  message: string;
}

// ============================================================================
// Password
// ============================================================================

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponse {
  ok: true;
  revokedSessions: number;
}

// ============================================================================
// Current user
// ============================================================================

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  role: UserRole;
  emailVerified?: boolean;
  mfaEnabled: boolean;
  mfaEnrolledAt?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export interface MeResponse {
  user: AuthUser;
  tenant: TenantSummary & { plan: string; enforce2fa: boolean };
  mfaSetupRequired: boolean;
  permissions: string[];
  menu: MenuNode[];
}

export interface SwitchTenantRequest {
  organizationId: string;
}

// ============================================================================
// Account security
// ============================================================================

export interface SecurityEvent {
  id: string;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface SecurityOverview {
  emailVerified: boolean;
  passwordChangedAt: string | null;
  mfaEnabled: boolean;
  mfaEnrolledAt: string | null;
  mfaRequiredByOrganization: boolean;
  recoveryCodesRemaining: number;
  recentEvents: SecurityEvent[];
}

export interface MfaEnrollStartResponse {
  enrollmentToken: string;
  otpauth: string;
  qrCodeDataUrl: string;
  /** Base32 secret for manual entry when the QR code can't be scanned. */
  secret: string;
}

export interface MfaEnrollConfirmResponse {
  ok: true;
  recoveryCodes: string[];
}

export interface MfaRecoveryCodesResponse {
  recoveryCodes: string[];
}

export interface ActiveSession {
  id: string;
  browser: string;
  os: string;
  ipAddress: string | null;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

// ============================================================================
// Errors
// ============================================================================

export interface ApiError {
  error: {
    code: string;
    message: string;
    status: number;
    /** Field-level messages for VALIDATION_ERROR responses. */
    fields?: Record<string, string>;
    /** Single field an error applies to (e.g. INVALID_CURRENT_PASSWORD → currentPassword). */
    field?: string;
    retryAfterSeconds?: number;
  };
}
