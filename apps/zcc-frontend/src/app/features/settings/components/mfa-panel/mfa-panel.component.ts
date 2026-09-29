import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormInputControl } from '@zellavoras/ui';
import { MfaStep } from '../../models/settings.model';

const BUTTON_BASE =
  'min-h-[44px] px-5 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400';

@Component({
  selector: 'app-mfa-panel',
  standalone: true,
  imports: [FormInputControl],
  template: `
    <div class="space-y-5">
      <div class="flex items-start justify-between gap-3">
        <p class="text-xs text-slate-400 leading-relaxed max-w-md">
          Add a second step at sign-in using an authenticator app such as Google Authenticator or
          Authy.
        </p>
        <span
          class="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide shrink-0 border"
          [class]="
            enabled()
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
              : 'bg-white/5 text-slate-400 border-white/10'
          "
        >
          {{ enabled() ? 'Enabled' : 'Disabled' }}
        </span>
      </div>

      <div aria-live="polite">
        @if (error()) {
          <p class="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {{ error() }}
          </p>
        }
      </div>

      @switch (step()) {
        @case ('qr') {
          <ol class="space-y-4">
            <li class="text-xs text-slate-300">1. Scan this QR code with your authenticator app.</li>
            <li>
              <img [src]="qrCode()" alt="QR code for authenticator setup" class="w-44 h-44 rounded-xl bg-white p-2" />
            </li>
            <li class="text-xs text-slate-300">2. Enter the 6-digit code it shows.</li>
          </ol>
          <div class="flex flex-wrap items-center gap-3">
            <app-form-input-control
              class="w-44"
              aria-label="Authenticator code"
              placeholder="6-digit code"
              [maxLength]="6"
              [value]="code()"
              (valueChange)="code.set($event)"
            />
            <button
              type="button"
              [class]="primaryButton"
              [disabled]="busy() || code().length !== 6"
              (click)="confirm.emit(code())"
            >
              {{ busy() ? 'Verifying…' : 'Verify & enable' }}
            </button>
          </div>
        }
        @case ('codes') {
          <div class="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-4">
            <p class="text-xs text-amber-200 leading-relaxed">
              Store these backup codes somewhere safe. Each code works once to recover your account.
            </p>
            <ul class="grid grid-cols-2 sm:grid-cols-3 gap-2" role="list">
              @for (recovery of recoveryCodes(); track recovery) {
                <li
                  class="bg-slate-900/60 border border-white/10 rounded-lg px-3 py-2 text-center text-xs font-mono text-slate-200 select-all"
                >
                  {{ recovery }}
                </li>
              }
            </ul>
            <div class="flex items-center gap-3">
              <button
                type="button"
                [class]="secondaryButton"
                [disabled]="busy()"
                (click)="regenerate.emit()"
              >
                Regenerate
              </button>
              <button type="button" [class]="primaryButton" (click)="done.emit()">Done</button>
            </div>
          </div>
        }
        @default {
          @if (enabled()) {
            <div class="space-y-3 max-w-md">
              <p class="text-xs text-slate-400">Disabling two-factor requires your current password.</p>
              <div class="flex items-center gap-3">
                <app-form-input-control
                  class="flex-1"
                  type="password"
                  icon="lock"
                  aria-label="Current password"
                  placeholder="Current password"
                  [value]="disablePassword()"
                  (valueChange)="disablePassword.set($event)"
                />
                <button
                  type="button"
                  [class]="dangerButton"
                  [disabled]="busy() || !disablePassword()"
                  (click)="disable.emit(disablePassword())"
                >
                  {{ busy() ? 'Disabling…' : 'Disable' }}
                </button>
              </div>
              <button
                type="button"
                class="text-xs font-semibold text-violet-300 hover:text-violet-200 min-h-[44px] cursor-pointer"
                [disabled]="busy()"
                (click)="regenerate.emit()"
              >
                Regenerate recovery codes
              </button>
            </div>
          } @else {
            <button
              type="button"
              [class]="primaryButton"
              [disabled]="busy()"
              (click)="start.emit()"
            >
              {{ busy() ? 'Generating…' : 'Enable two-factor' }}
            </button>
          }
        }
      }
    </div>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MfaPanelComponent {
  readonly enabled = input.required<boolean>();
  readonly step = input.required<MfaStep>();
  readonly qrCode = input('');
  readonly recoveryCodes = input<readonly string[]>([]);
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly start = output<void>();
  readonly confirm = output<string>();
  readonly regenerate = output<void>();
  readonly disable = output<string>();
  readonly done = output<void>();

  protected readonly code = signal('');
  protected readonly disablePassword = signal('');

  protected readonly primaryButton = `${BUTTON_BASE} bg-violet-600 hover:bg-violet-500`;
  protected readonly secondaryButton = `${BUTTON_BASE} bg-white/5 hover:bg-white/10 border border-white/10`;
  protected readonly dangerButton = `${BUTTON_BASE} bg-red-600/80 hover:bg-red-500`;
}
