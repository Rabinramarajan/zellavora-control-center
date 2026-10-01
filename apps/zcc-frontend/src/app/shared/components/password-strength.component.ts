import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-password-strength',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [],
  templateUrl: './password-strength.component.html',
  styleUrl: './password-strength.component.scss',
})
export class PasswordStrengthComponent {
  password = input<string>('');

  checks = computed(() => {
    const pwd = this.password() || '';
    return {
      hasLength: pwd.length >= 12,
      hasUpper: /[A-Z]/.test(pwd),
      hasLower: /[a-z]/.test(pwd),
      hasNumber: /[0-9]/.test(pwd),
      hasSpecial: /[^A-Za-z0-9]/.test(pwd),
    };
  });

  score = computed(() => {
    const c = this.checks();
    let scoreCount = 0;
    if (c.hasLength) scoreCount++;
    if (c.hasUpper && c.hasLower) scoreCount++;
    if (c.hasNumber) scoreCount++;
    if (c.hasSpecial) scoreCount++;
    return scoreCount;
  });

  get label(): string {
    const s = this.score();
    if (s === 0) return 'Very Weak';
    if (s === 1) return 'Weak';
    if (s === 2) return 'Medium';
    if (s === 3) return 'Strong';
    return 'Very Strong';
  }

  get labelColor(): string {
    const s = this.score();
    if (s <= 1) return 'text-red-500';
    if (s === 2) return 'text-amber-500';
    if (s === 3) return 'text-indigo-500';
    return 'text-green-500';
  }

  get barColor(): string {
    const s = this.score();
    if (s <= 1) return 'bg-red-500';
    if (s === 2) return 'bg-amber-500';
    if (s === 3) return 'bg-indigo-500';
    return 'bg-green-500';
  }
}
