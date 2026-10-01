import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemePreference, ThemeService } from '../../../../core/services/theme.service';
import { SettingsCardComponent } from '../settings-card/settings-card.component';

interface ThemeOption {
  value: ThemePreference;
  label: string;
  hint: string;
}

/** Theme picker. Applies instantly and persists per browser, so there is no save step. */
@Component({
  selector: 'app-appearance-settings',
  standalone: true,
  imports: [SettingsCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-settings-card
      heading="Appearance"
      headingId="appearance-heading"
      description="Choose how Zellavora Control Center looks on this device."
    >
      <fieldset class="py-5">
        <legend class="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Theme
        </legend>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          @for (option of options; track option.value) {
            <label
              class="group relative flex flex-col gap-3 p-3 rounded-2xl border cursor-pointer transition-colors duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet-500/60"
              [class]="
                theme.preference() === option.value
                  ? 'border-violet-500 bg-violet-500/10'
                  : 'border-white/10 hover:border-violet-500/40 hover:bg-white/5'
              "
            >
              <input
                type="radio"
                name="theme-preference"
                class="sr-only"
                [value]="option.value"
                [checked]="theme.preference() === option.value"
                (change)="theme.setPreference(option.value)"
              />
              <span class="preview" [attr.data-variant]="option.value" aria-hidden="true">
                <span class="preview__half preview__half--light">
                  <span class="preview__bar"></span><span class="preview__line"></span
                  ><span class="preview__line preview__line--short"></span>
                </span>
                <span class="preview__half preview__half--dark">
                  <span class="preview__bar"></span><span class="preview__line"></span
                  ><span class="preview__line preview__line--short"></span>
                </span>
              </span>
              <span class="flex items-center justify-between gap-2">
                <span>
                  <span class="block text-sm font-semibold text-white">{{ option.label }}</span>
                  <span class="block text-[11px] text-slate-400">{{ option.hint }}</span>
                </span>
                @if (theme.preference() === option.value) {
                  <svg
                    class="w-5 h-5 shrink-0 text-violet-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                      clip-rule="evenodd"
                    />
                  </svg>
                }
              </span>
            </label>
          }
        </div>
        <p class="mt-4 text-xs text-slate-400" aria-live="polite">
          Currently showing the <span class="font-semibold text-slate-200">{{ theme.theme() }}</span>
          theme.
        </p>
      </fieldset>
    </app-settings-card>
  `,
  styles: [
    `
      .preview {
        display: flex;
        height: 4.5rem;
        border-radius: 0.75rem;
        overflow: hidden;
        border: 1px solid rgb(148 163 184 / 0.25);
      }
      .preview__half {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        padding: 0.5rem;
      }
      .preview[data-variant='light'] .preview__half--dark,
      .preview[data-variant='dark'] .preview__half--light {
        display: none;
      }
      .preview__half--light {
        background: #f8fafc;
      }
      .preview__half--dark {
        background: #07051a;
      }
      .preview__bar {
        height: 0.5rem;
        width: 60%;
        border-radius: 999px;
        background: #8b5cf6;
      }
      .preview__line {
        height: 0.375rem;
        border-radius: 999px;
      }
      .preview__line--short {
        width: 70%;
      }
      .preview__half--light .preview__line {
        background: #cbd5e1;
      }
      .preview__half--dark .preview__line {
        background: #334155;
      }
    `,
  ],
})
export class AppearanceSettingsComponent {
  protected readonly theme = inject(ThemeService);

  protected readonly options: readonly ThemeOption[] = [
    { value: 'light', label: 'Light', hint: 'Bright surfaces' },
    { value: 'dark', label: 'Dark', hint: 'Easy on the eyes' },
    { value: 'system', label: 'System', hint: 'Match your device' },
  ];
}
