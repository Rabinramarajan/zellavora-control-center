import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { FormInputControl, SelectControl, type SelectControlOption } from '@zellavoras/ui';
import {
  EMAIL_PROVIDERS,
  EmailProvider,
  EmailSettings,
  EmailSettingsPayload,
  EmailTestResult,
  PROVIDER_LABELS,
  SECRET_PLACEHOLDER,
} from '../../models/email-settings.model';
import { SettingsCardComponent } from '../settings-card/settings-card.component';
import { SettingRowComponent } from '../setting-row/setting-row.component';
import { ToggleSwitchComponent } from '../toggle-switch/toggle-switch.component';

/** Editable shape — secrets are tracked separately from the saved view. */
interface EmailDraft {
  provider: EmailProvider;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  fromEmail: string;
  fromName: string;
}

@Component({
  selector: 'app-email-settings-form',
  standalone: true,
  imports: [
    FormInputControl,
    SelectControl,
    SettingsCardComponent,
    SettingRowComponent,
    ToggleSwitchComponent,
  ],
  templateUrl: './email-settings-form.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailSettingsFormComponent {
  readonly settings = input.required<EmailSettings>();
  readonly saving = input(false);
  readonly testing = input(false);
  readonly testResult = input<EmailTestResult | null>(null);

  readonly save = output<EmailSettingsPayload>();
  readonly sendTest = output<string>();

  protected readonly providerOptions: SelectControlOption[] = EMAIL_PROVIDERS.map((value) => ({
    value,
    label: PROVIDER_LABELS[value],
  }));

  protected readonly draft = linkedSignal<EmailDraft>(() => {
    const s = this.settings();
    return {
      provider: s.provider,
      smtpHost: s.smtpHost ?? '',
      smtpPort: s.smtpPort ?? 587,
      smtpSecure: s.smtpSecure,
      smtpUser: s.smtpUser ?? '',
      fromEmail: s.fromEmail ?? '',
      fromName: s.fromName ?? '',
    };
  });

  /**
   * Secrets live outside the draft because the server never sends them back.
   * An untouched field stays null and is omitted from the payload, which the
   * API reads as "keep the stored value" — typing into it is the only way to
   * replace a secret, and clearing it explicitly sends an empty string.
   */
  protected readonly smtpPassword = linkedSignal<string | null>(() => {
    void this.settings();
    return null;
  });

  protected readonly testRecipient = signal('');

  protected readonly hasStoredSmtpPassword = computed(
    () => this.settings().smtpPassword === SECRET_PLACEHOLDER
  );

  /** FormInputControl binds strings; the draft keeps the parsed number. */
  protected readonly portText = computed(() => String(this.draft().smtpPort ?? ''));

  protected readonly isSmtp = computed(() => this.draft().provider === 'smtp');

  protected readonly dirty = computed(() => {
    const s = this.settings();
    const d = this.draft();
    const changedSecret = this.smtpPassword() !== null;
    return (
      changedSecret ||
      d.provider !== s.provider ||
      d.smtpHost !== (s.smtpHost ?? '') ||
      d.smtpPort !== (s.smtpPort ?? 587) ||
      d.smtpSecure !== s.smtpSecure ||
      d.smtpUser !== (s.smtpUser ?? '') ||
      d.fromEmail !== (s.fromEmail ?? '') ||
      d.fromName !== (s.fromName ?? '')
    );
  });

  /** Mirrors the backend's superRefine so the button disables before a 400. */
  protected readonly validationError = computed<string | null>(() => {
    const d = this.draft();
    if (d.provider === 'console') return null;
    if (!d.fromEmail.trim()) return 'A from address is required for this provider.';
    if (d.provider === 'smtp') {
      if (!d.smtpHost.trim()) return 'SMTP host is required.';
      if (!d.smtpPort || d.smtpPort < 1 || d.smtpPort > 65535) {
        return 'SMTP port must be between 1 and 65535.';
      }
    }
    return null;
  });

  protected readonly canSave = computed(
    () => this.dirty() && !this.validationError() && !this.saving()
  );

  protected readonly canTest = computed(
    () => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.testRecipient().trim()) && !this.testing()
  );

  protected readonly lastTestLabel = computed(() => {
    const s = this.settings();
    if (!s.lastTestedAt) return null;
    const when = new Date(s.lastTestedAt).toLocaleString();
    return s.lastTestStatus === 'SUCCESS'
      ? `Last test succeeded on ${when}`
      : `Last test failed on ${when}${s.lastTestError ? `: ${s.lastTestError}` : ''}`;
  });

  protected patch(changes: Partial<EmailDraft>): void {
    this.draft.update((current) => ({ ...current, ...changes }));
  }

  protected setPort(value: string): void {
    const parsed = Number.parseInt(value, 10);
    this.patch({ smtpPort: Number.isNaN(parsed) ? 0 : parsed });
  }

  protected reset(): void {
    this.draft.set({
      provider: this.settings().provider,
      smtpHost: this.settings().smtpHost ?? '',
      smtpPort: this.settings().smtpPort ?? 587,
      smtpSecure: this.settings().smtpSecure,
      smtpUser: this.settings().smtpUser ?? '',
      fromEmail: this.settings().fromEmail ?? '',
      fromName: this.settings().fromName ?? '',
    });
    this.smtpPassword.set(null);
  }

  protected submit(): void {
    const d = this.draft();
    const payload: EmailSettingsPayload = { provider: d.provider };

    if (d.provider === 'smtp') {
      payload.smtpHost = d.smtpHost.trim();
      payload.smtpPort = d.smtpPort;
      payload.smtpSecure = d.smtpSecure;
      if (d.smtpUser.trim()) payload.smtpUser = d.smtpUser.trim();
    }

    if (d.provider !== 'console') {
      payload.fromEmail = d.fromEmail.trim();
      if (d.fromName.trim()) payload.fromName = d.fromName.trim();
    }

    // Only send a secret the operator actually touched.
    const password = this.smtpPassword();
    if (password !== null) payload.smtpPassword = password;

    this.save.emit(payload);
  }
}
