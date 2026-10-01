import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormField, FormRoot, form, readonly } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import type { InvitationState } from '../../../../shared/models';
import { AuthService } from '../../../../core/auth/auth.service';
import { apiErrorCode } from '../../../../core/auth/auth-errors';
import { AuthFieldComponent } from '../../ui/auth-field.component';
import { AuthAlertComponent } from '../../ui/auth-alert.component';
import { PasswordRequirementsComponent } from '../../ui/password-requirements.component';
import { confirmPasswordRules, nameRules, newPasswordRules } from '../../ui/auth-validation';
import { injectPasswordPolicy, mapServerErrors, takeQueryToken } from '../../ui/form-errors';

type PageState = 'loading' | InvitationState | 'accepted' | 'already-active';

const STATE_TO_CODE: Record<string, PageState> = {
  INVITATION_EXPIRED: 'expired',
  INVITATION_USED: 'used',
  INVITATION_REVOKED: 'revoked',
  INVITATION_INVALID: 'invalid',
  ACCOUNT_ALREADY_ACTIVE: 'already-active',
};

@Component({
  selector: 'app-accept-invitation-page',
  standalone: true,
  imports: [
    FormField,
    FormRoot,
    RouterLink,
    AuthFieldComponent,
    AuthAlertComponent,
    PasswordRequirementsComponent,
  ],
  templateUrl: './accept-invitation.page.html',
  styleUrl: './accept-invitation.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AcceptInvitationPage {
  private readonly auth = inject(AuthService);
  private readonly token = takeQueryToken();

  protected readonly policy = injectPasswordPolicy();
  protected readonly state = signal<PageState>(this.token ? 'loading' : 'invalid');
  protected readonly organization = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);

  protected readonly model = signal({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
  });

  protected readonly form = form(
    this.model,
    (path) => {
      // The invited address is fixed by the invitation and can't be edited.
      readonly(path.email);
      nameRules(path.firstName, 'First name');
      nameRules(path.lastName, 'Last name');
      newPasswordRules(path.password, this.policy);
      confirmPasswordRules(path.confirmPassword, () => this.model().password);
    },
    { submission: { action: () => this.accept() } }
  );

  protected readonly problem = computed(() => {
    switch (this.state()) {
      case 'expired':
        return {
          title: 'Invitation expired',
          message: 'This invitation has expired. Ask your administrator to send a new one.',
          tone: 'warning' as const,
          signIn: false,
        };
      case 'used':
      case 'already-active':
        return {
          title: 'Account already active',
          message: 'This invitation has already been used. Sign in, or reset your password if you forgot it.',
          tone: 'info' as const,
          signIn: true,
        };
      case 'revoked':
        return {
          title: 'Invitation revoked',
          message: 'This invitation is no longer valid. Contact your administrator if you still need access.',
          tone: 'error' as const,
          signIn: false,
        };
      default:
        return {
          title: 'Invitation not found',
          message: 'This invitation link is invalid. Check that you opened the full link from your email.',
          tone: 'error' as const,
          signIn: false,
        };
    }
  });

  constructor() {
    if (this.token) void this.load();
  }

  private async load(): Promise<void> {
    try {
      const preview = await firstValueFrom(this.auth.previewInvitation(this.token));
      if (preview.state !== 'valid') {
        this.state.set(preview.state);
        return;
      }
      this.organization.set(preview.organizationName ?? null);
      this.model.update((m) => ({
        ...m,
        email: preview.email ?? '',
        firstName: preview.firstName ?? '',
        lastName: preview.lastName ?? '',
      }));
      this.state.set('valid');
    } catch {
      this.state.set('invalid');
    }
  }

  private async accept() {
    this.formError.set(null);
    const { firstName, lastName, password } = this.model();
    try {
      await firstValueFrom(
        this.auth.acceptInvitation({
          token: this.token,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          password,
        })
      );
      this.state.set('accepted');
      return undefined;
    } catch (err) {
      const terminal = STATE_TO_CODE[apiErrorCode(err) ?? ''];
      if (terminal) {
        this.state.set(terminal);
        return undefined;
      }
      const { fieldErrors, message } = mapServerErrors(
        err,
        { firstName: this.form.firstName, lastName: this.form.lastName, password: this.form.password },
        "We couldn't activate your account. Please try again."
      );
      this.formError.set(message);
      return fieldErrors;
    }
  }
}
