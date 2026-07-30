import { Component, OnInit, inject, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
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
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    OtpInputComponent,
    DragDropUploadComponent,
    PasswordStrengthComponent
  ],
  providers: [RegisterStore],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent implements OnInit {
  readonly store = inject(RegisterStore);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  // Forms for different steps
  inviteForm!: FormGroup;
  companyForm!: FormGroup;
  branchForm!: FormGroup;
  adminForm!: FormGroup;
  credentialsForm!: FormGroup;
  
  // Timer for OTPs
  emailTimer = signal<number>(0);
  emailInterval: any;

  // Local state
  localMfaCode = signal<string>('');
  emailOtpCode = signal<string>('');

  steps = [
    { title: 'Welcome', desc: 'Setup Type' },
    { title: 'Invite', desc: 'Verification' },
    { title: 'Company', desc: 'Organization Info' },
    { title: 'Branch', desc: 'Corporate HQ' },
    { title: 'Admin', desc: 'Profile details' },
    { title: 'Security', desc: 'Credentials' },
    { title: 'Email', desc: 'OTP Verification' },
    { title: 'MFA', desc: 'Authenticator' },
    { title: 'Review', desc: 'Confirm Details' },
    { title: 'Complete', desc: 'Initializing' }
  ];

  visualSteps = [
    { title: 'WELCOME' },
    { title: 'INVITATION' },
    { title: 'COMPANY' },
    { title: 'BRANCH' },
    { title: 'ADMIN' },
    { title: 'SECURITY' },
    { title: 'VERIFY EMAIL' }
  ];

  activeVisualStep = computed(() => {
    const logicalStep = this.store.currentStep();
    if (logicalStep <= 6) return logicalStep - 1;
    return 6;
  });

  ngOnInit() {
    this.inviteForm = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(4)]]
    });

    this.companyForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      clientCode: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9-]{2,16}$/)]],
      industry: ['technology', [Validators.required]],
      employees: ['10-50', [Validators.required]],
    });

    this.branchForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      code: ['HQ-01', [Validators.required]]
    });

    this.adminForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      designation: ['Super Administrator']
    });

    this.credentialsForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(4)]],
      password: ['', [Validators.required, Validators.minLength(12)]]
    });
  }

  // Verification actions
  async verifyInvitationCode() {
    if (this.inviteForm.invalid) return;
    const ok = await this.store.verifyInvitation(this.inviteForm.value.code);
    if (ok) {
      this.store.nextStep();
    }
  }

  onLogoUploaded(logoBase64: string) {
    this.store.updateCompany({ companyLogoUrl: logoBase64 });
  }

  saveCompanyInfo() {
    if (this.companyForm.invalid) return;
    this.store.updateCompany({
      companyName: this.companyForm.value.name,
      companyClientCode: this.companyForm.value.clientCode,
      companyIndustry: this.companyForm.value.industry,
      companyEmployees: this.companyForm.value.employees
    });
    this.store.nextStep();
  }

  saveBranchInfo() {
    if (this.branchForm.invalid) return;
    this.store.updateBranch({
      branchName: this.branchForm.value.name,
      branchCode: this.branchForm.value.code
    });
    this.store.nextStep();
  }

  saveAdminInfo() {
    if (this.adminForm.invalid) return;
    this.store.updateAdmin({
      adminFullName: this.adminForm.value.fullName,
      adminDesignation: this.adminForm.value.designation
    });
    this.store.nextStep();
  }

  saveCredentialsInfo() {
    if (this.credentialsForm.invalid) return;
    this.store.updateCredentials({
      credentialsUsername: this.credentialsForm.value.username,
      credentialsPassword: this.credentialsForm.value.password
    });
    this.store.nextStep();
  }

  // OTP Countdown handling
  async triggerEmailOtp() {
    const ok = await this.store.sendEmailOtp(this.store.adminEmail());
    if (ok) {
      this.startEmailTimer();
    }
  }

  startEmailTimer() {
    this.emailTimer.set(60);
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
    const ok = await this.store.verifyEmailOtp(this.store.adminEmail(), this.emailOtpCode());
    if (ok) {
      clearInterval(this.emailInterval);

      // Load MFA setup for the next step before moving forward
      await this.store.loadMfaSetup(this.store.adminEmail());
      this.store.nextStep();
    }
  }

  onMfaCodeChange(code: string) {
    this.localMfaCode.set(code);
    this.store.updateVerification({ mfaCode: code });
  }

  submitMfaVerification() {
    if (this.localMfaCode().length === 6) {
      this.store.nextStep();
    }
  }

  async finishRegistration() {
    await this.store.submitAll();
  }

  navigateToLogin() {
    this.router.navigate(['/auth/login']);
  }
}
