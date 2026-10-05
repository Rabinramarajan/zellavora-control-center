import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { firstValueFrom, map, Observable } from 'rxjs';

import { apiErrorMessage } from '../../core/auth/auth-errors';
import { AuthService } from '../../core/auth/auth.service';
import { AppearanceSettingsComponent } from './components/appearance-settings/appearance-settings.component';
import { AvatarUploaderComponent } from './components/avatar-uploader/avatar-uploader.component';
import { EmailSettingsFormComponent } from './components/email-settings-form/email-settings-form.component';
import { GeneralSettingsFormComponent } from './components/general-settings-form/general-settings-form.component';
import { ProfileSettingsFormComponent } from './components/profile-settings-form/profile-settings-form.component';
import { RegistrationSettingsFormComponent } from './components/registration-settings-form/registration-settings-form.component';
import { SettingsAsideComponent } from './components/settings-aside/settings-aside.component';
import { SettingsCardComponent } from './components/settings-card/settings-card.component';
import { SettingsIconComponent } from './components/settings-icon/settings-icon.component';
import { SettingsNavComponent } from './components/settings-nav/settings-nav.component';
import { EmailSettingsService } from './email-settings.service';
import {
  DEFAULT_EMAIL_SETTINGS,
  EmailSettings,
  EmailSettingsPayload,
  EmailTestResult,
} from './models/email-settings.model';
import {
  DEFAULT_REGISTRATION_SETTINGS,
  RegistrationSettings,
  RegistrationSettingsPayload,
} from './models/registration-settings.model';
import {
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_PROFILE_SETTINGS,
  GeneralSettings,
  ProfileSettings,
  SETTINGS_TABS,
  SettingsTabId,
  SystemInfoItem,
} from './models/settings.model';
import { RegistrationSettingsService } from './registration-settings.service';
import { ApiIntegrationService } from '../../core/services/integration/api-integration.service';

type SettingsSection = 'general' | 'profile';

/** Shape of GET /settings: every section is optional. */
interface AllSettings {
  general?: Partial<GeneralSettings>;
  profile?: Partial<ProfileSettings>;
}

interface SaveOptions<T> {
  request: Observable<T>;
  setBusy: (busy: boolean) => void;
  success: string;
  failure: string;
  onSuccess?: (result: T) => void;
}

const isTabId = (value: string | null): value is SettingsTabId =>
  SETTINGS_TABS.some((tab) => tab.id === value);

const toTabId = (value: string | null): SettingsTabId => (isTabId(value) ? value : 'general');

