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
  template: `
    <zcc-iam-page-header
      [title]="meta().title"
      [icon]="meta().icon"
      [description]="meta().description"
    />

    @if (loading()) {
      <div class="h-72 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5"></div>
    } @else if (loadError()) {
      <zcc-empty-state
        icon="pi pi-exclamation-triangle"
        title="Failed to load policies"
        [message]="loadError()!"
      />
    } @else {
      @switch (section()) {
        @case ('password') {
          <form [class]="card + ' max-w-2xl space-y-5'" (submit)="savePassword($event)" novalidate>
            @for (f of passwordFields; track f.key) {
              <div>
                <label
                  [for]="'pw-' + f.key"
                  class="block text-sm font-medium text-gray-800 dark:text-gray-200"
                  >{{ f.label }}</label
                >
                <div class="mt-1.5 flex items-center gap-2">
                  <input
                    [id]="'pw-' + f.key"
                    type="number"
                    inputmode="numeric"
                    [min]="f.min"
                    [max]="f.max"
                    [class]="inputClass + ' min-h-[42px] w-32'"
                    [attr.aria-describedby]="'pw-' + f.key + '-hint'"
                    [attr.aria-invalid]="!!numberError(password()[f.key], f)"
                    [value]="password()[f.key]"
                    (input)="setPassword(f.key, $any($event.target).value)"
                  />
                  <span class="text-sm text-gray-500">{{ f.unit }}</span>
                </div>
                <p
                  [id]="'pw-' + f.key + '-hint'"
                  class="mt-1 text-xs"
                  [class]="
                    numberError(password()[f.key], f)
                      ? 'text-red-500'
                      : 'text-gray-500 dark:text-gray-400'
                  "
                >
                  {{ numberError(password()[f.key], f) ?? f.hint }}
                </p>
              </div>
            }
            <label class="flex min-h-[44px] cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                class="mt-0.5 size-5 accent-indigo-500"
                [checked]="password().disallowEmailInPassword"
                (change)="patchPassword({ disallowEmailInPassword: $any($event.target).checked })"
              />
              <span>
                <span class="block text-sm font-medium text-gray-800 dark:text-gray-200"
                  >Block passwords containing the email name</span
                >
                <span class="block text-xs text-gray-500 dark:text-gray-400"
                  >Rejects e.g. “jane.doe2026!” for jane.doe&#64;company.com.</span
                >
              </span>
            </label>
            <div class="flex gap-2 border-t border-gray-100 pt-4 dark:border-white/5">
              <button
                type="submit"
                [class]="btn.primary"
                [disabled]="saving() || !passwordDirty() || !passwordValid()"
              >
                {{ saving() ? 'Saving…' : 'Save changes' }}
              </button>
              <button
                type="button"
                [class]="btn.secondary"
                [disabled]="saving() || !passwordDirty()"
                (click)="reset()"
              >
                Discard
              </button>
            </div>
          </form>
        }

        @case ('login') {
          <form class="max-w-2xl space-y-6" (submit)="saveLogin($event)" novalidate>
            <fieldset [class]="card + ' space-y-5'">
              <legend class="px-1 text-base font-semibold text-gray-900 dark:text-white">
                Lockout & sessions
              </legend>
              @for (f of loginFields; track f.key) {
                <div>
                  <label
                    [for]="'lp-' + f.key"
                    class="block text-sm font-medium text-gray-800 dark:text-gray-200"
                    >{{ f.label }}</label
                  >
                  <div class="mt-1.5 flex items-center gap-2">
                    <input
                      [id]="'lp-' + f.key"
                      type="number"
                      inputmode="numeric"
                      [min]="f.min"
                      [max]="f.max"
                      [class]="inputClass + ' min-h-[42px] w-32'"
                      [attr.aria-describedby]="'lp-' + f.key + '-hint'"
                      [attr.aria-invalid]="!!loginError(f)"
                      [value]="login()[f.key]"
                      (input)="setLogin(f.key, $any($event.target).value)"
                    />
                    <span class="text-sm text-gray-500">{{ f.unit }}</span>
                  </div>
                  <p
                    [id]="'lp-' + f.key + '-hint'"
                    class="mt-1 text-xs"
                    [class]="loginError(f) ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'"
                  >
                    {{ loginError(f) ?? f.hint }}
                  </p>
                </div>
              }
            </fieldset>

            <fieldset [class]="card">
              <legend class="px-1 text-base font-semibold text-gray-900 dark:text-white">
                Network allow-list
              </legend>
              <p class="mb-3 text-sm text-gray-500 dark:text-gray-400">
                Only allow sign-in from these IPv4 addresses or CIDR ranges. Leave empty to allow
                any network.
                <strong class="font-medium text-amber-600 dark:text-amber-400"
                  >Include your own network before saving, or you will lock yourself out of new
                  sign-ins.</strong
                >
              </p>
              <label
                for="ip-ranges"
                class="mb-1.5 block text-sm font-medium text-gray-800 dark:text-gray-200"
                >Allowed ranges (one per line)</label
              >
              <textarea
                id="ip-ranges"
                rows="5"
                spellcheck="false"
                [class]="inputClass + ' font-mono'"
                placeholder="10.0.0.0/8&#10;203.0.113.7"
                [attr.aria-invalid]="!!invalidRanges().length"
                aria-describedby="ip-ranges-hint"
                [value]="rangesText()"
                (input)="rangesText.set($any($event.target).value)"
              ></textarea>
              <p
                id="ip-ranges-hint"
                class="mt-1 text-xs"
                [class]="
                  invalidRanges().length ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'
                "
              >
                @if (invalidRanges().length) {
                  Not a valid IPv4 address or range: {{ invalidRanges().join(', ') }}
                } @else {
                  {{ parsedRanges().length }} range(s). Up to 100.
                }
              </p>
            </fieldset>

            <div class="flex gap-2">
              <button
                type="submit"
                [class]="btn.primary"
                [disabled]="saving() || !loginDirty() || !loginValid()"
              >
                {{ saving() ? 'Saving…' : 'Save changes' }}
              </button>
              <button
                type="button"
                [class]="btn.secondary"
                [disabled]="saving() || !loginDirty()"
                (click)="reset()"
              >
                Discard
              </button>
            </div>
          </form>
        }

        @case ('mfa') {
          <div [class]="card + ' mb-6 max-w-2xl'">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h2 class="text-base font-semibold text-gray-900 dark:text-white">
                  Require MFA for everyone
                </h2>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Members without MFA are sent to set it up right after signing in. Existing
                  sessions are not interrupted.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                [attr.aria-checked]="policies()!.mfa.enforce"
                aria-label="Require MFA for everyone"
                class="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-50"
                [class]="policies()!.mfa.enforce ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-white/20'"
                [disabled]="saving()"
                (click)="toggleMfa()"
              >
                <span
                  class="inline-block size-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none"
                  [class]="policies()!.mfa.enforce ? 'translate-x-6' : 'translate-x-1'"
                ></span>
              </button>
            </div>
          </div>

          @if (compliance(); as c) {
            <div class="mb-4 grid grid-cols-3 gap-4 sm:max-w-xl">
              <div [class]="card">
                <p class="text-xs uppercase tracking-wide text-gray-500">Members</p>
                <p class="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
                  {{ c.summary.total }}
                </p>
              </div>
              <div [class]="card">
                <p class="text-xs uppercase tracking-wide text-gray-500">Enrolled</p>
                <p class="mt-1 text-2xl font-bold tabular-nums text-emerald-500">
                  {{ c.summary.enrolled }}
                </p>
              </div>
              <div [class]="card">
                <p class="text-xs uppercase tracking-wide text-gray-500">Not enrolled</p>
                <p class="mt-1 text-2xl font-bold tabular-nums text-amber-500">
                  {{ c.summary.notEnrolled }}
                </p>
              </div>
            </div>
            @if (c.summary.total) {
              <div
                class="mb-6 h-2 overflow-hidden rounded-full bg-gray-200 sm:max-w-xl dark:bg-white/10"
                role="img"
                [attr.aria-label]="enrolledPct() + '% of members enrolled'"
              >
                <div
                  class="h-full rounded-full bg-emerald-500"
                  [style.width.%]="enrolledPct()"
                ></div>
              </div>
            }
          }

          <div class="mb-3 flex items-center justify-between gap-3">
            <h2 class="text-base font-semibold text-gray-900 dark:text-white">Members</h2>
            <label class="sr-only" for="mfa-filter">Filter by enrolment</label>
            <select
              id="mfa-filter"
              [class]="inputClass + ' min-h-[40px] w-48'"
              (change)="setEnrolledFilter($any($event.target).value)"
            >
              <option value="">Everyone</option>
              <option value="false">Not enrolled</option>
              <option value="true">Enrolled</option>
            </select>
          </div>
          @if (compliance(); as c) {
            @if (c.data.length) {
              <ul [class]="card + ' divide-y divide-gray-100 !p-0 dark:divide-white/5'">
                @for (u of c.data; track u.id) {
                  <li class="flex min-h-[56px] flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                    <div class="min-w-0 flex-1">
                      <a
                        [routerLink]="['/iam/users', u.id]"
                        class="block truncate text-sm font-medium text-gray-900 hover:underline dark:text-white"
                        >{{ u.fullName }}</a
                      >
                      <span class="block truncate text-xs text-gray-500 dark:text-gray-400">{{
                        u.email
                      }}</span>
                    </div>
                    <span class="text-xs text-gray-500 dark:text-gray-400">{{
                      enrolmentDetail(u)
                    }}</span>
                    <zcc-status-chip
                      [value]="u.mfaEnabled ? 'enrolled' : 'not_enrolled'"
                      [label]="u.mfaEnabled ? 'Enrolled' : 'Not enrolled'"
                    />
                  </li>
                }
              </ul>
              <app-pagination
                class="px-1 py-3"
                entityLabel="members"
                [totalItems]="c.meta.total"
                [page]="compliancePage()"
                [pageSize]="20"
                (pageChange)="loadCompliance($event)"
              />
            } @else {
              <zcc-empty-state
                icon="pi pi-check-circle"
                title="Nobody here"
                message="No members match this filter."
              />
            }
          }
        }
      }
    }
  `,
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
