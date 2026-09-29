import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PasswordPolicy } from '@shared/models';
import { DEFAULT_PASSWORD_POLICY, passwordRequirements } from './auth-validation';

/** Live checklist of the password policy. Each item states met/unmet in text, not only color. */
@Component({
  selector: 'app-password-requirements',
  standalone: true,
  template: `
    @if (password()) {
      <div class="meter" aria-live="polite">
        <div class="meter__track" aria-hidden="true">
          @for (seg of segments; track seg) {
            <span class="meter__seg" [class]="'meter__seg ' + (seg < strength().score ? 'meter__seg--' + strength().tone : '')"></span>
          }
        </div>
        <span class="meter__label" [class]="'meter__label meter__label--' + strength().tone">
          Strength: {{ strength().label }}
        </span>
      </div>
    }
    <ul class="reqs" aria-label="Password requirements">
      @for (req of requirements(); track req.id) {
        <li class="reqs__item" [class.reqs__item--met]="req.met">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            @if (req.met) {
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            } @else {
              <circle cx="12" cy="12" r="8" />
            }
          </svg>
          <span>{{ req.label }}</span>
          <span class="sr-only">{{ req.met ? '— met' : '— not met yet' }}</span>
        </li>
      }
    </ul>
  `,
  styles: `
    :host { display: block; }
    .reqs {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr));
      gap: 0.3rem 0.9rem;
      margin: 0.55rem 0 0;
      padding: 0;
      list-style: none;
    }
    .reqs__item {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.78rem;
      color: var(--auth-text-muted);
    }
    .reqs__item--met { color: var(--auth-success-text); }
    .meter { display: flex; align-items: center; gap: 0.75rem; margin-top: 0.6rem; }
    .meter__track { display: flex; flex: 1; gap: 0.3rem; }
    .meter__seg { flex: 1; height: 0.3rem; border-radius: 9999px; background: var(--auth-border); transition: background 0.2s ease; }
    .meter__seg--weak { background: var(--auth-danger); }
    .meter__seg--fair { background: var(--auth-warning); }
    .meter__seg--good { background: #60a5fa; }
    .meter__seg--strong { background: var(--auth-success); }
    .meter__label { flex-shrink: 0; font-size: 0.75rem; font-weight: 600; }
    .meter__label--weak { color: var(--auth-danger-text); }
    .meter__label--fair { color: var(--auth-warning); }
    .meter__label--good { color: #93c5fd; }
    .meter__label--strong { color: var(--auth-success-text); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordRequirementsComponent {
  readonly password = input('');
  readonly policy = input<PasswordPolicy>(DEFAULT_PASSWORD_POLICY);

  protected readonly requirements = computed(() => passwordRequirements(this.password(), this.policy()));
  protected readonly segments = [0, 1, 2, 3];

  /** Policy coverage plus extra length; a hint, not a guarantee — the server decides. */
  protected readonly strength = computed(() => {
    const reqs = this.requirements();
    const met = reqs.filter((r) => r.met).length;
    const allMet = met === reqs.length;
    const long = this.password().length >= this.policy().minLength + 4;
    const score = !allMet ? Math.min(2, Math.ceil((met / reqs.length) * 2)) : long ? 4 : 3;
    const levels = [
      { label: 'Weak', tone: 'weak' },
      { label: 'Weak', tone: 'weak' },
      { label: 'Fair', tone: 'fair' },
      { label: 'Good', tone: 'good' },
      { label: 'Strong', tone: 'strong' },
    ] as const;
    return { score: Math.max(score, 1), ...levels[score] };
  });
}
