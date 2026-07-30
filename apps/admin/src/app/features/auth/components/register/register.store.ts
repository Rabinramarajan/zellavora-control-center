import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, tap } from 'rxjs/operators';
import { firstValueFrom, of } from 'rxjs';

export interface RegisterState {
  currentStep: number;
  welcomeType: 'organization' | 'partner' | null;
  invitationCode: string;
  invitationEmail: string;

  // Company Info
  companyName: string;
  companyClientCode: string;
  companyLogoUrl: string | null;
  companyIndustry: string;
  companyEmployees: string;

  // Branch Info
  branchName: string;
  branchCode: string;

  // Admin Info
  adminFullName: string;
  adminEmail: string;
  adminDesignation: string;

  // Credentials
  credentialsUsername: string;
  credentialsPassword: string;

  // Verification Codes
  emailOtpCode: string;
  mfaCode: string;

  // MFA Details
  mfaSecret: string;
  mfaQrCode: string;

  // UI States
  loading: boolean;
  error: string | null;
  successData: any;
}

const initial: RegisterState = {
  currentStep: 1,
  welcomeType: null,
  invitationCode: '',
  invitationEmail: '',
  companyName: '',
  companyClientCode: '',
  companyLogoUrl: null,
  companyIndustry: 'technology',
  companyEmployees: '10-50',
  branchName: '',
  branchCode: '',
  adminFullName: '',
  adminEmail: '',
  adminDesignation: '',
  credentialsUsername: '',
  credentialsPassword: '',
  emailOtpCode: '',
  mfaCode: '',
  mfaSecret: '',
  mfaQrCode: '',
  loading: false,
  error: null,
  successData: null,
};

@Injectable()
export class RegisterStore {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  
  private readonly state = signal<RegisterState>(initial);

  // Selectors
  readonly currentStep = computed(() => this.state().currentStep);
  readonly welcomeType = computed(() => this.state().welcomeType);
  readonly invitationCode = computed(() => this.state().invitationCode);
  readonly companyName = computed(() => this.state().companyName);
  readonly companyClientCode = computed(() => this.state().companyClientCode);
  readonly companyLogoUrl = computed(() => this.state().companyLogoUrl);
  readonly companyIndustry = computed(() => this.state().companyIndustry);
  readonly companyEmployees = computed(() => this.state().companyEmployees);
  readonly branchName = computed(() => this.state().branchName);
  readonly branchCode = computed(() => this.state().branchCode);
  readonly adminFullName = computed(() => this.state().adminFullName);
  readonly adminEmail = computed(() => this.state().adminEmail);
  readonly adminDesignation = computed(() => this.state().adminDesignation);
  readonly credentialsUsername = computed(() => this.state().credentialsUsername);
  readonly credentialsPassword = computed(() => this.state().credentialsPassword);
  readonly mfaSecret = computed(() => this.state().mfaSecret);
  readonly mfaQrCode = computed(() => this.state().mfaQrCode);
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

  setWelcomeType(type: 'organization' | 'partner') {
    this.state.update(s => ({ ...s, welcomeType: type }));
  }

  updateCompany(info: Partial<RegisterState>) {
    this.state.update(s => ({ ...s, ...info }));
  }

  updateBranch(info: Partial<RegisterState>) {
    this.state.update(s => ({ ...s, ...info }));
  }

  updateAdmin(info: Partial<RegisterState>) {
    this.state.update(s => ({ ...s, ...info }));
  }

  updateCredentials(info: Partial<RegisterState>) {
    this.state.update(s => ({ ...s, ...info }));
  }

  updateVerification(info: Partial<RegisterState>) {
    this.state.update(s => ({ ...s, ...info }));
  }

  setStep(step: number) {
    this.state.update(s => ({ ...s, currentStep: step }));
  }

  async verifyInvitation(code: string): Promise<boolean> {
    this.state.update(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; email: string }>('/api/v1/auth/register/verify-invitation', { code })
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
        this.http.post('/api/v1/auth/register/send-email-otp', { email })
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
        this.http.post('/api/v1/auth/register/verify-email-otp', { email, code })
      );
      this.state.update(s => ({ ...s, emailOtpCode: code, loading: false }));
      return true;
    } catch (err: any) {
      this.state.update(s => ({ ...s, error: 'Incorrect email OTP code.', loading: false }));
      return false;
    }
  }

  async loadMfaSetup(email: string) {
    this.state.update(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await firstValueFrom(
        this.http.get<{ secret: string; qrCodeDataUrl: string }>(`/api/v1/auth/register/mfa-setup?email=${encodeURIComponent(email)}`)
      );
      this.state.update(s => ({
        ...s,
        mfaSecret: res.secret,
        mfaQrCode: res.qrCodeDataUrl,
        loading: false
      }));
    } catch (err: any) {
      this.state.update(s => ({ ...s, error: 'Failed to set up MFA registration.', loading: false }));
    }
  }

  async submitAll() {
    this.state.update(s => ({ ...s, loading: true, error: null }));
    const s = this.state();
    
    const payload = {
      invitationCode: s.invitationCode,
      company: {
        name: s.companyName,
        clientCode: s.companyClientCode,
        logoUrl: s.companyLogoUrl,
        industry: s.companyIndustry,
        employees: s.companyEmployees,
      },
      branch: {
        name: s.branchName,
        code: s.branchCode,
      },
      admin: {
        fullName: s.adminFullName,
        email: s.adminEmail,
        designation: s.adminDesignation,
      },
      credentials: {
        username: s.credentialsUsername,
        password: s.credentialsPassword,
      },
      mfaSecret: s.mfaSecret,
      mfaCode: s.mfaCode,
    };

    try {
      const res = await firstValueFrom(
        this.http.post<any>('/api/v1/auth/register/submit', payload)
      );
      this.state.update(s => ({ ...s, successData: res.data, currentStep: 11, loading: false }));
    } catch (err: any) {
      const msg = err.error?.error || 'Registration submission failed. Please verify your MFA key code.';
      this.state.update(s => ({ ...s, error: msg, loading: false }));
    }
  }
}
