import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import {
  FormField,
  FormRoot,
  form,
  hidden,
  required,
  validate,
  type FieldTree,
} from '@angular/forms/signals';
import { catchError, firstValueFrom, of } from 'rxjs';
import { FormInputControl, type SelectOption } from '@zellavoras/ui';
import { AuthService } from '../../../../core/auth/auth.service';
import type {
  RegisterRequest,
  RegistrationOutcome,
  RegistrationType,
} from '../../../../shared/models/auth.model';
import { AuthAlertComponent } from '../../ui/auth-alert.component';
import { PasswordRequirementsComponent } from '../../ui/password-requirements.component';
import { PasswordRevealComponent } from '../../ui/password-reveal.component';
import { RegistrationTypeCardsComponent } from '../../ui/registration-type-cards.component';
import { NexusShellComponent } from '../../components/nexus-shell/nexus-shell.component';
import {
  confirmPasswordRules,
  emailRules,
  nameRules,
  newPasswordRules,
} from '../../ui/auth-validation';
import { injectPasswordPolicy, mapServerErrors } from '../../ui/form-errors';
import {
  REGISTRATION_TYPES,
  metaFor,
  slugFor,
  typeFromSlug,
  type RegistrationTypeMeta,
} from './registration-types';
import { COUNTRIES, TIME_ZONES, detectCountry, detectTimeZone } from './registration-locale';

/**
 * Full-screen self-registration, sharing the Nexus shell with sign-in so the
 * two screens read as one product. Routed only when the server enables it
 * (registrationGuard).
 *
 * The registration type is chosen on a pre-step rather than as stepper step 1:
 * the branches have different step counts, so a stepper that renumbered after
 * the choice would be a progress indicator that lies. Account type is a mode,
 * not progress — it collapses into a changeable chip above the stepper.
 */
