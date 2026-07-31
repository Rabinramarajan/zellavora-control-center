import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { RegisterStore } from './register.store';
import { OtpInputComponent } from '../../../../shared/components/otp-input.component';
import { DragDropUploadComponent } from '../../../../shared/components/drag-drop-upload.component';
import { PasswordStrengthComponent } from '../../../../shared/components/password-strength.component';

interface StepDef {
  step: number;
  title: string;
  desc: string;
  short: string;
  icon: string;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    OtpInputComponent,
    DragDropUploadComponent,
    PasswordStrengthComponent,
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

  // Password visibility toggles
  showPassword = signal<boolean>(false);
  showConfirmPassword = signal<boolean>(false);

  // 13-Step Flow per Specification
  steps: StepDef[] = [
    { step: 1, title: 'Welcome', desc: 'Registration Type', short: 'Start', icon: 'sparkles' },
    { step: 2, title: 'Registration Type', desc: 'Choose Setup', short: 'Type', icon: 'layout' },
    {
      step: 3,
      title: 'Basic Information',
      desc: 'Personal Details',
      short: 'Profile',
      icon: 'user',
    },
    {
      step: 4,
      title: 'Email Verification',
      desc: 'OTP Verification',
      short: 'Email',
      icon: 'mail',
    },
    {
      step: 5,
      title: 'Mobile Verification',
      desc: 'SMS OTP (Optional)',
      short: 'Mobile',
      icon: 'phone',
    },
    {
      step: 6,
      title: 'Organization Info',
      desc: 'Company Details',
      short: 'Company',
      icon: 'building',
    },
    { step: 7, title: 'Branch Setup', desc: 'Head Office', short: 'Branch', icon: 'map-pin' },
    { step: 8, title: 'Password Creation', desc: 'Set Password', short: 'Password', icon: 'lock' },
    { step: 9, title: 'Security Setup', desc: 'Enable MFA', short: 'MFA', icon: 'shield' },
    { step: 10, title: 'Terms & Privacy', desc: 'Agreements', short: 'Terms', icon: 'file-text' },
    { step: 11, title: 'Review', desc: 'Confirm Details', short: 'Review', icon: 'list-checks' },
    { step: 12, title: 'Account Creation', desc: 'Processing...', short: 'Setup', icon: 'loader' },
    { step: 13, title: 'Welcome Screen', desc: 'Success!', short: 'Done', icon: 'party-popper' },
  ];

  // Compact milestones for the left-panel command rail
  railSteps = [
    { short: 'Welcome', icon: 'sparkles', step: 1 },
    { short: 'Profile', icon: 'user', step: 3 },
    { short: 'Email', icon: 'mail', step: 4 },
    { short: 'Mobile', icon: 'phone', step: 5 },
    { short: 'Company', icon: 'building', step: 6 },
    { short: 'Branch', icon: 'map-pin', step: 7 },
    { short: 'Password', icon: 'lock', step: 8 },
    { short: 'MFA', icon: 'shield', step: 9 },
    { short: 'Terms', icon: 'file-text', step: 10 },
    { short: 'Review', icon: 'list-checks', step: 11 },
  ];

  // Left panel social proof initials (SVG/letter avatars, no emoji)
  trustAvatars = ['AK', 'MR', 'SN', 'PD', 'JL'];

  useCaseOptions = [
    { value: 'project-management', label: 'Project Management', icon: 'kanban' },
    { value: 'crm', label: 'CRM', icon: 'users' },
    { value: 'analytics', label: 'Analytics', icon: 'chart' },
    { value: 'hr-management', label: 'HR Management', icon: 'briefcase' },
    { value: 'other', label: 'Other', icon: 'grid' },
  ];

  industryOptions = [
    'Healthcare',
    'Banking',
    'Technology',
    'Retail',
    'Finance',
    'Manufacturing',
    'Education',
    'Real Estate',
    'Logistics',
    'Other',
  ];

  selectedUseCases = signal<string[]>([]);

