import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormInputControl } from '@zellavoras/ui';
import {
  MIN_PASSWORD_LENGTH,
  PasswordChange,
  StatusMessage,
} from '../../models/settings.model';

const EMPTY_PASSWORD_FORM: PasswordChange = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

@Component({
  selector: 'app-password-form',
  standalone: true,
  imports: [FormInputControl],
  template: `
    <form class="space-y-4 max-w-md" (submit)="$event.preventDefault(); submit()" novalidate>
      <app-form-input-control
        type="password"
        icon="lock"
        label="Current password"
        [value]="form().currentPassword"
        (valueChange)="patch({ currentPassword: $event })"
      />
      <app-form-input-control
        type="password"
        icon="lock"
        label="New password"
        [hint]="'At least ' + minLength + ' characters'"
        [value]="form().newPassword"
        (valueChange)="patch({ newPassword: $event })"
      />
      <app-form-input-control
        type="password"
        icon="lock"
        label="Confirm new password"
        [value]="form().confirmPassword"
        (valueChange)="patch({ confirmPassword: $event })"
      />

      <div aria-live="polite">
        @if (message(); as msg) {
          <p
            class="text-xs rounded-lg px-3 py-2 border"
            [class]="
              msg.severity === 'success'
                ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
                : 'text-red-300 bg-red-500/10 border-red-500/20'
            "
          >
            {{ msg.text }}
          </p>
        }
      </div>

      <button
        type="submit"
        [disabled]="saving()"
        class="min-h-[44px] px-5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl cursor-pointer transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
      >
        {{ saving() ? 'Updating…' : 'Update password' }}
      </button>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordFormComponent {
  readonly saving = input(false);
  readonly serverMessage = input<StatusMessage | null>(null);
  readonly submitted = output<{ currentPassword: string; newPassword: string }>();

  protected readonly minLength = MIN_PASSWORD_LENGTH;
  protected readonly form = signal<PasswordChange>(EMPTY_PASSWORD_FORM);
  protected readonly message = signal<StatusMessage | null>(null);

  constructor() {
    effect(() => {
      const msg = this.serverMessage();
      untracked(() => {
        this.message.set(msg);
        if (msg?.severity === 'success') this.form.set(EMPTY_PASSWORD_FORM);
      });
    });
  }

  protected patch(changes: Partial<PasswordChange>): void {
    this.form.update(current => ({ ...current, ...changes }));
  }

  protected submit(): void {
    const { currentPassword, newPassword, confirmPassword } = this.form();
    const error = !currentPassword
      ? 'Enter your current password.'
      : newPassword.length < this.minLength
        ? `New password must be at least ${this.minLength} characters.`
        : newPassword !== confirmPassword
          ? 'New passwords do not match.'
          : null;

    if (error) {
      this.message.set({ severity: 'error', text: error });
      return;
    }
    this.message.set(null);
    this.submitted.emit({ currentPassword, newPassword });
  }
}
