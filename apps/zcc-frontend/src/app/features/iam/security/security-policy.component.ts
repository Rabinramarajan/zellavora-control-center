import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { IamAdminApiService } from '../../../core/api/iam-admin.api';
import {
  LoginPolicy,
  MfaComplianceUser,
  MfaCompliance,
  PasswordPolicy,
  SecurityPolicies,
} from '../../../shared/models/iam-admin.model';
import { EmptyStateComponent, StatusChipComponent } from '../../../shared/components/iam';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import {
  IAM_BTN,
  IAM_CARD,
  IAM_INPUT,
  IamPageHeaderComponent,
} from '../shared/iam-page-header.component';
import { IamDialogsService } from '../shared/iam-dialogs.service';
import { IamFeedbackService, errorMessage } from '../shared/iam-feedback.service';
import { formatDate, relativeTime } from '../shared/iam-format';

type Section = 'password' | 'login' | 'mfa';

interface NumberField<K extends string> {
  key: K;
  label: string;
  hint: string;
  min: number;
  max: number;
  unit?: string;
}

const PASSWORD_FIELDS: Array<NumberField<'minLength' | 'historyDepth'>> = [
  {
    key: 'minLength',
    label: 'Minimum length',
    hint: 'At least 12. Upper/lower case, a digit and a symbol are always required.',
    min: 12,
    max: 128,
    unit: 'characters',
  },
  {
    key: 'historyDepth',
    label: 'Password history',
    hint: 'Block reusing this many previous passwords. 0 turns reuse checks off.',
    min: 0,
    max: 24,
    unit: 'passwords',
  },
];

const LOGIN_FIELDS: Array<NumberField<Exclude<keyof LoginPolicy, 'allowedIpRanges'>>> = [
  {
    key: 'lockoutThreshold',
    label: 'Lockout threshold',
    hint: 'Failed sign-ins before the account is temporarily locked.',
    min: 3,
    max: 20,
    unit: 'attempts',
  },
  {
    key: 'lockoutMinutes',
    label: 'Lockout duration',
    hint: 'How long a locked account stays locked.',
    min: 1,
    max: 1440,
    unit: 'minutes',
  },
  {
    key: 'sessionIdleMinutes',
    label: 'Idle timeout',
    hint: 'Sign out after this much inactivity. 0 = off, otherwise at least 5.',
    min: 0,
    max: 1440,
    unit: 'minutes',
  },
  {
    key: 'sessionLifetimeDays',
    label: 'Maximum session lifetime',
    hint: 'Upper limit on how long any session lasts, including "remember me".',
    min: 1,
    max: 90,
    unit: 'days',
  },
  {
    key: 'maxConcurrentSessions',
    label: 'Concurrent sessions per user',
    hint: 'The oldest session is signed out when the limit is exceeded. 0 = unlimited.',
    min: 0,
    max: 50,
    unit: 'sessions',
  },
];

const IPV4_RANGE =
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}(\/(3[0-2]|[12]?\d))?$/;

const META: Record<Section, { title: string; icon: string; description: string }> = {
  password: {
    title: 'Password Policy',
    icon: 'pi pi-key',
    description: 'Rules applied whenever someone sets or changes a password.',
  },
  login: {
    title: 'Login Policy',
    icon: 'pi pi-sign-in',
    description: 'Account lockout, session limits and the network allow-list for sign-in.',
  },
  mfa: {
    title: 'MFA / 2FA',
    icon: 'pi pi-mobile',
    description: 'Require multi-factor authentication and track who has enrolled.',
  },
};

@Component({
  selector: 'zcc-security-policy',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IamPageHeaderComponent,
    EmptyStateComponent,
    StatusChipComponent,
    PaginationComponent,
    RouterLink,
  ],
  templateUrl: './security-policy.component.html',
  styleUrl: './security-policy.component.scss',
})
export class SecurityPolicyComponent {
  private readonly api = inject(IamAdminApiService);
  private readonly dialogs = inject(IamDialogsService);
  private readonly feedback = inject(IamFeedbackService);

  protected readonly btn = IAM_BTN;
  protected readonly card = IAM_CARD;
  protected readonly inputClass = IAM_INPUT;
  protected readonly passwordFields = PASSWORD_FIELDS;
  protected readonly loginFields = LOGIN_FIELDS;

  protected readonly section = toSignal(
    inject(ActivatedRoute).data.pipe(map((d) => (d['section'] as Section) ?? 'password')),
    { initialValue: 'password' as Section }
  );
  protected readonly meta = computed(() => META[this.section()]);

