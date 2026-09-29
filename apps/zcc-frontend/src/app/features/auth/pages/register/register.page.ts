import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FormField, FormRoot, form, required, validate } from '@angular/forms/signals';
import { catchError, firstValueFrom, of } from 'rxjs';
import { SelectControl, type SelectControlOption } from '@zellavoras/ui';
import { AuthService } from '@core/auth/auth.service';
import { AuthFieldComponent } from '../../ui/auth-field.component';
import { AuthAlertComponent } from '../../ui/auth-alert.component';
import { PasswordRequirementsComponent } from '../../ui/password-requirements.component';
import {
  confirmPasswordRules,
  emailRules,
  nameRules,
  newPasswordRules,
} from '../../ui/auth-validation';
import { injectPasswordPolicy, mapServerErrors } from '../../ui/form-errors';

/** Self-registration. Routed only when the server enables it (registrationGuard). */
@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [
    FormField,
    FormRoot,
    RouterLink,
    SelectControl,
    AuthFieldComponent,
    AuthAlertComponent,
    PasswordRequirementsComponent,
  ],
  template: `
    <section class="auth-page" aria-labelledby="register-title">
      <header>
        <h1 id="register-title" class="auth-title">Create your account</h1>
        <p class="auth-lead">Join your organization's workspace on Zellavora Control Center.</p>
      </header>

      @if (submitted()) {
        <app-auth-alert tone="success" heading="Check your email">
          If the details are valid, a verification link is on its way to
          <strong>{{ model().email }}</strong>. Verify your email, then sign in.
        </app-auth-alert>
        <a class="auth-btn auth-btn--primary" routerLink="/auth/login">Go to sign in</a>
        <p class="auth-footer-note">
          No email? <a class="auth-link" routerLink="/auth/resend-verification">Resend verification</a>
        </p>
      } @else {
        @if (formError()) {
          <app-auth-alert tone="error">{{ formError() }}</app-auth-alert>
        }
        <form class="auth-form" [formRoot]="form" aria-labelledby="register-title">
          <app-select-control
            [formField]="form.clientCode"
            label="Organization"
            icon="building"
            placeholder="Select your organization"
            searchPlaceholder="Search organizations…"
            [options]="orgOptions()"
            [searchable]="true"
          />
          <div class="auth-row">
            <app-auth-field [formField]="form.firstName" label="First name" autocomplete="given-name" />
            <app-auth-field [formField]="form.lastName" label="Last name" autocomplete="family-name" />
          </div>
          <app-auth-field
            [formField]="form.email"
            label="Work email"
            type="email"
            autocomplete="email"
            inputmode="email"
            placeholder="name@company.com"
          />
          <div>
            <app-auth-field
              [formField]="form.password"
              label="Password"
              type="password"
              autocomplete="new-password"
            />
            <app-password-requirements [password]="model().password" [policy]="policy()" />
          </div>
          <app-auth-field
            [formField]="form.confirmPassword"
            label="Confirm password"
            type="password"
            autocomplete="new-password"
          />

          <div>
            <label class="auth-check">
              <input
                type="checkbox"
                [formField]="form.acceptTerms"
                [attr.aria-invalid]="termsError() ? true : null"
                [attr.aria-describedby]="termsError() ? 'terms-error' : null"
              />
              <span>
                I agree to the
                <a class="auth-link" href="https://zellavora.com/terms" target="_blank" rel="noopener">Terms of Service</a>
                and
                <a class="auth-link" href="https://zellavora.com/privacy" target="_blank" rel="noopener">Privacy Policy</a>.
              </span>
            </label>
            @if (termsError()) {
              <p id="terms-error" class="auth-inline-error">
                {{ termsError() }}
              </p>
            }
          </div>

          <button type="submit" class="auth-btn auth-btn--primary" [disabled]="form().submitting()">
            @if (form().submitting()) {
              <span class="auth-spinner" aria-hidden="true"></span><span>Creating account…</span>
            } @else {
              <span>Create account</span>
            }
          </button>
        </form>
        <p class="auth-footer-note">
          Already have an account? <a class="auth-link" routerLink="/auth/login">Sign in</a>
        </p>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPage {
  private readonly auth = inject(AuthService);

  protected readonly policy = injectPasswordPolicy();
  protected readonly submitted = signal(false);
  protected readonly formError = signal<string | null>(null);

  private readonly orgs = toSignal(this.auth.clients().pipe(catchError(() => of([]))), {
    initialValue: [],
  });
  protected readonly orgOptions = computed<SelectControlOption[]>(() =>
    this.orgs().map((org) => ({
      value: org.clientCode.toLowerCase(),
      label: org.name,
      description: org.clientCode,
    }))
  );

  protected readonly model = signal({
    clientCode: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
  });

  protected readonly form = form(
    this.model,
    (path) => {
      required(path.clientCode, { message: 'Select your organization.' });
      nameRules(path.firstName, 'First name');
      nameRules(path.lastName, 'Last name');
      emailRules(path.email);
      newPasswordRules(path.password, this.policy);
      confirmPasswordRules(path.confirmPassword, () => this.model().password);
      validate(path.acceptTerms, ({ value }) =>
        value() ? null : { kind: 'required', message: 'Accept the terms to create an account.' }
      );
    },
    { submission: { action: () => this.submit() } }
  );

  protected readonly termsError = computed(() => {
    const field = this.form.acceptTerms();
    return field.touched() && field.invalid() ? (field.errors()[0]?.message ?? null) : null;
  });

  private async submit() {
    this.formError.set(null);
    const m = this.model();
    try {
      await firstValueFrom(
        this.auth.register({
          clientCode: m.clientCode,
          firstName: m.firstName.trim(),
          lastName: m.lastName.trim(),
          email: m.email.trim().toLowerCase(),
          password: m.password,
          acceptTerms: true,
        })
      );
      this.submitted.set(true);
      return undefined;
    } catch (err) {
      const { fieldErrors, message } = mapServerErrors(
        err,
        {
          clientCode: this.form.clientCode,
          firstName: this.form.firstName,
          lastName: this.form.lastName,
          email: this.form.email,
          password: this.form.password,
        },
        "We couldn't create your account. Please try again."
      );
      this.formError.set(message);
      return fieldErrors;
    }
  }
}