  // Inline SVG icon paths (stroke-based, 24x24 viewBox)
  icons: Record<string, string> = {
    sparkles:
      'M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z M20 3v4 M22 5h-4 M4 17v2 M5 18H3',
    layout: 'M3 3h18v18H3z M3 9h18 M9 21V9',
    user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M22 6l-10 7L2 6',
    phone:
      'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z',
    building:
      'M3 21h18 M5 21V7l7-4 7 4v14 M9 9h.01 M9 12h.01 M9 15h.01 M15 9h.01 M15 12h.01 M15 15h.01 M9 21v-3h6v3',
    'map-pin': 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    lock: 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z M7 11V7a5 5 0 0 1 10 0v4 M12 15v3',
    'eye-off':
      'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94 M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19 M14.12 14.12a3 3 0 1 1-4.24-4.24 M1 1l22 22',
    eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4',
    'file-text':
      'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
    'list-checks': 'M3 6h.01 M3 12h.01 M3 18h.01 M8 6h13 M8 12h13 M8 18h13',
    'party-popper':
      'M5.8 11.3 2 22l10.7-3.79 M4 3h.01 M22 8h.01 M15 2h.01 M22 20h.01 M22 2l-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.76-.01 1.53-.32 2.24L17 9 M9 5l-3.6-1.2a.5.5 0 0 0-.36.94L8 6.8 M12 10l2 4 M5 13l-1 3 M14 5l1.5 3 M8.5 4.5 10 6',
    loader:
      'M12 2v4 M12 18v4 M4.93 4.93l2.83 2.83 M16.24 16.24l2.83 2.83 M2 12h4 M18 12h4 M4.93 19.07l2.83-2.83 M16.24 7.76l2.83-2.83',
    kanban: 'M12 3v12 M5 3v18 M19 3v8 M3 21h18',
    users:
      'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
    chart: 'M18 20V10 M12 20V4 M6 20v-6',
    briefcase: 'M3 7h18v13H3z M8 7V4h8v3 M8 10v2 M16 10v2',
    grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    'arrow-right': 'M5 12h14 M12 5l7 7-7 7',
    'arrow-left': 'M19 12H5 M12 19l-7-7 7-7',
    check: 'M20 6 9 17l-5-5',
    'check-circle': 'M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4 12 14.01l-3-3',
    'chevron-right': 'M9 18l6-6-6-6',
    'chevron-down': 'M6 9l6 6 6-6',
    'x-circle': 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M15 9l-6 6 M9 9l6 6',
    send: 'M22 2 11 13 M22 2l-7 20-4-9-9-4 20-7z',
    refresh:
      'M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
    'shield-check': 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4',
    zap: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
    globe:
      'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M2 12h20 M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
    smartphone:
      'M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z M12 18h.01',
    info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 16v-4 M12 8h.01',
    key: 'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4',
    upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
    award:
      'M8 21h8 M12 17v4 M17 3H7a1 1 0 0 0-1 1v6a6 6 0 0 0 12 0V4a1 1 0 0 0-1-1z M6 5H3a1 1 0 0 0-1 1v2a3 3 0 0 0 3 3h2 M18 5h3a1 1 0 0 1 1 1v2a3 3 0 0 1-3 3h-2',
    database:
      'M12 8c4.97 0 9-1.79 9-4s-4.03-4-9-4-9 1.79-9 4 4.03 4 9 4z M3 4v4c0 2.21 4.03 4 9 4s9-1.79 9-4V4 M3 8v4c0 2.21 4.03 4 9 4s9-1.79 9-4V8 M3 12v4c0 2.21 4.03 4 9 4s9-1.79 9-4v-4',
    clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2',
    pencil: 'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z',
  };

  // Icon iconography for the MFA methods
  mfaMethods: {
    value: 'email_otp' | 'authenticator' | 'sms';
    label: string;
    desc: string;
    icon: string;
    badge: string;
  }[] = [
    {
      value: 'email_otp',
      label: 'Email OTP',
      desc: 'Receive a one-time code by email',
      icon: 'mail',
      badge: 'Recommended',
    },
    {
      value: 'authenticator',
      label: 'Authenticator App',
      desc: 'Google Authenticator, Authy or similar',
      icon: 'smartphone',
      badge: 'Most Secure',
    },
    {
      value: 'sms',
      label: 'SMS',
      desc: 'Receive a one-time code via SMS',
      icon: 'phone',
      badge: 'Fast',
    },
  ];

  isUseCaseSelected(value: string): boolean {
    return this.selectedUseCases().includes(value);
  }

  toggleUseCase(value: string) {
    this.selectedUseCases.update((list) =>
      list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
    );
  }

