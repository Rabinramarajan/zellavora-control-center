import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { catchError, firstValueFrom, map, of } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { apiErrorCode } from '../../../../core/auth/auth-errors';
import { AuthFieldComponent } from '../../ui/auth-field.component';
import { AuthAlertComponent } from '../../ui/auth-alert.component';
import { NexusShellComponent } from '../../components/nexus-shell/nexus-shell.component';
import { clientCodeRules, currentPasswordRules, emailRules } from '../../ui/auth-validation';
import { mapServerErrors } from '../../ui/form-errors';

/**
 * Zelavora Nexus sign-in. Renders outside the shared auth layout: the Nexus
 * shell owns the full-bleed composition, and this page fills its panel with
 * the credentials form.
 *
 * Unlike most auth screens, which are dark-only, the Nexus shell ships both
 * themes, so this route releases the forced dark theme while it is on screen.
 */
@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    FormField,
    FormRoot,
    RouterLink,
    AuthFieldComponent,
    AuthAlertComponent,
    NexusShellComponent,
  ],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly auth = inject(AuthService);

  protected readonly formError = signal<string | null>(null);
  protected readonly unverified = signal(false);

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
      clientCodeRules(path.clientCode);
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
