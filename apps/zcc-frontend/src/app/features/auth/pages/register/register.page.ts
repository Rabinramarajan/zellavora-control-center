import { ChangeDetectionStrategy, Component, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FormField, FormRoot, form, required, validate, type FieldTree } from '@angular/forms/signals';
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

interface Highlight {
  readonly icon: 'shield' | 'chart' | 'layers';
  readonly tone: 'cyan' | 'violet' | 'emerald';
  readonly title: string;
  readonly copy: string;
}

/**
 * Full-screen self-registration, sharing the sign-in showcase. Routed only
 * when the server enables it (registrationGuard).
 */
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
  templateUrl: './register.page.html',
  styleUrls: ['../../ui/auth-showcase.css', './register.page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly injector = inject(Injector);

  protected readonly year = new Date().getFullYear();
  protected readonly highlights: readonly Highlight[] = [
    { icon: 'shield', tone: 'violet', title: 'Enterprise grade', copy: 'Secure, compliant and audit ready' },
    { icon: 'chart', tone: 'cyan', title: 'Built for scale', copy: 'Grow your business without limits' },
    { icon: 'layers', tone: 'emerald', title: 'Unified control', copy: 'Everything you need in one place' },
  ];

  protected readonly policy = injectPasswordPolicy();
  protected readonly submitted = signal(false);
  protected readonly step = signal<1 | 2>(1);
  protected readonly steps = [
    { id: 1, label: 'Your details' },
    { id: 2, label: 'Secure account' },
  ] as const;
  protected readonly initials = computed(() => {
    const { firstName, lastName } = this.model();
    return `${firstName.trim()[0] ?? ''}${lastName.trim()[0] ?? ''}`.toUpperCase();
  });
  protected readonly formError = signal<string | null>(null);

  private readonly orgs = toSignal(this.auth.clients().pipe(catchError(() => of([]))));
  protected readonly orgsLoading = computed(() => this.orgs() === undefined);
  protected readonly orgOptions = computed<SelectControlOption[]>(() =>
    (this.orgs() ?? []).map((org) => ({
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
      const detailFields = this.detailFields();
      if (fieldErrors.some((e) => detailFields.includes(e.fieldTree as FieldTree<unknown>))) {
        this.step.set(1);
      }
      return fieldErrors;
    }
  }

  private detailFields(): FieldTree<unknown>[] {
    return [this.form.clientCode, this.form.firstName, this.form.lastName, this.form.email];
  }

  /** Validates step one in place; the full form only submits from step two. */
  protected next(): void {
    const fields = this.detailFields();
    fields.forEach((f) => f().markAsTouched());
    const firstInvalid = fields.find((f) => f().invalid());
    if (firstInvalid) {
      firstInvalid().focusBoundControl();
      return;
    }
    this.formError.set(null);
    this.goTo(2, this.form.password);
  }

  protected back(): void {
    this.goTo(1, this.form.clientCode);
  }

  /** Swaps steps and moves focus into the new one so keyboard and screen-reader users are not stranded. */
  private goTo(step: 1 | 2, focusTarget: FieldTree<unknown>): void {
    this.step.set(step);
    afterNextRender(() => focusTarget().focusBoundControl(), { injector: this.injector });
  }
}
