import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DdlApiService, DdlItem } from '../../../../core/api/ddl.api';

const DRAFT_STORAGE_KEY = 'zellavora_reg_draft';
const SESSION_STORAGE_KEY = 'zellavora_reg_session_id';

const SENSITIVE_KEYS = [
  'password',
  'confirmPassword',
  'mfaSecret',
  'mfaQrCode',
  'mfaCode',
  'emailOtpCode',
  'mobileOtpCode',
  'successData',
  'loading',
  'error',
  'ddl',
  'ddlLoaded',
  'ddlLoading',
] as const;

type SensitiveKey = (typeof SENSITIVE_KEYS)[number];

type DraftState = Omit<RegisterState, SensitiveKey>;

export interface RegisterState {
  currentStep: number;
  registrationType: 'new_org' | 'invite' | null;
  sessionId: string | null;

  // Step 3: Basic Information
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  mobile: string;
  country: string;
  timezone: string;
  language: string;
  gender: string;

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
  branchPhone: string;
  branchEmail: string;
  branchLatitude: string;
  branchLongitude: string;

  // Step 6: Organization financials
  currency: string;
  fiscalYear: string;

  // Step 8: Password Creation
  password: string;
  confirmPassword: string;

  // Step 9: Security Setup (MFA)
  mfaMethod: 'email_otp' | 'authenticator' | 'sms' | null;
  mfaEnabled: boolean;
  mfaSecret: string;
  mfaQrCode: string;
  mfaCode: string;
  mfaVerified: boolean;

  // Step 10: Terms & Privacy
  termsAccepted: boolean;
  privacyAccepted: boolean;
  cookieAccepted: boolean;
  securityAlertsEnabled: boolean;
  marketingEmails: boolean;

  // Step 2: Invitation
  invitationCode: string;
  invitationEmail: string;

  // Step 12-13: Success
  successData: any;

  // UI States
  loading: boolean;
  error: string | null;

  // DDL options (loaded from backend)
  ddlLoaded: boolean;
  ddlLoading: boolean;
  ddl: Record<string, DdlItem[]>;
}

const initial: RegisterState = {
  currentStep: 1,
  registrationType: null,
  sessionId: null,

  firstName: '',
  lastName: '',
  displayName: '',
  email: '',
  mobile: '',
  country: '',
  timezone: 'UTC',
  language: 'en',
  gender: '',

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
  branchPhone: '',
  branchEmail: '',
  branchLatitude: '',
  branchLongitude: '',

  currency: 'USD',
  fiscalYear: 'january-december',

  password: '',
  confirmPassword: '',

  mfaMethod: 'email_otp',
  mfaEnabled: true,
  mfaSecret: '',
  mfaQrCode: '',
  mfaCode: '',
  mfaVerified: false,

  termsAccepted: false,
  privacyAccepted: false,
  cookieAccepted: false,
  securityAlertsEnabled: true,
  marketingEmails: false,

  invitationCode: '',
  invitationEmail: '',

  successData: null,

  loading: false,
  error: null,

  ddlLoaded: false,
  ddlLoading: false,
  ddl: {},
};

@Injectable()
export class RegisterStore {
  private readonly http = inject(HttpClient);
  private readonly ddlApi = inject(DdlApiService);
  private readonly state = signal<RegisterState>(initial);