  // Form validation helpers
  showError(form: FormGroup, field: string): boolean {
    const control = form.get(field);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  errorMessage(form: FormGroup, field: string): string {
    const control: AbstractControl | null = form.get(field);
    if (!control || !control.errors) return '';
    const errors = control.errors;
    if (errors['required']) return 'This field is required.';
    if (errors['email']) return 'Enter a valid email address.';
    if (errors['pattern']) return 'Use 6 numeric digits.';
    if (errors['minlength']) {
      const min = errors['minlength'].requiredLength;
      return `Must be at least ${min} characters.`;
    }
    if (errors['maxlength']) {
      const max = errors['maxlength'].requiredLength;
      return `Must be at most ${max} characters.`;
    }
    return 'Please fix this field.';
  }

  touched(form: FormGroup, field: string): boolean {
    const control = form.get(field);
    return !!control && (control.touched || control.dirty);
  }

  ngOnInit() {
    this.store.loadDdls();

    // Step 3: Basic Information
    this.basicInfoForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      displayName: ['', [Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      mobile: ['', [Validators.required]],
      country: ['', [Validators.required]],
      timezone: ['UTC', [Validators.required]],
      language: ['en', [Validators.required]],
      gender: ['', [Validators.required]],
    });

    // Step 4: Email OTP
    this.emailOtpForm = this.fb.group({
      emailOtp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });

    // Step 5: Mobile OTP (Optional)
    this.mobileOtpForm = this.fb.group({
      mobileOtp: ['', [Validators.pattern(/^\d{6}$/)]],
    });

    // Step 6: Organization Information
    this.organizationForm = this.fb.group({
      organizationName: [
        '',
        [Validators.required, Validators.minLength(2), Validators.maxLength(100)],
      ],
      organizationCode: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9-]{2,16}$/)]],
      industry: ['', [Validators.required]],
      organizationSize: ['10-50', [Validators.required]],
      website: [''],
      gstNumber: [''],
      taxNumber: [''],
    });

    // Step 7: Branch Setup
    this.branchForm = this.fb.group({
      branchName: ['Head Office', [Validators.required, Validators.minLength(2)]],
      branchAddress: [''],
      branchCity: [''],
      branchState: [''],
      branchCountry: ['', [Validators.required]],
      branchPincode: [''],
    });

    // Step 8: Password Creation
    this.passwordForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(12)]],
      confirmPassword: ['', [Validators.required]],
    });

    // Step 9: MFA Setup
    this.mfaForm = this.fb.group({
      mfaMethod: ['email_otp', [Validators.required]],
      mfaCode: ['', [Validators.pattern(/^\d{6}$/)]],
    });

    // Step 10: Terms & Privacy
    this.termsForm = this.fb.group({
      termsAccepted: [false, [Validators.requiredTrue]],
      privacyAccepted: [false, [Validators.requiredTrue]],
      cookieAccepted: [false],
      securityAlertsEnabled: [true],
      marketingEmails: [false],
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
    this.basicInfoForm.markAllAsTouched();
    if (this.basicInfoForm.invalid) return;
    this.store.updatePersonalInfo({
      firstName: this.basicInfoForm.value.firstName,
      lastName: this.basicInfoForm.value.lastName,
      displayName: this.basicInfoForm.value.displayName,
      email: this.basicInfoForm.value.email,
      mobile: this.basicInfoForm.value.mobile,
      country: this.basicInfoForm.value.country,
      timezone: this.basicInfoForm.value.timezone,
      language: this.basicInfoForm.value.language,
      gender: this.basicInfoForm.value.gender,
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
        this.emailTimer.update((t) => t - 1);
      } else {
        clearInterval(this.emailInterval);
      }
    }, 1000);
  }

  formatTimer(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
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
    this.organizationForm.markAllAsTouched();
    if (!this.organizationForm || this.organizationForm.invalid) return;
    this.store.updateOrganizationInfo({
      organizationName: this.organizationForm.value.organizationName,
      organizationCode: this.organizationForm.value.organizationCode,
      industry: this.organizationForm.value.industry,
      organizationSize: this.organizationForm.value.organizationSize,
      website: this.organizationForm.value.website,
      gstNumber: this.organizationForm.value.gstNumber,
      taxNumber: this.organizationForm.value.taxNumber,
      useCases: this.selectedUseCases(),
    });
    this.store.nextStep();
  }

  // Step 7: Branch Setup
  saveBranchInfo() {
    this.branchForm.markAllAsTouched();
    if (!this.branchForm || this.branchForm.invalid) return;
    this.store.updateBranchInfo({
      branchName: this.branchForm.value.branchName,
      branchAddress: this.branchForm.value.branchAddress,
      branchCity: this.branchForm.value.branchCity,
      branchState: this.branchForm.value.branchState,
      branchCountry: this.branchForm.value.branchCountry,
      branchPincode: this.branchForm.value.branchPincode,
    });
    this.store.nextStep();
  }

  // Step 8: Password Creation
  savePassword() {
    this.passwordForm.markAllAsTouched();
    if (!this.passwordForm || this.passwordForm.invalid) return;
    this.store.updatePassword({
      password: this.passwordForm.value.password,
      confirmPassword: this.passwordForm.value.confirmPassword,
    });
    this.store.nextStep();
  }

  passwordMismatch(): boolean {
    const pw = this.passwordForm?.value?.password;
    const cp = this.passwordForm?.value?.confirmPassword;
    return !!pw && !!cp && pw !== cp;
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
    this.termsForm.markAllAsTouched();
    if (!this.termsForm || this.termsForm.invalid) return;
    this.store.updateTerms({
      termsAccepted: this.termsForm.value.termsAccepted,
      privacyAccepted: this.termsForm.value.privacyAccepted,
      cookieAccepted: this.termsForm.value.cookieAccepted,
      securityAlertsEnabled: this.termsForm.value.securityAlertsEnabled,
      marketingEmails: this.termsForm.value.marketingEmails,
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
      country: this.store.country(),
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