@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [
    FormField,
    FormRoot,
    RouterLink,
    FormInputControl,
    AuthAlertComponent,
    PasswordRequirementsComponent,
    PasswordRevealComponent,
    RegistrationTypeCardsComponent,
    NexusShellComponent,
  ],
  templateUrl: './register.page.html',
  styleUrl: './register.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  protected readonly policy = injectPasswordPolicy();
  protected readonly formError = signal<string | null>(null);
  protected readonly countryOptions: readonly SelectOption[] = COUNTRIES;
  protected readonly timeZoneOptions: readonly SelectOption[] = TIME_ZONES;

  // ---------------------------------------------------------------------------
  // Registration type
  // ---------------------------------------------------------------------------

  private readonly config = toSignal(this.auth.config().pipe(catchError(() => of(null))));

  /** Types this server offers, in the chooser's display order. */
  protected readonly availableTypes = computed<readonly RegistrationTypeMeta[]>(() => {
    const allowed = this.config()?.registrationTypes;
    // Before config resolves, assume the type the endpoint has always accepted
    // rather than flashing a chooser the server may not honour.
    if (!allowed) return REGISTRATION_TYPES.filter((m) => m.type === 'ORGANIZATION_MEMBER');
    return REGISTRATION_TYPES.filter((m) => allowed.includes(m.type));
  });

  /** A chooser with one option is a dead click, so that type is pre-selected. */
  private readonly onlyType = computed<RegistrationType | null>(() => {
    const types = this.availableTypes();
    return types.length === 1 ? types[0].type : null;
  });

  protected readonly type = signal<RegistrationType | null>(null);
  protected readonly meta = computed(() => metaFor(this.type() ?? 'ORGANIZATION_MEMBER'));
  protected readonly steps = computed(() => this.meta().steps);
  protected readonly step = signal(1);
  protected readonly stepLabel = computed(
    () => this.steps().find((s) => s.id === this.step())?.label ?? ''
  );

  /** Drives the direction of the step-in animation. */
  protected readonly direction = signal<'forward' | 'back'>('forward');

  protected readonly submitted = signal(false);
  protected readonly outcome = signal<RegistrationOutcome | null>(null);

  constructor() {
    const slug = new URLSearchParams(window.location.search).get('type');
    const allowed = this.availableTypes().map((m) => m.type);
    const fromUrl = typeFromSlug(slug, allowed);
    if (fromUrl) this.type.set(fromUrl);
    else if (this.onlyType()) this.type.set(this.onlyType());
  }

  protected chooseType(type: RegistrationType): void {
    this.type.set(type);
    this.formError.set(null);
    this.syncUrl(type);
    this.goTo(1, 'forward', this.firstFieldOfStep(1));
  }

  /** Returns to the chooser, keeping everything the person already typed. */
  protected changeType(): void {
    this.type.set(null);
    this.step.set(1);
    this.direction.set('back');
    this.formError.set(null);
    this.syncUrl(null);
    afterNextRender(() => this.typeCards()?.focus(), { injector: this.injector });
  }

  /**
   * Keeps `?type=` in step with the chosen mode so the flow is linkable and
   * browser Back leaves the wizard rather than walking its steps. Replaced, not
   * pushed: in-card Back owns step navigation.
   */
  private syncUrl(type: RegistrationType | null): void {
    void this.router.navigate([], {
      queryParams: { type: type ? slugFor(type) : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private readonly typeCards = viewChild(RegistrationTypeCardsComponent);

  // ---------------------------------------------------------------------------
  // Form
  // ---------------------------------------------------------------------------

  // The opted-in list, not every active tenant — see
  // AuthService.registrationOrganizations.
  private readonly orgs = toSignal(
    this.auth.registrationOrganizations().pipe(catchError(() => of([])))
  );
  protected readonly orgsLoading = computed(() => this.orgs() === undefined);
  protected readonly orgOptions = computed<SelectOption[]>(() =>
    (this.orgs() ?? []).map((org) => ({
      value: org.clientCode.toLowerCase(),
      // The code rides along in the label so two similarly named
      // organizations stay distinguishable, and so searching finds either.
      label: `${org.name} (${org.clientCode})`,
    }))
  );

  protected readonly model = signal({
    clientCode: '',
    orgName: '',
    orgCode: '',
    businessEmail: '',
    country: detectCountry(),
    timezone: detectTimeZone(),
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
  });

  protected readonly initials = computed(() => {
    const { firstName, lastName } = this.model();
    return `${firstName.trim()[0] ?? ''}${lastName.trim()[0] ?? ''}`.toUpperCase();
  });

  protected readonly form = form(
    this.model,
    (path) => {
      // Every rule is declared unconditionally and then switched off by type:
      // a hidden field drops out of its parent's validity, so the form is valid
      // on exactly the fields the chosen type actually asks for.
      hidden(path.clientCode, { when: () => this.type() !== 'ORGANIZATION_MEMBER' });
      required(path.clientCode, { message: 'Select your organization.' });

      const notCreatingOrg = () => this.type() !== 'CREATE_ORGANIZATION';
      hidden(path.orgName, { when: notCreatingOrg });
      hidden(path.orgCode, { when: notCreatingOrg });
      hidden(path.businessEmail, { when: notCreatingOrg });
      hidden(path.country, { when: notCreatingOrg });
      hidden(path.timezone, { when: notCreatingOrg });

      nameRules(path.orgName, 'Organization name');
      required(path.orgCode, { message: 'Enter an organization code.' });
      validate(path.orgCode, ({ value }) =>
        value() && !/^[a-z0-9-]{2,16}$/.test(value())
          ? {
              kind: 'pattern',
              message: '2–16 characters, using lowercase letters, numbers and hyphens.',
            }
          : null
      );
      emailRules(path.businessEmail);
      required(path.country, { message: 'Select a country.' });
      required(path.timezone, { message: 'Select a time zone.' });

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

  /** Derives the organization code from the name until the person edits it. */
  private orgCodeEdited = false;
  protected onOrgNameInput(): void {
    if (this.orgCodeEdited) return;
    const slug = this.model()
      .orgName.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 16);
    this.model.update((m) => ({ ...m, orgCode: slug }));
  }
  protected onOrgCodeInput(): void {
    this.orgCodeEdited = true;
    // A stale answer about a code the person has moved on from is worse than
    // no answer, so clear it as soon as the value changes.
    this.codeStatus.set(null);
  }

  /**
   * Inline availability for the organization code. Checked on blur rather than
   * per keystroke: the code is derived from the name, so mid-typing values are
   * mostly meaningless, and the endpoint is rate-limited.
   *
   * Advisory only — `register` still returns 409 on a code taken between the
   * check and the submit, and that is the authority.
   */
  protected readonly codeStatus = signal<'checking' | 'available' | 'taken' | null>(null);

  protected onOrgCodeBlur(): void {
    const code = this.model().orgCode.trim().toLowerCase();
    if (!code || this.form.orgCode().invalid()) {
      this.codeStatus.set(null);
      return;
    }
    this.codeStatus.set('checking');
    firstValueFrom(this.auth.checkOrganizationCode(code))
      .then((res) => {
        // Ignore a reply for a code the person has since changed.
        if (res.code !== this.model().orgCode.trim().toLowerCase()) return;
        this.codeStatus.set(res.available ? 'available' : 'taken');
      })
      // A failed check must not block the form; submit re-validates anyway.
      .catch(() => this.codeStatus.set(null));
  }

  // ---------------------------------------------------------------------------
  // Steps
  // ---------------------------------------------------------------------------

  /** Fields belonging to each step of the current type, in visual order. */
  private fieldsOfStep(step: number): FieldTree<unknown>[] {
    const type = this.type();
    if (type === 'CREATE_ORGANIZATION') {
      if (step === 1)
        return [
          this.form.orgName,
          this.form.orgCode,
          this.form.businessEmail,
          this.form.country,
          this.form.timezone,
        ];
      if (step === 2) return [this.form.firstName, this.form.lastName, this.form.email];
      return [];
    }
    if (step === 1) {
      const lead = type === 'ORGANIZATION_MEMBER' ? [this.form.clientCode] : [];
      return [...lead, this.form.firstName, this.form.lastName, this.form.email];
    }
    return [];
  }

  private firstFieldOfStep(step: number): FieldTree<unknown> | null {
    return this.fieldsOfStep(step)[0] ?? this.form.password;
  }

  /** Validates the current step in place; the form only submits from the last. */
  protected next(): void {
    const fields = this.fieldsOfStep(this.step());
    fields.forEach((f) => f().markAsTouched());
    const firstInvalid = fields.find((f) => f().invalid());
    if (firstInvalid) {
      firstInvalid().focusBoundControl();
      return;
    }
    this.formError.set(null);
    const nextStep = this.step() + 1;
    this.goTo(nextStep, 'forward', this.firstFieldOfStep(nextStep));
  }

  protected back(): void {
    const prev = this.step() - 1;
    if (prev < 1) {
      this.changeType();
      return;
    }
    this.goTo(prev, 'back', this.firstFieldOfStep(prev));
  }

  /** Jumps back to a specific step from the summary's Edit affordance. */
  protected editStep(step: number): void {
    this.goTo(step, 'back', this.firstFieldOfStep(step));
  }

  /** Swaps steps and moves focus into the new one so keyboard and screen-reader users are not stranded. */
  private goTo(
    step: number,
    direction: 'forward' | 'back',
    focusTarget: FieldTree<unknown> | null
  ): void {
    this.direction.set(direction);
    this.step.set(step);
    if (focusTarget) {
      afterNextRender(() => focusTarget().focusBoundControl(), { injector: this.injector });
    }
  }

  protected readonly isLastStep = computed(() => this.step() === this.steps().length);

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  private payload(): RegisterRequest {
    const m = this.model();
    const base = {
      firstName: m.firstName.trim(),
      lastName: m.lastName.trim(),
      email: m.email.trim().toLowerCase(),
      password: m.password,
      acceptTerms: true as const,
    };
    switch (this.type()) {
      case 'INDIVIDUAL':
        return { registrationType: 'INDIVIDUAL', ...base };
      case 'CREATE_ORGANIZATION':
        return {
          registrationType: 'CREATE_ORGANIZATION',
          organization: {
            name: m.orgName.trim(),
            code: m.orgCode.trim().toLowerCase(),
            businessEmail: m.businessEmail.trim().toLowerCase(),
            country: m.country,
            timezone: m.timezone,
          },
          ...base,
        };
      default:
        return { registrationType: 'ORGANIZATION_MEMBER', clientCode: m.clientCode, ...base };
    }
  }

  private async submit() {
    this.formError.set(null);
    try {
      const res = await firstValueFrom(this.auth.register(this.payload()));
      this.outcome.set(res.outcome);
      this.submitted.set(true);
      return undefined;
    } catch (err) {
      const { fieldErrors, message } = mapServerErrors(
        err,
        {
          clientCode: this.form.clientCode,
          'organization.name': this.form.orgName,
          'organization.code': this.form.orgCode,
          'organization.businessEmail': this.form.businessEmail,
          'organization.country': this.form.country,
          'organization.timezone': this.form.timezone,
          firstName: this.form.firstName,
          lastName: this.form.lastName,
          email: this.form.email,
          password: this.form.password,
        },
        "We couldn't create your account. Please try again."
      );
      this.formError.set(message);
      // Send the person back to the step that owns the rejected field, rather
      // than leaving an error they cannot see from here.
      for (const step of this.steps()) {
        const fields = this.fieldsOfStep(step.id);
        if (fieldErrors.some((e) => fields.includes(e.fieldTree as FieldTree<unknown>))) {
          this.goTo(step.id, 'back', null);
          break;
        }
      }
      return fieldErrors;
    }
  }
}
