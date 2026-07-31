import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface RegisterState {
  currentStep: number;
  registrationType: 'new_org' | 'invite' | null;

  // Step 3: Basic Information
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  mobile: string;
  country: string;
  timezone: string;
  language: string;

  // Step 4: Email Verification
  emailOtpCode: string;
  emailVerified: boolean;

  // Step 5: Mobile Verification
  mobileOtpCode: string;
  mobileVerified: boolean;

  // Step 6: Organization Information
  organizationName: string;
  organizationCode: string;
  industry: string;
  organizationSize: string;
  website: string;
  gstNumber: string;
  taxNumber: string;
  logoUrl: string | null;
  useCases: string[];

  // Step 7: Branch Setup
  branchName: string;
  branchAddress: string;
  branchCity: string;
  branchState: string;
  branchCountry: string;
  branchPincode: string;

  // Step 8: Password Creation
  password: string;
  confirmPassword: string;

  // Step 9: Security Setup (MFA)
  mfaMethod: 'email_otp' | 'authenticator' | 'sms' | null;
  mfaEnabled: boolean;
  mfaSecret: string;
  mfaQrCode: string;
  mfaCode: string;

  // Step 10: Terms & Privacy
  termsAccepted: boolean;
  privacyAccepted: boolean;
  cookieAccepted: boolean;
  securityAlertsEnabled: boolean;
  marketingEmails: boolean;

  // Step 12-13: Success
  successData: any;

  // UI States
  loading: boolean;
  error: string | null;
}

const initial: RegisterState = {
  currentStep: 1,
  registrationType: null,

  firstName: '',
  lastName: '',
  displayName: '',
  email: '',
  mobile: '',
  country: '',
  timezone: 'UTC',
  language: 'en',

  emailOtpCode: '',
  emailVerified: false,

  mobileOtpCode: '',
  mobileVerified: false,

  organizationName: '',
  organizationCode: '',
  industry: '',
  organizationSize: '10-50',
  website: '',
  gstNumber: '',
  taxNumber: '',
  logoUrl: null,
  useCases: [],

  branchName: 'Head Office',
  branchAddress: '',
  branchCity: '',
  branchState: '',
  branchCountry: '',
  branchPincode: '',

  password: '',
  confirmPassword: '',

  mfaMethod: 'email_otp',
  mfaEnabled: true,
  mfaSecret: '',
  mfaQrCode: '',
  mfaCode: '',

  termsAccepted: false,
  privacyAccepted: false,
  cookieAccepted: false,
  securityAlertsEnabled: true,
  marketingEmails: false,

  successData: null,

  loading: false,
  error: null,
};

@Injectable()
export class RegisterStore {
  private readonly http = inject(HttpClient);
  private readonly state = signal<RegisterState>(initial);

  // Selectors
  readonly currentStep = computed(() => this.state().currentStep);
  readonly registrationType = computed(() => this.state().registrationType);
  readonly firstName = computed(() => this.state().firstName);
  readonly lastName = computed(() => this.state().lastName);
  readonly displayName = computed(() => this.state().displayName);
  readonly email = computed(() => this.state().email);
  readonly mobile = computed(() => this.state().mobile);
  readonly country = computed(() => this.state().country);
  readonly timezone = computed(() => this.state().timezone);
  readonly language = computed(() => this.state().language);
  readonly emailOtpCode = computed(() => this.state().emailOtpCode);
  readonly emailVerified = computed(() => this.state().emailVerified);
  readonly mobileOtpCode = computed(() => this.state().mobileOtpCode);
  readonly mobileVerified = computed(() => this.state().mobileVerified);
  readonly organizationName = computed(() => this.state().organizationName);
  readonly organizationCode = computed(() => this.state().organizationCode);
  readonly industry = computed(() => this.state().industry);
  readonly organizationSize = computed(() => this.state().organizationSize);
  readonly website = computed(() => this.state().website);
  readonly gstNumber = computed(() => this.state().gstNumber);
  readonly taxNumber = computed(() => this.state().taxNumber);
  readonly logoUrl = computed(() => this.state().logoUrl);
  readonly useCases = computed(() => this.state().useCases);
  readonly branchName = computed(() => this.state().branchName);
  readonly branchAddress = computed(() => this.state().branchAddress);
  readonly branchCity = computed(() => this.state().branchCity);
  readonly branchState = computed(() => this.state().branchState);
  readonly branchCountry = computed(() => this.state().branchCountry);
  readonly branchPincode = computed(() => this.state().branchPincode);
  readonly password = computed(() => this.state().password);
  readonly confirmPassword = computed(() => this.state().confirmPassword);
  readonly mfaMethod = computed(() => this.state().mfaMethod);
  readonly mfaEnabled = computed(() => this.state().mfaEnabled);
  readonly mfaSecret = computed(() => this.state().mfaSecret);
  readonly mfaQrCode = computed(() => this.state().mfaQrCode);
  readonly mfaCode = computed(() => this.state().mfaCode);
  readonly termsAccepted = computed(() => this.state().termsAccepted);
  readonly privacyAccepted = computed(() => this.state().privacyAccepted);
  readonly cookieAccepted = computed(() => this.state().cookieAccepted);
  readonly securityAlertsEnabled = computed(() => this.state().securityAlertsEnabled);
  readonly marketingEmails = computed(() => this.state().marketingEmails);
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly successData = computed(() => this.state().successData);

  // Methods
  nextStep() {
    this.state.update(s => ({ ...s, currentStep: Math.min(s.currentStep + 1, 11), error: null }));
  }

  prevStep() {
    this.state.update(s => ({ ...s, currentStep: Math.max(s.currentStep - 1, 1), error: null }));
  }

