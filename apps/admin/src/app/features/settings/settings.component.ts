import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, map } from 'rxjs';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ApiIntegrationService } from '@core/services/api-integration.service';
import { AuthService } from '@core/auth/auth.service';
import {
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_PROFILE_SETTINGS,
  GeneralSettings,
  MfaStep,
  ProfileSettings,
  SETTINGS_TABS,
  SettingsTabId,
  StatusMessage,
  SystemInfoItem,
} from './models/settings.model';
import { SettingsIconComponent } from './components/settings-icon/settings-icon.component';
import { SettingsNavComponent } from './components/settings-nav/settings-nav.component';
import { SettingsCardComponent } from './components/settings-card/settings-card.component';
import { GeneralSettingsFormComponent } from './components/general-settings-form/general-settings-form.component';
import { ProfileSettingsFormComponent } from './components/profile-settings-form/profile-settings-form.component';
import { PasswordFormComponent } from './components/password-form/password-form.component';
import { MfaPanelComponent } from './components/mfa-panel/mfa-panel.component';
import { SettingsAsideComponent } from './components/settings-aside/settings-aside.component';
import { AvatarUploaderComponent } from './components/avatar-uploader/avatar-uploader.component';

type SavingSection = 'general' | 'profile' | null;

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    ToastModule,
    SettingsIconComponent,
    SettingsNavComponent,
    SettingsCardComponent,
    GeneralSettingsFormComponent,
    ProfileSettingsFormComponent,
    PasswordFormComponent,
    MfaPanelComponent,
    SettingsAsideComponent,
    AvatarUploaderComponent,
  ],
  providers: [MessageService],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  private readonly messageService = inject(MessageService);
  private readonly apiService = inject(ApiIntegrationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly tabs = SETTINGS_TABS;

  protected readonly activeTabId = toSignal(
    this.route.paramMap.pipe(map(params => this.toTabId(params.get('tab')))),
    { initialValue: this.toTabId(this.route.snapshot.paramMap.get('tab')) }
  );
  protected readonly activeTab = computed(
    () => this.tabs.find(tab => tab.id === this.activeTabId()) ?? this.tabs[0]
  );

  protected readonly generalSettings = signal<GeneralSettings>(DEFAULT_GENERAL_SETTINGS);
  protected readonly profileSettings = signal<ProfileSettings>(DEFAULT_PROFILE_SETTINGS);
  protected readonly savingSection = signal<SavingSection>(null);

  protected readonly avatarUrl = computed(() => this.auth.user()?.avatarUrl ?? null);
  protected readonly avatarSaving = signal(false);
  protected readonly userRole = computed(() => this.auth.user()?.role ?? '');

  protected readonly passwordSaving = signal(false);
  protected readonly passwordMessage = signal<StatusMessage | null>(null);

  protected readonly mfaEnabled = computed(() => !!this.auth.user()?.mfaEnabled);
  protected readonly mfaStep = signal<MfaStep>('idle');
  protected readonly mfaBusy = signal(false);
  protected readonly mfaError = signal<string | null>(null);
  protected readonly mfaQrCode = signal('');
  protected readonly recoveryCodes = signal<readonly string[]>([]);
  private mfaSecret = '';

  protected readonly systemInfo: readonly SystemInfoItem[] = [
    { label: 'Version', value: 'v2.3.1' },
    { label: 'Environment', value: 'Production' },
    { label: 'Last updated', value: 'May 24, 2025' },
    { label: 'Uptime', value: '15d 7h 23m' },
  ];

  constructor() {
    void this.loadAllSettings();
  }

  protected selectTab(tabId: SettingsTabId): void {
    void this.router.navigate(['/settings', tabId]);
  }

  protected async saveGeneral(settings: GeneralSettings): Promise<void> {
    if (await this.saveSection('general', settings, 'General settings')) {
      this.generalSettings.set(settings);
    }
  }

  protected async saveProfile(settings: ProfileSettings): Promise<void> {
    if (await this.saveSection('profile', settings, 'Profile')) {
      this.profileSettings.set(settings);
    }
  }

  protected async updateAvatar(avatar: string | null): Promise<void> {
    this.avatarSaving.set(true);
    try {
      await firstValueFrom(this.auth.updateAvatar(avatar));
      this.toast('success', 'Saved', avatar ? 'Profile picture updated' : 'Profile picture removed');
    } catch (err) {
      this.toast('error', 'Error', this.errorMessage(err, 'Failed to update profile picture'));
    } finally {
      this.avatarSaving.set(false);
    }
  }

  protected async changePassword(req: { currentPassword: string; newPassword: string }): Promise<void> {
    this.passwordSaving.set(true);
    try {
      await firstValueFrom(this.auth.changePassword(req));
      this.passwordMessage.set({ severity: 'success', text: 'Password updated successfully.' });
    } catch (err) {
      this.passwordMessage.set({
        severity: 'error',
        text: this.errorMessage(err, 'Failed to update password.'),
      });
    } finally {
      this.passwordSaving.set(false);
    }
  }

  protected startMfaEnrollment(): Promise<void> {
    return this.runMfa('Failed to start enrollment.', async () => {
      const res = await firstValueFrom(this.auth.startMfaEnrollment());
      this.mfaSecret = res.secret;
      this.mfaQrCode.set(res.qrCodeDataUrl);
      this.mfaStep.set('qr');
    });
  }

  protected confirmMfa(code: string): Promise<void> {
    return this.runMfa('Invalid code. Please try again.', async () => {
      const res = await firstValueFrom(
        this.auth.confirmMfaEnrollment({ secret: this.mfaSecret, code })
      );
      this.mfaSecret = '';
      this.recoveryCodes.set(res.recoveryCodes ?? []);
      this.mfaStep.set('codes');
    });
  }

  protected regenerateCodes(): Promise<void> {
    return this.runMfa('Failed to regenerate codes.', async () => {
      const res = await firstValueFrom(this.auth.regenerateRecoveryCodes());
      this.recoveryCodes.set(res.recoveryCodes ?? []);
      this.mfaStep.set('codes');
    });
  }

  protected disableMfa(password: string): Promise<void> {
    return this.runMfa('Failed to disable MFA.', async () => {
      await firstValueFrom(this.auth.disableMfa({ password }));
      this.mfaStep.set('idle');
    });
  }

  protected closeCodes(): void {
    this.mfaStep.set('idle');
    this.recoveryCodes.set([]);
  }

  private async loadAllSettings(): Promise<void> {
    try {
      const response = await firstValueFrom(this.apiService.getSettings());
      const data = response?.data;
      if (data?.general) this.generalSettings.update(s => ({ ...s, ...data.general }));
      if (data?.profile) this.profileSettings.update(s => ({ ...s, ...data.profile }));
    } catch {
      this.toast('error', 'Error', 'Failed to load settings');
    }
  }

  private async saveSection(
    section: Exclude<SavingSection, null>,
    payload: GeneralSettings | ProfileSettings,
    label: string
  ): Promise<boolean> {
    this.savingSection.set(section);
    try {
      await firstValueFrom(this.apiService.updateSettings(section, payload));
      this.toast('success', 'Saved', `${label} saved successfully`);
      return true;
    } catch {
      this.toast('error', 'Error', `Failed to save ${label.toLowerCase()}`);
      return false;
    } finally {
      this.savingSection.set(null);
    }
  }

  private async runMfa(fallbackError: string, action: () => Promise<void>): Promise<void> {
    this.mfaBusy.set(true);
    this.mfaError.set(null);
    try {
      await action();
    } catch (err) {
      this.mfaError.set(this.errorMessage(err, fallbackError));
    } finally {
      this.mfaBusy.set(false);
    }
  }

  private errorMessage(err: unknown, fallback: string): string {
    return err instanceof HttpErrorResponse ? (err.error?.error?.message ?? fallback) : fallback;
  }

  private toast(severity: 'success' | 'error', summary: string, detail: string): void {
    this.messageService.add({ severity, summary, detail, life: 3000 });
  }

  private toTabId(value: string | null): SettingsTabId {
    return SETTINGS_TABS.some(tab => tab.id === value) ? (value as SettingsTabId) : 'general';
  }
}