@Component({
  selector: 'app-settings',
  imports: [
    ToastModule,
    SettingsIconComponent,
    SettingsNavComponent,
    SettingsCardComponent,
    GeneralSettingsFormComponent,
    ProfileSettingsFormComponent,
    SettingsAsideComponent,
    AvatarUploaderComponent,
    AppearanceSettingsComponent,
    EmailSettingsFormComponent,
    RegistrationSettingsFormComponent,
  ],
  providers: [MessageService],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  private readonly messageService = inject(MessageService);
  private readonly apiService = inject(ApiIntegrationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly emailSettingsService = inject(EmailSettingsService);
  private readonly registrationSettingsService = inject(RegistrationSettingsService);

  protected readonly tabs = SETTINGS_TABS;

  // ActivatedRoute.paramMap emits synchronously, so no initialValue is needed.
  protected readonly activeTabId = toSignal(
    this.route.paramMap.pipe(map((params) => toTabId(params.get('tab')))),
    { requireSync: true },
  );
  protected readonly activeTab = computed(
    () => this.tabs.find((tab) => tab.id === this.activeTabId()) ?? this.tabs[0],
  );

  protected readonly generalSettings = signal<GeneralSettings>(DEFAULT_GENERAL_SETTINGS);
  protected readonly profileSettings = signal<ProfileSettings>(DEFAULT_PROFILE_SETTINGS);
  protected readonly savingSection = signal<SettingsSection | null>(null);

  protected readonly emailSettings = signal<EmailSettings>(DEFAULT_EMAIL_SETTINGS);
  protected readonly emailSaving = signal(false);
  protected readonly emailTesting = signal(false);
  protected readonly emailTestResult = signal<EmailTestResult | null>(null);

  protected readonly registrationSettings = signal<RegistrationSettings>(
    DEFAULT_REGISTRATION_SETTINGS,
  );
  protected readonly registrationSaving = signal(false);

  protected readonly avatarUrl = computed(() => this.auth.user()?.avatarUrl ?? null);
  protected readonly avatarSaving = signal(false);
  protected readonly userRole = computed(() => this.auth.user()?.role ?? '');
  protected readonly mfaEnabled = computed(() => !!this.auth.user()?.mfaEnabled);

  protected readonly systemInfo: readonly SystemInfoItem[] = [
    { label: 'Version', value: 'v2.3.1' },
    { label: 'Environment', value: 'Production' },
    { label: 'Last updated', value: 'May 24, 2025' },
    { label: 'Uptime', value: '15d 7h 23m' },
  ];

  constructor() {
    void this.loadAllSettings();
    void this.loadEmailSettings();
    void this.loadRegistrationSettings();
  }

  // ---------- template handlers ----------

  protected selectTab(tabId: SettingsTabId): void {
    void this.router.navigate(['/settings', tabId]);
  }

  protected openSecurity(): void {
    void this.router.navigate(['/account/security']);
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
    await this.save({
      request: this.auth.updateAvatar(avatar),
      setBusy: (busy) => this.avatarSaving.set(busy),
      success: avatar ? 'Profile picture updated' : 'Profile picture removed',
      failure: 'Failed to update profile picture',
    });
  }

  protected async saveEmailSettings(payload: EmailSettingsPayload): Promise<void> {
    await this.save({
      request: this.emailSettingsService.update(payload),
      setBusy: (busy) => this.emailSaving.set(busy),
      success: 'Email settings updated',
      failure: 'Failed to save email settings',
      onSuccess: (settings) => {
        this.emailSettings.set(settings);
        // A previous result refers to the old configuration, so drop it rather
        // than leave a stale "succeeded" badge next to new credentials.
        this.emailTestResult.set(null);
      },
    });
  }

  protected async saveRegistrationSettings(payload: RegistrationSettingsPayload): Promise<void> {
    await this.save({
      request: this.registrationSettingsService.update(payload),
      setBusy: (busy) => this.registrationSaving.set(busy),
      success: 'Registration settings updated',
      failure: 'Failed to save registration settings',
      onSuccess: (settings) => this.registrationSettings.set(settings),
    });
  }

  protected async sendTestEmail(to: string): Promise<void> {
    this.emailTesting.set(true);
    this.emailTestResult.set(null);
    try {
      const result = await firstValueFrom(this.emailSettingsService.sendTest(to));
      this.emailTestResult.set(result);
      if (result.success) {
        this.toast('success', 'Sent', `Test email sent to ${to}`);
      } else {
        this.toast('error', 'Delivery failed', result.error ?? 'The provider rejected the message');
      }
      // Refresh so the stored last-test status matches what was just shown.
      await this.loadEmailSettings();
    } catch (err) {
      this.toast('error', 'Error', apiErrorMessage(err, 'Failed to send test email'));
    } finally {
      this.emailTesting.set(false);
    }
  }

  // ---------- loading ----------

  private async loadAllSettings(): Promise<void> {
    try {
      const { data } = await firstValueFrom(this.apiService.getSettings<AllSettings | undefined>());
      if (data?.general) this.generalSettings.update((s) => ({ ...s, ...data.general }));
      if (data?.profile) this.profileSettings.update((s) => ({ ...s, ...data.profile }));
    } catch (err) {
      this.toast('error', 'Error', apiErrorMessage(err, 'Failed to load settings'));
    }
  }

  private loadEmailSettings(): Promise<void> {
    return this.loadQuietly(this.emailSettingsService.get(), (s) => this.emailSettings.set(s));
  }

  private loadRegistrationSettings(): Promise<void> {
    return this.loadQuietly(this.registrationSettingsService.get(), (s) =>
      this.registrationSettings.set(s),
    );
  }

  /**
   * Non-fatal load: a tab may be out of reach for this user's role
   * (e.g. no settings:manage), and the rest of the page must still render.
   */
  private async loadQuietly<T>(source: Observable<T>, apply: (value: T) => void): Promise<void> {
    try {
      apply(await firstValueFrom(source));
    } catch {
      // intentionally ignored
    }
  }

  // ---------- saving ----------

  private saveSection(
    section: SettingsSection,
    payload: GeneralSettings | ProfileSettings,
    label: string,
  ): Promise<boolean> {
    return this.save({
      request: this.apiService.updateSettings(section, payload),
      setBusy: (busy) => this.savingSection.set(busy ? section : null),
      success: `${label} saved successfully`,
      failure: `Failed to save ${label.toLowerCase()}`,
    });
  }

  /** Runs a save request, toggles its busy flag, toasts the outcome, resolves true on success. */
  private async save<T>({
    request,
    setBusy,
    success,
    failure,
    onSuccess,
  }: SaveOptions<T>): Promise<boolean> {
    setBusy(true);
    try {
      // Await first: `onSuccess?.(await …)` skips the request when no callback is given.
      const result = await firstValueFrom(request);
      onSuccess?.(result);
      this.toast('success', 'Saved', success);
      return true;
    } catch (err) {
      this.toast('error', 'Error', apiErrorMessage(err, failure));
      return false;
    } finally {
      setBusy(false);
    }
  }

  private toast(severity: 'success' | 'error', summary: string, detail: string): void {
    this.messageService.add({ severity, summary, detail, life: 3000 });
  }
}