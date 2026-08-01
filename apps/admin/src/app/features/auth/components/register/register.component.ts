import { Component, inject, OnInit, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { RegisterStore } from './register.store';

import { Step1WelcomeComponent } from './steps/step-1-welcome.component';
import { Step2RegistrationTypeComponent } from './steps/step-2-registration-type.component';
import { Step3BasicInfoComponent } from './steps/step-3-basic-info.component';
import { Step4EmailOtpComponent } from './steps/step-4-email-otp.component';
import { Step5MobileOtpComponent } from './steps/step-5-mobile-otp.component';
import { Step6OrganizationComponent } from './steps/step-6-organization.component';
import { Step7BranchComponent } from './steps/step-7-branch.component';
import { Step8PasswordComponent } from './steps/step-8-password.component';
import { Step9MfaComponent } from './steps/step-9-mfa.component';
import { Step10TermsComponent } from './steps/step-10-terms.component';
import { Step11ReviewComponent } from './steps/step-11-review.component';
import { Step12ProcessingComponent } from './steps/step-12-processing.component';
import { Step13SuccessComponent } from './steps/step-13-success.component';

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
    ToastModule,
    Step1WelcomeComponent,
    Step2RegistrationTypeComponent,
    Step3BasicInfoComponent,
    Step4EmailOtpComponent,
    Step5MobileOtpComponent,
    Step6OrganizationComponent,
    Step7BranchComponent,
    Step8PasswordComponent,
    Step9MfaComponent,
    Step10TermsComponent,
    Step11ReviewComponent,
    Step12ProcessingComponent,
    Step13SuccessComponent,
  ],
  providers: [RegisterStore, MessageService],
  templateUrl: './register.component.html',
  styleUrls: ['../../auth-shell.css', './register.component.css'],
})
export class RegisterComponent implements OnInit {
  readonly store = inject(RegisterStore);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  // 13-Step Flow per Specification
  readonly steps: StepDef[] = [
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
  readonly railSteps = [
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
  readonly trustAvatars = ['AK', 'MR', 'SN', 'PD', 'JL'];

  // Inline SVG icon paths (stroke-based, 24x24 viewBox)
  readonly icons: Record<string, string> = {
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
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4',
    'file-text':
      'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
    'list-checks': 'M3 6h.01 M3 12h.01 M3 18h.01 M8 6h13 M8 12h13 M8 18h13',
    'party-popper':
      'M5.8 11.3 2 22l10.7-3.79 M4 3h.01 M22 8h.01 M15 2h.01 M22 20h.01 M22 2l-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.76-.01 1.53-.32 2.24L17 9 M9 5l-3.6-1.2a.5.5 0 0 0-.36.94L8 6.8 M12 10l2 4 M5 13l-1 3 M14 5l1.5 3 M8.5 4.5 10 6',
    loader:
      'M12 2v4 M12 18v4 M4.93 4.93l2.83 2.83 M16.24 16.24l2.83 2.83 M2 12h4 M18 12h4 M4.93 19.07l2.83-2.83 M16.24 7.76l2.83-2.83',
  };

  readonly progressPercent = computed(() => (this.store.currentStep() / 13) * 100);

  constructor() {
    // Surface store errors as error toasts.
    effect(() => {
      const error = this.store.error();
      if (error) {
        this.messageService.add({
          severity: 'error',
          summary: 'Something went wrong',
          detail: error,
          life: 5000,
        });
      }
    });

    // Initialize the backend registration session once an email is known
    // (basic info lives on step 3, but the initial ngOnInit call has no email).
    effect(() => {
      const email = this.store.email();
      const hasSession = this.store.sessionId();
      if (email && !hasSession) {
        untracked(() => this.store.initializeSession());
      }
    });
  }

  ngOnInit() {
    this.store.restoreDraft();
    this.store.initializeSession();
    this.store.loadDdls();
  }

  navigateToLogin() {
    this.router.navigate(['/auth/login']);
  }
}