  protected readonly policies = signal<SecurityPolicies | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);

  // Editable drafts
  protected readonly password = signal<PasswordPolicy>({
    minLength: 12,
    historyDepth: 5,
    disallowEmailInPassword: true,
  });
  protected readonly login = signal<LoginPolicy>({
    lockoutThreshold: 5,
    lockoutMinutes: 15,
    sessionIdleMinutes: 0,
    sessionLifetimeDays: 30,
    maxConcurrentSessions: 0,
    allowedIpRanges: [],
  });
  protected readonly rangesText = signal('');
  protected readonly parsedRanges = computed(() =>
    this.rangesText()
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
  protected readonly invalidRanges = computed(() =>
    this.parsedRanges().filter((r) => !IPV4_RANGE.test(r))
  );

  protected readonly passwordDirty = computed(
    () => JSON.stringify(this.password()) !== JSON.stringify(this.policies()?.password)
  );
  protected readonly passwordValid = computed(() =>
    PASSWORD_FIELDS.every((f) => !this.numberError(this.password()[f.key], f))
  );
  protected readonly loginDirty = computed(
    () =>
      JSON.stringify({ ...this.login(), allowedIpRanges: this.parsedRanges() }) !==
      JSON.stringify(this.policies()?.login)
  );
  protected readonly loginValid = computed(
    () =>
      LOGIN_FIELDS.every((f) => !this.loginError(f)) &&
      !this.invalidRanges().length &&
      this.parsedRanges().length <= 100
  );

  // MFA compliance
  protected readonly compliance = signal<MfaCompliance | null>(null);
  protected readonly compliancePage = signal(1);
  private readonly enrolledFilter = signal<'' | 'true' | 'false'>('');
  protected readonly enrolledPct = computed(() => {
    const s = this.compliance()?.summary;
    return s && s.total ? Math.round((s.enrolled / s.total) * 100) : 0;
  });

  constructor() {
    void this.load();
  }

  protected numberError(value: number, f: { min: number; max: number }): string | null {
    if (value === null || Number.isNaN(value)) return 'Required.';
    if (!Number.isInteger(value)) return 'Enter a whole number.';
    if (value < f.min || value > f.max) return `Enter a value between ${f.min} and ${f.max}.`;
    return null;
  }

  protected loginError(
    f: NumberField<Exclude<keyof LoginPolicy, 'allowedIpRanges'>>
  ): string | null {
    const value = this.login()[f.key];
    const base = this.numberError(value, f);
    if (base) return base;
    if (f.key === 'sessionIdleMinutes' && value > 0 && value < 5)
      return 'Use 0 (off) or at least 5 minutes.';
    return null;
  }

  protected setPassword(key: 'minLength' | 'historyDepth', raw: string): void {
    this.patchPassword({ [key]: raw === '' ? NaN : Number(raw) });
  }

  protected patchPassword(patch: Partial<PasswordPolicy>): void {
    this.password.update((p) => ({ ...p, ...patch }));
  }

  protected setLogin(key: Exclude<keyof LoginPolicy, 'allowedIpRanges'>, raw: string): void {
    this.login.update((l) => ({ ...l, [key]: raw === '' ? NaN : Number(raw) }));
  }

  protected reset(): void {
    const p = this.policies();
    if (!p) return;
    this.password.set({ ...p.password });
    this.login.set({ ...p.login });
    this.rangesText.set(p.login.allowedIpRanges.join('\n'));
  }

  protected async savePassword(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.passwordValid() || !this.passwordDirty()) return;
    await this.save(async () => {
      const saved = await firstValueFrom(this.api.updatePasswordPolicy(this.password()));
      this.policies.update((p) => (p ? { ...p, password: saved } : p));
    }, 'Password policy saved.');
  }

  protected async saveLogin(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.loginValid() || !this.loginDirty()) return;
    const body: LoginPolicy = { ...this.login(), allowedIpRanges: this.parsedRanges() };
    const previous = this.policies()?.login.allowedIpRanges ?? [];
    if (body.allowedIpRanges.length && body.allowedIpRanges.join() !== previous.join()) {
      const ok = await this.dialogs.confirm(
        'Restrict sign-in by network?',
        'New sign-ins from any other network will be refused, including yours if it is not listed.',
        'Save allow-list'
      );
      if (!ok) return;
    }
    await this.save(async () => {
      const saved = await firstValueFrom(this.api.updateLoginPolicy(body));
      this.policies.update((p) => (p ? { ...p, login: saved } : p));
      this.reset();
    }, 'Login policy saved.');
  }

  protected async toggleMfa(): Promise<void> {
    const enforce = !this.policies()!.mfa.enforce;
    if (enforce) {
      const pending = this.compliance()?.summary.notEnrolled ?? 0;
      const ok = await this.dialogs.confirm(
        'Require MFA?',
        `${pending} member(s) without MFA will be asked to set it up at their next sign-in.`,
        'Require MFA',
        false
      );
      if (!ok) return;
    }
    await this.save(
      async () => {
        const saved = await firstValueFrom(this.api.updateMfaPolicy({ enforce }));
        this.policies.update((p) => (p ? { ...p, mfa: saved } : p));
      },
      enforce ? 'MFA is now required.' : 'MFA is no longer required.'
    );
  }

  protected setEnrolledFilter(value: string): void {
    this.enrolledFilter.set(value === 'true' || value === 'false' ? value : '');
    void this.loadCompliance(1);
  }

  protected async loadCompliance(page: number): Promise<void> {
    this.compliancePage.set(page);
    try {
      this.compliance.set(
        await firstValueFrom(
          this.api.getMfaCompliance({
            page,
            pageSize: 20,
            enrolled: this.enrolledFilter() || undefined,
          })
        )
      );
    } catch (err) {
      this.feedback.error(err, 'Could not load MFA enrolment.');
    }
  }

  protected enrolmentDetail(u: MfaComplianceUser): string {
    if (u.mfaEnabled) {
      const method = u.mfaMethod === 'email_otp' ? 'Email code' : 'Authenticator app';
      return `${method} · since ${formatDate(u.mfaEnrolledAt)}`;
    }
    return u.lastLoginAt ? `Last sign-in ${relativeTime(u.lastLoginAt)}` : 'Never signed in';
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      this.policies.set(await firstValueFrom(this.api.getSecurityPolicies()));
      this.reset();
      if (this.section() === 'mfa') await this.loadCompliance(1);
    } catch (err) {
      this.loadError.set(errorMessage(err, 'Could not load security policies.'));
    } finally {
      this.loading.set(false);
    }
  }

  private async save(action: () => Promise<void>, message: string): Promise<void> {
    this.saving.set(true);
    try {
      await action();
      this.feedback.success(message);
    } catch (err) {
      this.feedback.error(err);
    } finally {
      this.saving.set(false);
    }
  }
}
