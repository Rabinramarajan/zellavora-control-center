import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { AuthStore } from '@core/auth/auth.store';
import { ConfigService } from '@core/config/config.service';
import { Dialog } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { InputControlComponent } from '@shared/components/input-control';
import { SelectControlComponent } from '@shared/components/select-control';

interface Org {
  name: string;
  clientCode: string;
  [key: string]: unknown;
}

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  USER_NOT_FOUND:
    'Your social login email is not registered in our platform. Please contact your admin.',
  OAUTH_EXCHANGE_FAILED: 'Failed to exchange authentication code with the provider.',
  OAUTH_CODE_MISSING: 'Authentication code missing from redirect.',
};

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, Dialog, ToastModule, InputControlComponent, SelectControlComponent],
  providers: [MessageService],
  templateUrl: './login.component.html',
  styleUrls: ['../../auth-shell.css', './login.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authStore = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly configService = inject(ConfigService);
  private readonly messageService = inject(MessageService);
  readonly auth = inject(AuthService);

  // --- Dialog visibility ---------------------------------------------------
  readonly visiblePrivacy = signal(false);
  readonly visibleTerms = signal(false);
  readonly visibleHelp = signal(false);
  readonly capsLock = signal(false);

  // --- Organization state --------------------------------------------------
  readonly allOrgs = signal<Org[]>([]);
  readonly loadingOrgs = signal(false);
  readonly selectedOrg = signal<Org | null>(null);

  /** The form stores the code lower-cased; the API returns it upper-cased. */
  readonly orgValue = (org: Org): string => org.clientCode.toLowerCase();

  // --- Form ----------------------------------------------------------------
  readonly form = this.fb.nonNullable.group({
    clientCode: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    rememberMe: [false],
  });

  /** Ticks on every value/status/touched/pristine change of the form. */
  private readonly formEvents = toSignal(this.form.events, { initialValue: null });

  /** Snapshot of everything the template needs from the form. */
  readonly formState = computed(() => {
    this.formEvents(); // dependency: recompute on any form event
    return {
      // Every field renders its own errors via the shared form controls.
      valid: this.form.valid,
    };
  });

  private readonly queryParams = toSignal(this.route.queryParams, { initialValue: {} as any });

  constructor() {
    const stored = sessionStorage.getItem('zcc.clientCode');
    if (stored) {
      this.form.controls.clientCode.setValue(stored);
    }

    // Handle OAuth redirect params.
    effect(() => {
      const params = this.queryParams();
      const accessToken = params['accessToken'];
      const refreshToken = params['refreshToken'];
      const error = params['error'];

      untracked(() => {
        if (accessToken && refreshToken) {
          void firstValueFrom(this.auth.loginWithTokens(accessToken, refreshToken));
          return;
        }
        if (error) {
          const message = OAUTH_ERROR_MESSAGES[error] ?? 'Social sign-in failed.';
          this.authStore.setError(message);
          this.messageService.add({ severity: 'error', summary: 'Sign-in failed', detail: message, life: 5000 });
        }
      });
    });

    // Match the pre-filled client code once organizations arrive.
    effect(() => {
      const orgs = this.allOrgs();
      if (!orgs.length) return;
      untracked(() => {
        if (this.selectedOrg()) return;
        const code = this.form.controls.clientCode.value;
        if (!code) return;
        // The select resolves its own display value from the control; this only
        // needs to feed the tenant-theme effect below.
        const matched = orgs.find((o) => o.clientCode.toLowerCase() === code.toLowerCase());
        if (matched) this.selectedOrg.set(matched);
      });
    });

    // Apply the tenant theme whenever the selected organization changes.
    effect(() => {
      const org = this.selectedOrg();
      if (!org) return;
      const root = document.documentElement;
      const isDemo = org.clientCode.toUpperCase() === 'DEMO';
      root.style.setProperty('--primary-color', isDemo ? '#a855f7' : '#3b82f6');
      root.style.setProperty('--secondary-color', isDemo ? '#3b82f6' : '#06b6d4');
    });

    this.loadOrgs();
  }

  private async loadOrgs(): Promise<void> {
    this.loadingOrgs.set(true);
    try {
      const res = await firstValueFrom(this.auth.loadClients());
      this.allOrgs.set(res?.tenants ?? []);
    } catch {
      /* ignore */
    } finally {
      this.loadingOrgs.set(false);
    }
  }

  // --- Actions -------------------------------------------------------------
  redirectToOAuth(provider: string): void {
    const adminApiUrl =
      this.configService.get('apiUrls.adminApi') || 'https://zcc-backend.vercel.app';
    window.location.href = `${adminApiUrl}/api/v1/auth/oauth/${provider}`;
  }

  onPasswordKeyup(event: KeyboardEvent): void {
    this.capsLock.set(event.getModifierState?.('CapsLock') ?? false);
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.auth.isLoading()) return;

    const request = this.form.getRawValue();

    try {
      const res = await firstValueFrom(this.auth.login(request));
      sessionStorage.setItem('zcc.clientCode', request.clientCode);
      if (res.mfaRequired) return;
      this.messageService.add({
        severity: 'success',
        summary: 'Welcome back',
        detail: 'Signed in successfully',
        life: 3000,
      });
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Sign-in failed',
        detail: this.auth.error() ?? 'Please check your credentials and try again.',
        life: 5000,
      });
      console.error('Login error:', error);
    }
  }
}
