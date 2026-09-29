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
  template: `
    <form class="auth-form" [formRoot]="form" [attr.aria-label]="submitLabel()">
      <p class="reauth-prompt">{{ prompt() }}</p>
      @if (error()) {
        <app-auth-alert tone="error">{{ error() }}</app-auth-alert>
      }
      <app-auth-field
        [formField]="form.password"
        label="Current password"
        type="password"
        autocomplete="current-password"
      />
      @if (requireCode()) {
        <app-auth-field
          [formField]="form.code"
          label="Authenticator or recovery code"
          autocomplete="one-time-code"
          hint="The 6-digit code from your app, or one of your recovery codes."
        />
      }
      <div class="reauth-actions">
        <button type="button" class="auth-btn auth-btn--secondary auth-btn--inline" (click)="cancelled.emit()">
          Cancel
        </button>
        <button
          type="submit"
          class="auth-btn auth-btn--inline"
          [class.auth-btn--danger]="danger()"
          [class.auth-btn--primary]="!danger()"
          [disabled]="busy()"
        >
          @if (busy()) {
            <span class="auth-spinner" aria-hidden="true"></span>
          }
          <span>{{ submitLabel() }}</span>
        </button>
      </div>
    </form>
  `,
  styles: `
    :host { display: block; }
    .reauth-prompt { font-size: 0.875rem; color: var(--auth-text-muted); }
    .reauth-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.75rem; }
  `,
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
