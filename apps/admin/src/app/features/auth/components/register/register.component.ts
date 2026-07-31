import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RegisterStore } from './register.store';
import { OtpInputComponent } from '../../../../shared/components/otp-input.component';
import { DragDropUploadComponent } from '../../../../shared/components/drag-drop-upload.component';
import { PasswordStrengthComponent } from '../../../../shared/components/password-strength.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    OtpInputComponent,
    DragDropUploadComponent,
    PasswordStrengthComponent
  ],
  providers: [RegisterStore],
  templateUrl: './register.component.html',
  styleUrls: ['../../auth-shell.css', './register.component.css'],
})
export class RegisterComponent implements OnInit {
  readonly store = inject(RegisterStore);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  // Forms for different steps
  registrationTypeForm!: FormGroup;
  basicInfoForm!: FormGroup;
  emailOtpForm!: FormGroup;
  mobileOtpForm!: FormGroup;
  organizationForm!: FormGroup;
  branchForm!: FormGroup;
  passwordForm!: FormGroup;
  mfaForm!: FormGroup;
  termsForm!: FormGroup;

  // Timer for OTPs
  emailTimer = signal<number>(0);
  emailInterval: any;
  mobileTimer = signal<number>(0);
  mobileInterval: any;

  // Local state
  mobileOtpCode = signal<string>('');
  emailOtpCodeInput = signal<string>('');
  mfaCodeInput = signal<string>('');

  // 13-Step Flow per Specification
  steps = [
    { step: 1, title: 'Welcome', desc: 'Registration Type' },
    { step: 2, title: 'Registration Type', desc: 'Choose Setup' },
    { step: 3, title: 'Basic Information', desc: 'Personal Details' },
    { step: 4, title: 'Email Verification', desc: 'OTP Verification' },
    { step: 5, title: 'Mobile Verification', desc: 'SMS OTP (Optional)' },
    { step: 6, title: 'Organization Info', desc: 'Company Details' },
    { step: 7, title: 'Branch Setup', desc: 'Head Office' },
    { step: 8, title: 'Password Creation', desc: 'Set Password' },
    { step: 9, title: 'Security Setup', desc: 'Enable MFA' },
    { step: 10, title: 'Terms & Privacy', desc: 'Agreements' },
    { step: 11, title: 'Review', desc: 'Confirm Details' },
    { step: 12, title: 'Account Creation', desc: 'Processing...' },
    { step: 13, title: 'Welcome Screen', desc: 'Success!' }
  ];

  visualSteps = [
    { title: 'WELCOME', icon: '👤', step: 1 },
    { title: 'REGISTRATION TYPE', icon: '📋', step: 2 },
    { title: 'BASIC INFO', icon: '👤', step: 3 },
    { title: 'EMAIL', icon: '📧', step: 4 },
    { title: 'MOBILE', icon: '📱', step: 5 },
    { title: 'ORGANIZATION', icon: '🏢', step: 6 },
    { title: 'BRANCH', icon: '🏬', step: 7 }
  ];

  // Left panel social proof avatars
  trustAvatars = ['🧑', '👩', '🧔', '👩‍🦰', '🧑‍🦱', '👨'];

  useCaseOptions = [
    { value: 'project-management', label: 'Project Management', icon: '📁' },
    { value: 'crm', label: 'CRM', icon: '👤' },
    { value: 'analytics', label: 'Analytics', icon: '📈' },
    { value: 'hr-management', label: 'HR Management', icon: '👥' },
    { value: 'other', label: 'Other', icon: '•••' }
  ];

  countryOptions = [
    'India', 'United States', 'United Kingdom', 'Canada', 'Australia',
    'Germany', 'France', 'Singapore', 'United Arab Emirates', 'Japan'
  ];

  selectedUseCases = signal<string[]>([]);

  isUseCaseSelected(value: string): boolean {
    return this.selectedUseCases().includes(value);
  }

  toggleUseCase(value: string) {
    this.selectedUseCases.update(list =>
      list.includes(value) ? list.filter(v => v !== value) : [...list, value]
    );
  }

  activeVisualStep = computed(() => {
    const logicalStep = this.store.currentStep();
    if (logicalStep <= 6) return logicalStep - 1;
    return 6;
  });