  // Selectors
  readonly ddl = computed(() => this.state().ddl);
  readonly ddlLoaded = computed(() => this.state().ddlLoaded);
  readonly ddlLoading = computed(() => this.state().ddlLoading);
  readonly countryOptions = computed(() =>
    this.state().ddl['country']?.map((c) => c.value) ?? []
  );
  readonly languageOptions = computed(() => this.state().ddl['language'] ?? []);
  readonly genderOptions = computed(() => this.state().ddl['gender'] ?? []);
  readonly currentStep = computed(() => this.state().currentStep);
  readonly sessionId = computed(() => this.state().sessionId);
  readonly registrationType = computed(() => this.state().registrationType);
  readonly firstName = computed(() => this.state().firstName);
  readonly lastName = computed(() => this.state().lastName);
  readonly displayName = computed(() => this.state().displayName);
  readonly email = computed(() => this.state().email);
  readonly mobile = computed(() => this.state().mobile);
  readonly country = computed(() => this.state().country);
  readonly timezone = computed(() => this.state().timezone);
  readonly language = computed(() => this.state().language);
  readonly gender = computed(() => this.state().gender);
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
  readonly branchPhone = computed(() => this.state().branchPhone);
  readonly branchEmail = computed(() => this.state().branchEmail);
  readonly branchLatitude = computed(() => this.state().branchLatitude);
  readonly branchLongitude = computed(() => this.state().branchLongitude);
  readonly currency = computed(() => this.state().currency);
  readonly fiscalYear = computed(() => this.state().fiscalYear);
  readonly invitationCode = computed(() => this.state().invitationCode);
  readonly invitationEmail = computed(() => this.state().invitationEmail);
  readonly password = computed(() => this.state().password);
  readonly confirmPassword = computed(() => this.state().confirmPassword);
  readonly mfaMethod = computed(() => this.state().mfaMethod);
  readonly mfaEnabled = computed(() => this.state().mfaEnabled);
  readonly mfaSecret = computed(() => this.state().mfaSecret);
  readonly mfaQrCode = computed(() => this.state().mfaQrCode);
  readonly mfaCode = computed(() => this.state().mfaCode);
  readonly mfaVerified = computed(() => this.state().mfaVerified);
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
    this.state.update((s) => ({ ...s, currentStep: Math.min(s.currentStep + 1, 13), error: null }));
    this.saveDraft();
  }

  prevStep() {
    this.state.update((s) => ({ ...s, currentStep: Math.max(s.currentStep - 1, 1), error: null }));
    this.saveDraft();
  }

  setRegistrationType(type: 'new_org' | 'invite') {
    this.state.update((s) => ({ ...s, registrationType: type }));
    this.saveDraft();
  }

  updatePersonalInfo(info: Partial<RegisterState>) {
    this.state.update((s) => ({ ...s, ...info }));
    this.saveDraft();
  }

  updateOrganizationInfo(info: Partial<RegisterState>) {
    this.state.update((s) => ({ ...s, ...info }));
    this.saveDraft();
  }

  updateBranchInfo(info: Partial<RegisterState>) {
    this.state.update((s) => ({ ...s, ...info }));
    this.saveDraft();
  }

  updatePassword(info: Partial<RegisterState>) {
    this.state.update((s) => ({ ...s, ...info }));
    this.saveDraft();
  }

  updateMfaSettings(info: Partial<RegisterState>) {
    this.state.update((s) => ({ ...s, ...info }));
    this.saveDraft();
  }

  updateTerms(info: Partial<RegisterState>) {
    this.state.update((s) => ({ ...s, ...info }));
    this.saveDraft();
  }

  setStep(step: number) {
    this.state.update((s) => ({ ...s, currentStep: step }));
    this.saveDraft();
  }

  setSessionId(sessionId: string) {
    this.state.update((s) => ({ ...s, sessionId }));
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    } catch {
      // localStorage unavailable
    }
  }

  getSessionId(): string | null {
    return this.state().sessionId;
  }

  private getDraftPayload(): DraftState {
    const s = this.state();
    const payload: Partial<RegisterState> = {};
    for (const key of Object.keys(s) as Array<keyof RegisterState>) {
      if (!(SENSITIVE_KEYS as readonly string[]).includes(key)) {
        payload[key] = s[key];
      }
    }
    return payload as DraftState;
  }

  saveDraft(): void {
    try {
      const payload = this.getDraftPayload() as DraftState & { _savedAt?: number };
      payload._savedAt = Date.now();
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // localStorage unavailable or quota exceeded
    }
  }

  loadDraft(): Partial<RegisterState> | null {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      delete parsed._savedAt;
      return parsed as Partial<RegisterState>;
    } catch {
      return null;
    }
  }

  restoreDraft(): boolean {
    const draft = this.loadDraft();
    if (!draft) return false;
    this.state.update((s) => ({ ...s, ...draft }));
    return true;
  }

  clearDraft(): void {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // localStorage unavailable
    }
  }

  hasDraft(): boolean {
    try {
      return localStorage.getItem(DRAFT_STORAGE_KEY) !== null;
    } catch {
      return false;
    }
  }

  async syncProgressToBackend(): Promise<void> {
    const sessionId = this.state().sessionId;
    if (!sessionId) return;
    try {
      const payload = this.getDraftPayload();
      await firstValueFrom(
        this.http.put('/api/v1/register/save-progress', {
          ...payload,
          sessionId,
        })
      );
    } catch {
      // Silently fail - localStorage is the source of truth
    }
  }

  async initializeSession(): Promise<string | null> {
    const existingSessionId = this.state().sessionId;
    if (existingSessionId) return existingSessionId;

    const storedSessionId = this.getStoredSessionId();
    if (storedSessionId) {
      this.state.update((s) => ({ ...s, sessionId: storedSessionId }));
      return storedSessionId;
    }

    try {
      const s = this.state();
      const email = s.email || '';
      if (!email) return null;
      const res = await firstValueFrom(
        this.http.post<{ sessionId: string }>('/api/v1/register/init', {
          email,
          firstName: s.firstName || 'New',
          lastName: s.lastName || 'User',
          displayName: s.displayName || undefined,
          mobile: s.mobile || undefined,
          country: s.country || 'US',
          timezone: s.timezone || 'UTC',
          language: s.language || 'en',
        })
      );
      const sessionId = res.sessionId;
      this.state.update((s) => ({ ...s, sessionId }));
      this.storeSessionId(sessionId);
      return sessionId;
    } catch {
      return null;
    }
  }

  private getStoredSessionId(): string | null {
    try {
      return localStorage.getItem(SESSION_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private storeSessionId(sessionId: string): void {
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    } catch {
      // localStorage unavailable
    }
  }

  async verifyInvitation(code: string): Promise<boolean> {
    this.state.update((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; email: string }>('/api/v1/clean/invitations/verify', {
          code,
        })
      );
      this.state.update((s) => ({
        ...s,
        invitationCode: code,
        invitationEmail: res.email,
        adminEmail: res.email,
        loading: false,
      }));
      this.saveDraft();
      return true;
    } catch (err: any) {
      const msg = err.error?.error || 'Invalid or already used invitation code.';
      this.state.update((s) => ({ ...s, error: msg, loading: false }));
      return false;
    }
  }

  async sendEmailOtp(email: string): Promise<boolean> {
    this.state.update((s) => ({ ...s, loading: true, error: null }));
    try {
      await firstValueFrom(this.http.post('/api/v1/register/send-email-otp', { email }));
      this.state.update((s) => ({ ...s, loading: false }));
      return true;
    } catch (err: any) {
      this.state.update((s) => ({ ...s, error: 'Failed to send OTP to email.', loading: false }));
      return false;
    }
  }

  async verifyEmailOtp(email: string, code: string): Promise<boolean> {
    this.state.update((s) => ({ ...s, loading: true, error: null }));
    try {
      await firstValueFrom(this.http.post('/api/v1/register/verify-email', { email, code }));
      this.state.update((s) => ({ ...s, emailOtpCode: code, loading: false }));
      return true;
    } catch (err: any) {
      this.state.update((s) => ({ ...s, error: 'Incorrect email OTP code.', loading: false }));
      return false;
    }
  }

  async loadMfaSetup(email: string, method: string = 'authenticator') {
    this.state.update((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await firstValueFrom(
        this.http.post<{ secret: string; qrCode: string }>('/api/v1/register/mfa-setup', {
          email,
          method,
        })
      );
      this.state.update((s) => ({
        ...s,
        mfaSecret: res.secret,
        mfaQrCode: res.qrCode,
        loading: false,
      }));
    } catch (err: any) {
      this.state.update((s) => ({
        ...s,
        error: 'Failed to set up MFA registration.',
        loading: false,
      }));
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
        this.http.post<{ available: boolean }>('/api/v1/register/check-org', {
          organizationCode: code,
        })
      );
      return res.available;
    } catch {
      return false;
    }
  }

  async resendEmailOtp(email: string): Promise<boolean> {
    this.state.update((s) => ({ ...s, loading: true, error: null }));
    try {
      await firstValueFrom(this.http.post('/api/v1/register/resend-otp', { email, type: 'email' }));
      this.state.update((s) => ({ ...s, loading: false }));
      return true;
    } catch (err: any) {
      const msg = err.error?.message || 'Failed to resend OTP. Please try again.';
      this.state.update((s) => ({ ...s, error: msg, loading: false }));
      return false;
    }
  }

  /** Derive the international dialing code for a country name or code. */
  getPhoneCode(country: string): string {
    if (!country) return '+91';
    const items = this.state().ddl['country'] ?? [];
    const match = items.find(
      (c) =>
        c.value?.toLowerCase() === country.toLowerCase() ||
        c.key?.toLowerCase() === country.toLowerCase()
    );
    return match?.phoneCode ?? '+91';
  }

  async sendMobileOtp(mobile: string): Promise<boolean> {
    this.state.update((s) => ({ ...s, loading: true, error: null }));
    try {
      const countryCode = this.getPhoneCode(this.state().country);
      const sessionId = this.getSessionId() ?? undefined;
      await firstValueFrom(
        this.http.post('/api/v1/register/send-mobile-otp', { mobile, countryCode, sessionId })
      );
      this.state.update((s) => ({ ...s, loading: false }));
      return true;
    } catch (err: any) {
      const msg = err.error?.message || 'Failed to send OTP to your mobile number.';
      this.state.update((s) => ({ ...s, error: msg, loading: false }));
      return false;
    }
  }

  async verifyMobileOtp(mobile: string, code: string): Promise<boolean> {
    this.state.update((s) => ({ ...s, loading: true, error: null }));
    try {
      const full = this.getPhoneCode(this.state().country) + mobile;
      const sessionId = this.getSessionId() ?? undefined;
      await firstValueFrom(
        this.http.post('/api/v1/register/verify-mobile', { mobile: full, code, sessionId })
      );
      this.state.update((s) => ({ ...s, mobileOtpCode: code, mobileVerified: true, loading: false }));
      this.saveDraft();
      return true;
    } catch (err: any) {
      const msg = err.error?.message || 'Incorrect mobile OTP code.';
      this.state.update((s) => ({ ...s, error: msg, loading: false }));
      return false;
    }
  }

  async resendMobileOtp(mobile: string): Promise<boolean> {
    this.state.update((s) => ({ ...s, loading: true, error: null }));
    try {
      const full = this.getPhoneCode(this.state().country) + mobile;
      await firstValueFrom(
        this.http.post('/api/v1/register/resend-otp', { email: full, type: 'mobile' })
      );
      this.state.update((s) => ({ ...s, loading: false }));
      return true;
    } catch (err: any) {
      const msg = err.error?.message || 'Failed to resend OTP. Please try again.';
      this.state.update((s) => ({ ...s, error: msg, loading: false }));
      return false;
    }
  }

  async verifyMfaCode(code: string): Promise<boolean> {
    this.state.update((s) => ({ ...s, loading: true, error: null, mfaCode: code }));
    try {
      const sessionId = this.getSessionId() ?? undefined;
      await firstValueFrom(
        this.http.post('/api/v1/register/verify-mfa', {
          email: this.state().email,
          code,
          sessionId,
        })
      );
      this.state.update((s) => ({ ...s, mfaVerified: true, loading: false }));
      this.saveDraft();
      return true;
    } catch (err: any) {
      const msg = err.error?.message || 'Incorrect authentication code.';
      this.state.update((s) => ({ ...s, mfaVerified: false, error: msg, loading: false }));
      return false;
    }
  }

  async checkOrgNameAvailability(name: string): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ available: boolean }>('/api/v1/register/check-org-name', {
          organizationName: name,
        })
      );
      return res.available;
    } catch {
      return true;
    }
  }

  async loadDdls(): Promise<void> {
    if (this.state().ddlLoaded || this.state().ddlLoading) return;
    this.state.update((s) => ({ ...s, ddlLoading: true }));
    try {
      const res = await firstValueFrom(this.ddlApi.getAll());
      this.state.update((s) => ({ ...s, ddl: res.data, ddlLoaded: true, ddlLoading: false }));
    } catch {
      this.state.update((s) => ({ ...s, ddlLoading: false }));
    }
  }

  resetForm() {
    this.state.set(initial);
    this.clearDraft();
  }

  async submitRegistration() {
    this.state.update((s) => ({ ...s, loading: true, error: null }));
    const s = this.state();

    const payload = {
      // Session reference
      sessionId: s.sessionId ?? undefined,

      // Personal Info
      email: s.email,
      emailVerified: s.emailVerified,
      firstName: s.firstName,
      lastName: s.lastName,
      displayName: s.displayName,
      mobile: s.mobile,
      mobileVerified: s.mobileVerified,

      // Organization Info
      organizationName: s.organizationName,
      organizationCode: s.organizationCode,
      industry: s.industry,
      size: s.organizationSize,
      website: s.website,
      gstNumber: s.gstNumber,
      taxNumber: s.taxNumber,
      logoUrl: s.logoUrl,
      useCases: s.useCases,
      currency: s.currency,
      fiscalYear: s.fiscalYear,

      // Branch Info
      branchName: s.branchName,
      branchAddress: s.branchAddress,
      branchCity: s.branchCity,
      branchState: s.branchState,
      branchCountry: s.branchCountry,
      branchPincode: s.branchPincode,
      branchPhone: s.branchPhone,
      branchEmail: s.branchEmail,
      branchLatitude: s.branchLatitude,
      branchLongitude: s.branchLongitude,

      // Credentials
      password: s.password,
      confirmPassword: s.confirmPassword,

      // MFA
      mfaEnabled: s.mfaEnabled,
      mfaMethod: s.mfaMethod,
      mfaCode: s.mfaCode,

      // Terms
      termsAccepted: s.termsAccepted,
      privacyAccepted: s.privacyAccepted,
      cookieAccepted: s.cookieAccepted,
      marketingConsent: s.marketingEmails,

      // Location
      country: s.country,
      timezone: s.timezone,
      language: s.language,
      gender: s.gender,

      // Invite
      inviteCode: s.invitationCode || undefined,
    };

    try {
      const res = await firstValueFrom(this.http.post<any>('/api/v1/register/complete', payload));
      this.state.update((s) => ({ ...s, successData: res.data, currentStep: 13, loading: false }));
      this.clearDraft();
      try {
        sessionStorage.setItem(
          'zcc.welcomeName',
          res.data?.user?.fullName?.split(' ')[0] || s.firstName || 'there'
        );
        sessionStorage.setItem(
          'zcc.welcomeOrg',
          res.data?.organization?.name || s.organizationName || 'your organization'
        );
      } catch {
        // sessionStorage unavailable
      }
      return true;
    } catch (err: any) {
      const msg =
        err.error?.message || err.error?.error || 'Registration failed. Please check your details.';
      this.state.update((s) => ({ ...s, error: msg, loading: false, currentStep: 11 }));
      return false;
    }
  }
}
