/**
 * Registration API Service
 * Handles all registration-related HTTP requests
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RegistrationStatus {
  enabled: boolean;
  features: {
    emailVerification: boolean;
    mobileVerification: boolean;
    mfaRequired: boolean;
    inviteRequired: boolean;
  };
  supportedPlans: string[];
  supportedLanguages: string[];
}

export interface CheckEmailResponse {
  available: boolean;
  message?: string;
  suggestion?: string;
}

export interface CheckOrgResponse {
  available: boolean;
  message?: string;
  suggestion?: string;
}

export interface InitRegistrationRequest {
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  mobile?: string;
  country: string;
  timezone?: string;
  language?: string;
}

export interface InitRegistrationResponse {
  sessionId: string;
  email: string;
  expiresAt: string;
  nextStep: string;
}

export interface SendOtpResponse {
  success: boolean;
  message: string;
  expiresIn: number;
  resendCooldown: number;
  cooldownEndsAt?: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  verified: boolean;
}

export interface MfaSetupResponse {
  method: 'authenticator' | 'email_otp' | 'sms';
  secret?: string;
  qrCode?: string;
  instructions: string;
}

export interface PasswordStrength {
  isValid: boolean;
  score: number;
  strength: 'weak' | 'fair' | 'good' | 'strong' | 'excellent';
  errors: string[];
  suggestions: string[];
}

export interface CompleteRegistrationRequest {
  sessionId?: string;
  email: string;
  emailVerified: boolean;
  organizationName: string;
  organizationCode: string;
  industry?: string;
  size?: string;
  website?: string;
  gstNumber?: string;
  taxNumber?: string;
  logoUrl?: string;
  useCases?: string[];
  branchName: string;
  branchCode?: string;
  branchAddress?: string;
  branchCity?: string;
  branchState?: string;
  branchCountry?: string;
  branchPincode?: string;
  firstName: string;
  lastName: string;
  mobile?: string;
  mobileVerified: boolean;
  password: string;
  confirmPassword: string;
  mfaEnabled: boolean;
  mfaMethod?: 'authenticator' | 'email_otp';
  mfaCode?: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  cookieAccepted: boolean;
  marketingConsent: boolean;
  inviteCode?: string;
}

export interface CompleteRegistrationResponse {
  success: boolean;
  message: string;
  data: {
    organization: {
      id: string;
      name: string;
      clientCode: string;
    };
    user: {
      id: string;
      email: string;
      fullName: string;
      role: string;
    };
    branch: {
      id: string;
      name: string;
    };
  };
  nextSteps: string[];
}

export interface RegistrationSession {
  id: string;
  email: string;
  emailVerified: boolean;
  mobileVerified: boolean;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  country?: string;
  timezone?: string;
  language?: string;
  organizationName?: string;
  organizationCode?: string;
  industry?: string;
  size?: string;
  branchName?: string;
  mfaEnabled: boolean;
  mfaMethod?: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  status: string;
  currentStep: number;
  expiresAt: string;
  createdAt: string;
  isExpired: boolean;
}

export interface Country {
  code: string;
  name: string;
  phoneCode: string;
}

export interface Industry {
  value: string;
  label: string;
}

export interface OrganizationSize {
  value: string;
  label: string;
}

@Injectable({ providedIn: 'root' })
export class RegistrationApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/register';

  /**
   * Check if registration is enabled
   */
  getStatus(): Observable<RegistrationStatus> {
    return this.http.get<RegistrationStatus>(`${this.baseUrl}/status`);
  }

  /**
   * Check if email is available
   */
  checkEmail(email: string): Observable<CheckEmailResponse> {
    return this.http.post<CheckEmailResponse>(`${this.baseUrl}/check-email`, { email });
  }

  /**
   * Check if organization code is available
   */
  checkOrganizationCode(code: string): Observable<CheckOrgResponse> {
    return this.http.post<CheckOrgResponse>(`${this.baseUrl}/check-org`, { organizationCode: code });
  }

  /**
   * Initialize a new registration session
   */
  initRegistration(data: InitRegistrationRequest): Observable<InitRegistrationResponse> {
    return this.http.post<InitRegistrationResponse>(`${this.baseUrl}/init`, data);
  }

  /**
   * Send email OTP
   */
  sendEmailOtp(email: string, sessionId?: string): Observable<SendOtpResponse> {
    return this.http.post<SendOtpResponse>(`${this.baseUrl}/send-email-otp`, { email, sessionId });
  }

  /**
   * Verify email OTP
   */
  verifyEmailOtp(email: string, code: string, sessionId?: string): Observable<VerifyOtpResponse> {
    return this.http.post<VerifyOtpResponse>(`${this.baseUrl}/verify-email`, { email, code, sessionId });
  }

  /**
   * Send mobile OTP
   */
  sendMobileOtp(mobile: string, countryCode: string = '+91', sessionId?: string): Observable<SendOtpResponse> {
    return this.http.post<SendOtpResponse>(`${this.baseUrl}/send-mobile-otp`, { mobile, countryCode, sessionId });
  }

  /**
   * Verify mobile OTP
   */
  verifyMobileOtp(mobile: string, code: string, sessionId?: string): Observable<VerifyOtpResponse> {
    return this.http.post<VerifyOtpResponse>(`${this.baseUrl}/verify-mobile`, { mobile, code, sessionId });
  }

  /**
   * Resend OTP
   */
  resendOtp(email: string, type: 'email' | 'mobile' = 'email', sessionId?: string): Observable<SendOtpResponse> {
    return this.http.post<SendOtpResponse>(`${this.baseUrl}/resend-otp`, { email, type, sessionId });
  }

  /**
   * Get MFA setup
   */
  getMfaSetup(email: string, method: 'authenticator' | 'email_otp' = 'authenticator', sessionId?: string): Observable<MfaSetupResponse> {
    return this.http.post<MfaSetupResponse>(`${this.baseUrl}/mfa-setup`, { email, method, sessionId });
  }

  /**
   * Get registration session
   */
  getSession(sessionId: string): Observable<RegistrationSession> {
    return this.http.get<RegistrationSession>(`${this.baseUrl}/session/${sessionId}`);
  }

  /**
   * Complete registration
   */
  completeRegistration(data: CompleteRegistrationRequest): Observable<CompleteRegistrationResponse> {
    return this.http.post<CompleteRegistrationResponse>(`${this.baseUrl}/complete`, data);
  }

  /**
   * Validate password strength (client-side check, server also validates)
   */
  validatePassword(password: string): PasswordStrength {
    const errors: string[] = [];
    const suggestions: string[] = [];
    let score = 0;

    // Length check
    if (password.length < 12) {
      errors.push('Password must be at least 12 characters');
      suggestions.push(`Add ${12 - password.length} more characters`);
    } else {
      score += 1;
    }

    // Uppercase check
    if (!/[A-Z]/.test(password)) {
      errors.push('Add at least one uppercase letter');
      suggestions.push('Add an uppercase letter (A-Z)');
    } else {
      score += 1;
    }

    // Lowercase check
    if (!/[a-z]/.test(password)) {
      errors.push('Add at least one lowercase letter');
      suggestions.push('Add a lowercase letter (a-z)');
    } else {
      score += 1;
    }

    // Number check
    if (!/[0-9]/.test(password)) {
      errors.push('Add at least one number');
      suggestions.push('Add a number (0-9)');
    } else {
      score += 1;
    }

    // Special character check
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Add at least one special character');
      suggestions.push('Add a special character (!@#$%^&*)');
    } else {
      score += 1;
    }

    // Additional scoring
    if (password.length >= 16) score += 1;
    if (/\d{3,}/.test(password)) score += 1;

    // Strength determination
    let strength: PasswordStrength['strength'];
    if (score < 3) {
      strength = 'weak';
    } else if (score < 4) {
      strength = 'fair';
    } else if (score < 6) {
      strength = 'good';
    } else if (score < 8) {
      strength = 'strong';
    } else {
      strength = 'excellent';
    }

    return {
      isValid: errors.length === 0,
      score: Math.min(score, 10),
      strength,
      errors,
      suggestions: suggestions.slice(0, 3),
    };
  }

  /**
   * Generate organization code from name
   */
  generateOrgCode(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .slice(0, 3)
      .map(word => word.substring(0, 4))
      .join('')
      .substring(0, 12);
  }
}