  ngOnInit() {
    // Step 3: Basic Information
    this.basicInfoForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      displayName: ['', [Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      mobile: ['', [Validators.required]],
      country: ['', [Validators.required]],
      timezone: ['UTC', [Validators.required]],
      language: ['en', [Validators.required]]
    });

    // Step 4: Email OTP
    this.emailOtpForm = this.fb.group({
      emailOtp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
    });

    // Step 5: Mobile OTP (Optional)
    this.mobileOtpForm = this.fb.group({
      mobileOtp: ['', [Validators.pattern(/^\d{6}$/)]]
    });

    // Step 6: Organization Information
    this.organizationForm = this.fb.group({
      organizationName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      organizationCode: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9-]{2,16}$/)]],
      industry: ['', [Validators.required]],
      organizationSize: ['10-50', [Validators.required]],
      website: [''],
      gstNumber: [''],
      taxNumber: ['']
    });

    // Step 7: Branch Setup
    this.branchForm = this.fb.group({
      branchName: ['Head Office', [Validators.required, Validators.minLength(2)]],
      branchAddress: [''],
      branchCity: [''],
      branchState: [''],
      branchCountry: ['', [Validators.required]],
      branchPincode: ['']
    });

    // Step 8: Password Creation
    this.passwordForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(12)]],
      confirmPassword: ['', [Validators.required]]
    });

    // Step 9: MFA Setup
    this.mfaForm = this.fb.group({
      mfaMethod: ['email_otp', [Validators.required]],
      mfaCode: ['', [Validators.pattern(/^\d{6}$/)]]
    });

    // Step 10: Terms & Privacy
    this.termsForm = this.fb.group({
      termsAccepted: [false, [Validators.requiredTrue]],
      privacyAccepted: [false, [Validators.requiredTrue]],
      cookieAccepted: [false],
      securityAlertsEnabled: [true],
      marketingEmails: [false]
    });
  }

  // Step 2: Registration Type (Optional Invitation)
  async verifyInvitationCode(inviteCode: string) {
    if (!inviteCode || inviteCode.length < 4) return;
    const ok = await this.store.verifyInvitation(inviteCode);
    if (ok) {
      this.store.nextStep();
    }
  }

  skipInvitationCode() {
    this.store.setRegistrationType('new_org');
    this.store.nextStep();
  }

  // Step 1: Welcome/Registration Type Selection
  selectRegistrationType(type: 'new_org' | 'invite') {
    this.store.setRegistrationType(type);
    this.store.nextStep();
  }

  // Step 3: Basic Information
  saveBasicInfo() {
    if (this.basicInfoForm.invalid) return;
    this.store.updatePersonalInfo({
      firstName: this.basicInfoForm.value.firstName,
      lastName: this.basicInfoForm.value.lastName,
      displayName: this.basicInfoForm.value.displayName,
      email: this.basicInfoForm.value.email,
      mobile: this.basicInfoForm.value.mobile,
      country: this.basicInfoForm.value.country,
      timezone: this.basicInfoForm.value.timezone,
      language: this.basicInfoForm.value.language
    });
    this.store.nextStep();
  }

  // Step 4: Email OTP
  async sendEmailOtp() {
    const email = this.store.email();
    if (!email) return;
    const ok = await this.store.sendEmailOtp(email);
    if (ok) this.startEmailTimer();
  }

  startEmailTimer() {
    this.emailTimer.set(900); // 15 minutes
    clearInterval(this.emailInterval);
    this.emailInterval = setInterval(() => {
      if (this.emailTimer() > 0) {
        this.emailTimer.update(t => t - 1);
      } else {
        clearInterval(this.emailInterval);
      }
    }, 1000);
  }

  async verifyEmailOtp() {
    const ok = await this.store.verifyEmailOtp(this.store.email(), this.emailOtpCodeInput());
    if (ok) {
      clearInterval(this.emailInterval);
      this.store.nextStep();
    }
  }

  async resendEmailOtp() {
    const ok = await this.store.resendEmailOtp(this.store.email());
    if (ok) this.startEmailTimer();
  }

  // Step 5: Mobile OTP (Optional)
  async sendMobileOtp() {
    const mobile = this.store.mobile();
    if (!mobile) return;
    // TODO: Implement mobile OTP
  }

  skipMobileVerification() {
    this.store.nextStep();
  }

  // Step 6: Organization Information
  async checkOrgCode() {
    const code = this.organizationForm?.value?.organizationCode;
    if (code) {
      await this.store.checkOrgCodeAvailability(code);
      // TODO: Update form validation state based on availability
    }
  }

  onLogoUploaded(logoBase64: string) {
    this.store.updateOrganizationInfo({ logoUrl: logoBase64 });
  }

  saveOrganizationInfo() {
    if (!this.organizationForm || this.organizationForm.invalid) return;
    this.store.updateOrganizationInfo({
      organizationName: this.organizationForm.value.organizationName,
      organizationCode: this.organizationForm.value.organizationCode,
      industry: this.organizationForm.value.industry,
      organizationSize: this.organizationForm.value.organizationSize,
      website: this.organizationForm.value.website,
      gstNumber: this.organizationForm.value.gstNumber,
      taxNumber: this.organizationForm.value.taxNumber,
      useCases: this.selectedUseCases()
    });
    this.store.nextStep();
  }

  // Step 7: Branch Setup
  saveBranchInfo() {
    if (!this.branchForm || this.branchForm.invalid) return;
    this.store.updateBranchInfo({
      branchName: this.branchForm.value.branchName,
      branchAddress: this.branchForm.value.branchAddress,
      branchCity: this.branchForm.value.branchCity,
      branchState: this.branchForm.value.branchState,
      branchCountry: this.branchForm.value.branchCountry,
      branchPincode: this.branchForm.value.branchPincode
    });
    this.store.nextStep();
  }

  // Step 8: Password Creation
  savePassword() {
    if (!this.passwordForm || this.passwordForm.invalid) return;
    this.store.updatePassword({
      password: this.passwordForm.value.password,
      confirmPassword: this.passwordForm.value.confirmPassword
    });
    this.store.nextStep();
  }

  // Step 9: Security Setup (MFA)
  selectMfaMethod(method: 'email_otp' | 'authenticator' | 'sms') {
    this.store.updateMfaSettings({ mfaMethod: method });
    if (method === 'authenticator') {
      this.loadMfaSetup();
    }
  }

  async loadMfaSetup() {
    const email = this.store.email();
    const method = this.store.mfaMethod();
    if (email && method) {
      await this.store.loadMfaSetup(email, method);
    }
  }

  // Step 10: Terms & Privacy
  saveTermsAndPrivacy() {
    if (!this.termsForm || this.termsForm.invalid) return;
    this.store.updateTerms({
      termsAccepted: this.termsForm.value.termsAccepted,
      privacyAccepted: this.termsForm.value.privacyAccepted,
      cookieAccepted: this.termsForm.value.cookieAccepted,
      securityAlertsEnabled: this.termsForm.value.securityAlertsEnabled,
      marketingEmails: this.termsForm.value.marketingEmails
    });
    this.store.nextStep();
  }

  // Step 11: Review - Display Summary
  getRegistrationSummary() {
    return {
      firstName: this.store.firstName(),
      lastName: this.store.lastName(),
      email: this.store.email(),
      organizationName: this.store.organizationName(),
      organizationCode: this.store.organizationCode(),
      industry: this.store.industry(),
      branchName: this.store.branchName(),
      country: this.store.country()
    };
  }

  // Step 11: Review - Confirm and Submit
  async confirmAndCreateAccount() {
    // Step 12: Account Creation (backend processing)
    this.store.nextStep(); // Move to Step 12
    const success = await this.store.submitRegistration();
    if (success) {
      // Step 13: Welcome Screen
      this.store.nextStep();
      // Schedule redirect to dashboard after delay
      setTimeout(() => {
        this.router.navigate(['/auth/welcome']);
      }, 2000);
    }
  }

  navigateToLogin() {
    this.router.navigate(['/auth/login']);
  }

  navigateToDashboard() {
    this.router.navigate(['/dashboard']);
  }
}
