import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormField, FormRoot, form, validate } from '@angular/forms/signals';
import { AuthFieldComponent } from '../../auth/ui/auth-field.component';
import { AuthAlertComponent } from '../../auth/ui/auth-alert.component';
import { currentPasswordRules } from '../../auth/ui/auth-validation';

export interface ReauthSubmission {
  password: string;
  code: string;
}

/**
 * Recent-authentication gate for sensitive account changes: current password,
 * optionally plus a 2FA / recovery code. The parent performs the API call and
 * reports failures through `error`.
 */
@Component({
  selector: 'app-reauth-form',
  standalone: true,
  imports: [FormField, FormRoot, AuthFieldComponent, AuthAlertComponent],
  templateUrl: './reauth-form.component.html',
  styleUrl: './reauth-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReauthFormComponent {
  readonly prompt = input('Confirm your password to continue.');
  readonly submitLabel = input('Continue');
  readonly requireCode = input(false);
  readonly danger = input(false);
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly confirmed = output<ReauthSubmission>();
  readonly cancelled = output<void>();

  private readonly model = signal({ password: '', code: '' });
  protected readonly form = form(
    this.model,
    (path) => {
      currentPasswordRules(path.password);
      // Two code formats are valid (TOTP or recovery), so only presence is checked here.
      validate(path.code, ({ value }) =>
        this.requireCode() && !value().trim()
          ? { kind: 'required', message: 'Enter an authenticator or recovery code.' }
          : null
      );
    },
    {
      submission: {
        action: async () => {
          const { password, code } = this.model();
          this.confirmed.emit({ password, code: code.trim() });
          return undefined;
        },
      },
    }
  );
}
