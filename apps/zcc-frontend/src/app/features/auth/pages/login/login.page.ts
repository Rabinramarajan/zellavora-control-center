import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FormField, FormRoot, form, required } from '@angular/forms/signals';
import { catchError, firstValueFrom, map, of } from 'rxjs';
import { SelectControl, type SelectControlOption } from '@zellavoras/ui';
import { AuthService } from '../../../../core/auth/auth.service';
import { apiErrorCode } from '../../../../core/auth/auth-errors';
import { AuthFieldComponent } from '../../ui/auth-field.component';
import { AuthAlertComponent } from '../../ui/auth-alert.component';
import { currentPasswordRules, emailRules } from '../../ui/auth-validation';
import { mapServerErrors } from '../../ui/form-errors';

interface Highlight {
  readonly icon: 'shield' | 'chart' | 'layers';
  readonly tone: 'cyan' | 'violet' | 'emerald';
  readonly title: string;
  readonly copy: string;
}

/**
 * Full-screen sign-in. Renders outside the shared auth layout because it owns
 * its own brand story, product preview and stats strip.
 */
@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormField, FormRoot, RouterLink, SelectControl, AuthFieldComponent, AuthAlertComponent],
  templateUrl: './login.page.html',
  styleUrl: '../../ui/auth-showcase.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly auth = inject(AuthService);

  protected readonly year = new Date().getFullYear();
  protected readonly highlights: readonly Highlight[] = [
    {
      icon: 'shield',
      tone: 'cyan',
      title: 'Enterprise grade',
      copy: 'Secure, compliant and audit ready',
    },
    {
      icon: 'chart',
      tone: 'violet',
      title: 'Built for scale',
      copy: 'Grow your business without limits',
    },
    {
      icon: 'layers',
      tone: 'emerald',
      title: 'Unified control',
      copy: 'Everything you need in one place',
    },
  ];

  protected readonly formError = signal<string | null>(null);
  protected readonly unverified = signal(false);

  private readonly orgs = toSignal(this.auth.clients().pipe(catchError(() => of([]))));
  protected readonly orgsLoading = computed(() => this.orgs() === undefined);
  protected readonly orgOptions = computed<SelectControlOption[]>(() =>
    (this.orgs() ?? []).map((org) => ({
      // The form stores codes lower-cased; the API matches case-insensitively.
      value: org.clientCode.toLowerCase(),
      label: org.name,
      description: org.clientCode,
    }))
  );
  protected readonly selfRegistration = toSignal(
    this.auth.config().pipe(
      map((c) => c.selfRegistrationEnabled),
      catchError(() => of(false))
    ),
    { initialValue: false }
  );

  private readonly model = signal({
    clientCode: this.auth.lastClientCode,
    email: '',
    password: '',
    rememberMe: false,
  });

  protected readonly form = form(
    this.model,
    (path) => {
      required(path.clientCode, { message: 'Select your organization.' });
      emailRules(path.email);
      currentPasswordRules(path.password);
    },
    { submission: { action: () => this.signIn() } }
  );

  private async signIn() {
    this.formError.set(null);
    this.unverified.set(false);
    try {
      await firstValueFrom(this.auth.login(this.model()));
      return undefined;
    } catch (err) {
      const code = apiErrorCode(err);
      if (code === 'ACCOUNT_LOCKED' || code === 'ACCOUNT_DISABLED') return undefined;
      if (code === 'EMAIL_NOT_VERIFIED') {
        this.unverified.set(true);
        return undefined;
      }
      // Never keep a rejected password in the form.
      this.model.update((m) => ({ ...m, password: '' }));
      const { fieldErrors, message } = mapServerErrors(
        err,
        { email: this.form.email, password: this.form.password, clientCode: this.form.clientCode },
        'Invalid email or password.'
      );
      this.formError.set(message);
      return fieldErrors;
    }
  }
}
