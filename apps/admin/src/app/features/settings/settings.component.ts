import { Component, inject, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageService } from 'primeng/api';
import { ApiIntegrationService } from '@core/services/api-integration.service';
import { AuthService } from '@core/auth/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    ToastModule,
    CheckboxModule,
  ],
  providers: [MessageService],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {
  private messageService = inject(MessageService);
  private apiService = inject(ApiIntegrationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);

  activeTab = signal('general');

  /** Active tab driven by the route param (e.g. /settings/security). */
  private readonly tabParam = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });

  constructor() {
    effect(() => {
      const tab = this.tabParam()?.get('tab');
      untracked(() => {
        if (tab) this.activeTab.set(tab);
      });
    });
    void this.loadAllSettings();
  }

  settingsTabs = [
    { id: 'general', label: 'General', desc: 'Basic application settings', icon: '⚙️' },
    { id: 'profile', label: 'Profile', desc: 'Personal information', icon: '👤' },
    { id: 'security', label: 'Security', desc: 'Password & authentication', icon: '🔒' },
    { id: 'notifications', label: 'Notifications', desc: 'Email & system alerts', icon: '🔔' },
    { id: 'appearance', label: 'Appearance', desc: 'Theme & display settings', icon: '🎨' },
    { id: 'localization', label: 'Localization', desc: 'Language & timezone', icon: '🌐' },
    { id: 'integrations', label: 'Integrations', desc: 'Third-party services', icon: '🔌' },
    { id: 'storage', label: 'Storage', desc: 'Media & file settings', icon: '📁' },
    { id: 'backup', label: 'Backup & Restore', desc: 'Data backup preferences', icon: '💾' },
    { id: 'advanced', label: 'Advanced', desc: 'Developer & system settings', icon: '🛠️' },
  ];

  generalSettings = {
    siteTitle: 'Zellavora Control Center',
    siteDescription: 'Centralized platform to manage portfolio, projects, content, and analytics.',
    timezone: 'GMT+5:30',
    dateFormat: 'MMM DD, YYYY',
    itemsPerPage: 10,
    maintenanceMode: false,
  };

  profileSettings = {
    fullName: 'Rabin R',
    email: 'rabin@zellavora.com',
    bio: 'Frontend Angular Consultant with 4+ years of experience building scalable, accessible and high-performance web applications.',
    location: 'Chennai, Tamil Nadu, India',
    phone: '+91 8765432109',
  };

  preferenceSettings = {
    theme: 'dark',
    emailNotifications: true,
    pushNotifications: true,
    weeklyDigest: true,
    language: 'en',
  };

  timezoneOptions = [
    { label: '(GMT+05:30) Asia/Kolkata', value: 'GMT+5:30' },
    { label: '(GMT+00:00) UTC', value: 'GMT+0' },
    { label: '(GMT-05:00) EST', value: 'GMT-5' },
    { label: '(GMT+01:00) CET', value: 'GMT+1' },
  ];

  dateFormatOptions = [
    { label: 'May 24, 2025 (MMM DD, YYYY)', value: 'MMM DD, YYYY' },
    { label: '24/05/2025 (DD/MM/YYYY)', value: 'DD/MM/YYYY' },
    { label: '2025-05-24 (YYYY-MM-DD)', value: 'YYYY-MM-DD' },
  ];

  itemsPerPageOptions = [
    { label: '10', value: 10 },
    { label: '25', value: 25 },
    { label: '50', value: 50 },
  ];

  languageOptions = [
    { label: 'English', value: 'en' },
    { label: 'Hindi', value: 'hi' },
    { label: 'Tamil', value: 'ta' },
    { label: 'Spanish', value: 'es' },
  ];

  selectTab(tabId: string) {
    this.activeTab.set(tabId);
    this.router.navigate(['/settings', tabId]);
  }

  async loadAllSettings() {
    try {
      const response = await firstValueFrom(this.apiService.getSettings());
      if (response && response.data) {
        const data = response.data;
        if (data.general) {
          this.generalSettings = { ...this.generalSettings, ...data.general };
        }
        if (data.profile) {
          this.profileSettings = { ...this.profileSettings, ...data.profile };
        }
        if (data.preferences) {
          this.preferenceSettings = { ...this.preferenceSettings, ...data.preferences };
        }
      }
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load settings',
        life: 3000
      });
    }
  }

  async saveGeneralSettings() {
    try {
      await firstValueFrom(this.apiService.updateSettings('general', this.generalSettings));
      this.messageService.add({
        severity: 'success',
        summary: 'Saved',
        detail: 'General settings saved successfully',
        life: 3000,
      });
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to save general settings',
        life: 3000,
      });
    }
  }

  async saveProfileSettings() {
    try {
      await firstValueFrom(this.apiService.updateSettings('profile', this.profileSettings));
      this.messageService.add({
        severity: 'success',
        summary: 'Saved',
        detail: 'Profile settings saved successfully',
        life: 3000,
      });
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to save profile settings',
        life: 3000,
      });
    }
  }

  async savePreferences() {
    try {
      await firstValueFrom(this.apiService.updateSettings('preferences', this.preferenceSettings));
      this.messageService.add({
        severity: 'success',
        summary: 'Saved',
        detail: 'Preferences saved successfully',
        life: 3000,
      });
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to save preferences',
        life: 3000,
      });
    }
  }

  // -------------------------------------------------------------------------
  // SECURITY TAB — change password + MFA management
  // -------------------------------------------------------------------------

  passwordModel = { currentPassword: '', newPassword: '', confirmPassword: '' };
  passwordSaving = false;
  passwordMessage: { severity: 'success' | 'error'; text: string } | null = null;

  mfaStep = signal<'idle' | 'qr' | 'codes'>('idle');
  mfaEnabled = computed(() => !!this.auth.user()?.mfaEnabled);
  mfaSecret = '';
  mfaQrCode = '';
  mfaCodeInput = '';
  mfaBusy = false;
  mfaError: string | null = null;
  recoveryCodes: string[] = [];
  disablePassword = '';

  async changePassword() {
    const { currentPassword, newPassword, confirmPassword } = this.passwordModel;
    if (!currentPassword) {
      this.passwordMessage = { severity: 'error', text: 'Enter your current password.' };
      return;
    }
    if (newPassword.length < 12) {
      this.passwordMessage = { severity: 'error', text: 'New password must be at least 12 characters.' };
      return;
    }
    if (newPassword !== confirmPassword) {
      this.passwordMessage = { severity: 'error', text: 'New passwords do not match.' };
      return;
    }
    this.passwordSaving = true;
    this.passwordMessage = null;
    try {
      await firstValueFrom(this.auth.changePassword({ currentPassword, newPassword }));
      this.passwordSaving = false;
      this.passwordModel = { currentPassword: '', newPassword: '', confirmPassword: '' };
      this.passwordMessage = { severity: 'success', text: 'Password updated successfully.' };
    } catch (err: any) {
      this.passwordSaving = false;
      this.passwordMessage = {
        severity: 'error',
        text: err?.error?.error?.message || 'Failed to update password.',
      };
    }
  }

  async startMfaEnrollment() {
    this.mfaBusy = true;
    this.mfaError = null;
    try {
      const res = await firstValueFrom(this.auth.startMfaEnrollment());
      this.mfaSecret = res.secret;
      this.mfaQrCode = res.qrCodeDataUrl;
      this.mfaCodeInput = '';
      this.mfaStep.set('qr');
      this.mfaBusy = false;
    } catch (err: any) {
      this.mfaBusy = false;
      this.mfaError = err?.error?.error?.message || 'Failed to start enrollment.';
    }
  }

  async confirmMfa() {
    if (this.mfaCodeInput.length !== 6) return;
    this.mfaBusy = true;
    this.mfaError = null;
    try {
      const res = await firstValueFrom(this.auth.confirmMfaEnrollment({ secret: this.mfaSecret, code: this.mfaCodeInput }));
      this.recoveryCodes = res.recoveryCodes ?? [];
      this.mfaSecret = '';
      this.mfaCodeInput = '';
      this.mfaStep.set('codes');
      this.mfaBusy = false;
    } catch (err: any) {
      this.mfaBusy = false;
      this.mfaError = err?.error?.error?.message || 'Invalid code. Please try again.';
    }
  }

  async regenerateCodes() {
    this.mfaBusy = true;
    this.mfaError = null;
    try {
      const res = await firstValueFrom(this.auth.regenerateRecoveryCodes());
      this.recoveryCodes = res.recoveryCodes ?? [];
      this.mfaStep.set('codes');
      this.mfaBusy = false;
    } catch (err: any) {
      this.mfaBusy = false;
      this.mfaError = err?.error?.error?.message || 'Failed to regenerate codes.';
    }
  }

  async disableMfa() {
    if (!this.disablePassword) return;
    this.mfaBusy = true;
    this.mfaError = null;
    try {
      await firstValueFrom(this.auth.disableMfa({ password: this.disablePassword }));
      this.disablePassword = '';
      this.mfaStep.set('idle');
      this.mfaBusy = false;
    } catch (err: any) {
      this.mfaBusy = false;
      this.mfaError = err?.error?.error?.message || 'Failed to disable MFA.';
    }
  }

  closeCodes() {
    this.mfaStep.set('idle');
    this.recoveryCodes = [];
  }
}
