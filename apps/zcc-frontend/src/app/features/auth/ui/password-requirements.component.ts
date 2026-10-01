import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PasswordPolicy } from '../../../shared/models';
import { DEFAULT_PASSWORD_POLICY, passwordRequirements } from './auth-validation';

/** Live checklist of the password policy. Each item states met/unmet in text, not only color. */
@Component({
  selector: 'app-password-requirements',
  standalone: true,
  templateUrl: './password-requirements.component.html',
  styleUrl: './password-requirements.component.scss',
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
