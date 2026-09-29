import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormField, FormRoot, apply, form, minLength, required } from '@angular/forms/signals';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { AuthStore } from '@core/auth/auth.store';
import { ConfigService } from '@core/config/config.service';
import { Dialog } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  FormInputControl,
  SelectControl,
  SelectControlOption,
  emailFieldSchema,
} from '@zellavoras/ui';

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
  imports: [FormField, FormRoot, RouterLink, Dialog, ToastModule, FormInputControl, SelectControl],
  providers: [MessageService],
  templateUrl: './login.component.html',
  styleUrls: ['../../auth-shell.css', './login.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
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
  readonly passwordVisible = signal(false);

  // --- Organization state --------------------------------------------------
  readonly allOrgs = signal<Org[]>([]);
  readonly loadingOrgs = signal(false);

  readonly orgOptions = computed<SelectControlOption[]>(() =>
    this.allOrgs().map((org) => ({
      // The form stores the code lower-cased; the API returns it upper-cased.
      value: org.clientCode.toLowerCase(),
      label: org.name,
      description: org.clientCode,
      color: org.clientCode.toUpperCase() === 'DEMO' ? '#a855f7' : '#3b82f6',
    }))
  );

  // --- Form ----------------------------------------------------------------
  private readonly model = signal({
    clientCode: sessionStorage.getItem('zcc.clientCode') ?? '',
    email: '',
    password: '',
    rememberMe: false,
  });

  readonly form = form(
    this.model,
    (path) => {
      required(path.clientCode, { message: 'Select your organization.' });
      apply(path.email, emailFieldSchema());
      // Sign-in checks presence only; the strength policy applies when a password is set.
      required(path.password, { message: 'Password is required.' });
      minLength(path.password, 6, { message: 'Password must be at least 6 characters.' });
    },
    { submission: { action: () => this.signIn() } }
  );

  readonly selectedOrg = computed<Org | null>(() => {
    const code = this.form.clientCode().value().toLowerCase();
    if (!code) return null;
    return this.allOrgs().find((o) => o.clientCode.toLowerCase() === code) ?? null;
  });

  private readonly queryParams = toSignal(this.route.queryParams, { initialValue: {} as any });

  constructor() {
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
          this.messageService.add({
            severity: 'error',
            summary: 'Sign-in failed',
            detail: message,
            life: 5000,
          });
        }
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

  /** Runs only once every field is valid; `submit()` marks the fields touched first. */
  private async signIn(): Promise<undefined> {
    if (this.auth.isLoading()) return undefined;

    const request = this.model();

    try {
      const res = await firstValueFrom(this.auth.login(request));
      sessionStorage.setItem('zcc.clientCode', request.clientCode);
      if (res.mfaRequired) return undefined;
      this.messageService.add({
        severity: 'success',
        summary: 'Welcome back',
        detail: 'Signed in successfully',
        life: 3000,
      });
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Sign-in failed',
        detail: this.auth.error() ?? 'Please check your credentials and try again.',
        life: 5000,
      });
    }
    return undefined;
  }
}