  setRegistrationType(type: 'new_org' | 'invite') {
    this.state.update(s => ({ ...s, registrationType: type }));
  }

  updatePersonalInfo(info: Partial<RegisterState>) {
    this.state.update(s => ({ ...s, ...info }));
  }

  updateOrganizationInfo(info: Partial<RegisterState>) {
    this.state.update(s => ({ ...s, ...info }));
  }

  updateBranchInfo(info: Partial<RegisterState>) {
    this.state.update(s => ({ ...s, ...info }));
  }

  updatePassword(info: Partial<RegisterState>) {
    this.state.update(s => ({ ...s, ...info }));
  }

  updateMfaSettings(info: Partial<RegisterState>) {
    this.state.update(s => ({ ...s, ...info }));
  }

  updateTerms(info: Partial<RegisterState>) {
    this.state.update(s => ({ ...s, ...info }));
  }

  setStep(step: number) {
    this.state.update(s => ({ ...s, currentStep: step }));
  }

  async verifyInvitation(code: string): Promise<boolean> {
    this.state.update(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; email: string }>('/api/v1/clean/invitations/verify', { code })
      );
      this.state.update(s => ({
        ...s,
        invitationCode: code,
        invitationEmail: res.email,
        adminEmail: res.email,
        loading: false
      }));
      return true;
    } catch (err: any) {
      const msg = err.error?.error || 'Invalid or already used invitation code.';
      this.state.update(s => ({ ...s, error: msg, loading: false }));
      return false;
    }
  }

  async sendEmailOtp(email: string): Promise<boolean> {
    this.state.update(s => ({ ...s, loading: true, error: null }));
    try {
      await firstValueFrom(
        this.http.post('/api/v1/register/send-email-otp', { email })
      );
      this.state.update(s => ({ ...s, loading: false }));
      return true;
    } catch (err: any) {
      this.state.update(s => ({ ...s, error: 'Failed to send OTP to email.', loading: false }));
      return false;
    }
  }

  async verifyEmailOtp(email: string, code: string): Promise<boolean> {
    this.state.update(s => ({ ...s, loading: true, error: null }));
    try {
      await firstValueFrom(
        this.http.post('/api/v1/register/verify-email', { email, code })
      );
      this.state.update(s => ({ ...s, emailOtpCode: code, loading: false }));
      return true;
    } catch (err: any) {
      this.state.update(s => ({ ...s, error: 'Incorrect email OTP code.', loading: false }));
      return false;
    }
  }

  async loadMfaSetup(email: string, method: string = 'authenticator') {
    this.state.update(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await firstValueFrom(
        this.http.post<{ secret: string; qrCode: string }>('/api/v1/register/mfa-setup', { email, method })
      );
      this.state.update(s => ({
        ...s,
        mfaSecret: res.secret,
        mfaQrCode: res.qrCode,
        loading: false
      }));
    } catch (err: any) {
      this.state.update(s => ({ ...s, error: 'Failed to set up MFA registration.', loading: false }));
    }
  }

  async checkEmailAvailability(email: string): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ available: boolean }>('/api/v1/register/check-email', { email })
      );
      return res.available;
    } catch {
      return false;
    }
  }

  async checkOrgCodeAvailability(code: string): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ available: boolean }>('/api/v1/register/check-org', { organizationCode: code })
      );
      return res.available;
    } catch {
      return false;
    }
  }

  async resendEmailOtp(email: string): Promise<boolean> {
    this.state.update(s => ({ ...s, loading: true, error: null }));
    try {
      await firstValueFrom(
        this.http.post('/api/v1/register/resend-otp', { email, type: 'email' })
      );
      this.state.update(s => ({ ...s, loading: false }));
      return true;
    } catch (err: any) {
      const msg = err.error?.message || 'Failed to resend OTP. Please try again.';
      this.state.update(s => ({ ...s, error: msg, loading: false }));
      return false;
    }
  }

  resetForm() {
    this.state.set(initial);
  }

  async submitRegistration() {
    this.state.update(s => ({ ...s, loading: true, error: null }));
    const s = this.state();

    const payload = {
      // Personal Info
      email: s.email,
      emailVerified: s.emailVerified,
      firstName: s.firstName,
      lastName: s.lastName,

      // Organization Info
      organizationName: s.organizationName,
      organizationCode: s.organizationCode,
      industry: s.industry,
      size: s.organizationSize,
      logoUrl: s.logoUrl,
      useCases: s.useCases,

      // Branch Info
      branchName: s.branchName,
      branchAddress: s.branchAddress,
      branchCity: s.branchCity,
      branchState: s.branchState,
      branchCountry: s.branchCountry,
      branchPincode: s.branchPincode,

      // Credentials
      password: s.password,
      confirmPassword: s.confirmPassword,

      // MFA
      mfaEnabled: s.mfaEnabled,
      mfaMethod: s.mfaMethod,

      // Terms
      termsAccepted: s.termsAccepted,
      privacyAccepted: s.privacyAccepted,
      cookieAccepted: s.cookieAccepted,
      marketingConsent: s.marketingEmails,

      // Location
      country: s.country,
      timezone: s.timezone,
      language: s.language,
    };

    try {
      const res = await firstValueFrom(
        this.http.post<any>('/api/v1/register/complete', payload)
      );
      this.state.update(s => ({ ...s, successData: res.data, currentStep: 11, loading: false }));
      return true;
    } catch (err: any) {
      const msg = err.error?.message || err.error?.error || 'Registration failed. Please check your details.';
      this.state.update(s => ({ ...s, error: msg, loading: false }));
      return false;
    }
  }
}
