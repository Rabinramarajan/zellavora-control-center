import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MessageService } from 'primeng/api';
import { RegisterStore } from '../register.store';
import { OtpInputComponent } from '../../../../../shared/components/otp-input.component';

interface MfaMethod {
  value: 'email_otp' | 'authenticator' | 'sms';
  label: string;
  desc: string;
  icon: string;
  badge: string;
}

@Component({
  selector: 'app-step-9-mfa',
  standalone: true,
  imports: [CommonModule, OtpInputComponent],
  templateUrl: './step-9-mfa.component.html',
  styleUrls: ['../step-styles.css'],
})
export class Step9MfaComponent {
  readonly store = inject(RegisterStore);
  private readonly messageService = inject(MessageService);
  readonly mfaCodeInput = signal('');

  readonly mfaMethods: MfaMethod[] = [
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

  readonly icons: Record<string, string> = {
    mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M22 6l-10 7L2 6',
    smartphone:
      'M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z M12 18h.01',
    phone:
      'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z',
  };

  canContinue(): boolean {
    if (!this.store.mfaEnabled()) return true;
    switch (this.store.mfaMethod()) {
      case 'authenticator':
        return this.store.mfaVerified();
      case 'sms':
        return this.store.mobileVerified();
      default:
        return this.store.emailVerified();
    }
  }

  async selectMfaMethod(method: 'email_otp' | 'authenticator' | 'sms') {
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

  async verifyAuthenticator() {
    const code = this.mfaCodeInput();
    if (code.length !== 6) return;
    const ok = await this.store.verifyMfaCode(code);
    if (ok) {
      this.messageService.add({
        severity: 'success',
        summary: 'Security enabled',
        detail: 'Two-factor authentication is now active.',
        life: 3000,
      });
      this.store.nextStep();
      this.store.syncProgressToBackend();
    }
  }
}
