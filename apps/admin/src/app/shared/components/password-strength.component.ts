import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-password-strength',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-3">
      <!-- Strength Bar -->
      <div class="space-y-1">
        <div class="flex justify-between text-xs font-semibold">
          <span class="text-gray-500 dark:text-gray-400">Password Complexity</span>
          <span [class]="labelColor">{{ label }}</span>
        </div>
        <div class="h-2 w-full bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden flex gap-0.5">
          @for (segment of [1, 2, 3, 4]; track segment) {
            <div
              class="h-full flex-1 transition-all duration-300"
              [class]="segment <= score() ? barColor : 'bg-gray-200 dark:bg-white/5'"
            ></div>
          }
        </div>
      </div>

      <!-- Checklist -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div class="flex items-center gap-2" [class.text-green-500]="checks().hasLength" [class.text-gray-400]="!checks().hasLength">
          <span>{{ checks().hasLength ? '✓' : '○' }}</span>
          <span>At least 12 characters</span>
        </div>
        <div class="flex items-center gap-2" [class.text-green-500]="checks().hasUpper" [class.text-gray-400]="!checks().hasUpper">
          <span>{{ checks().hasUpper ? '✓' : '○' }}</span>
          <span>Uppercase letter (A-Z)</span>
        </div>
        <div class="flex items-center gap-2" [class.text-green-500]="checks().hasLower" [class.text-gray-400]="!checks().hasLower">
          <span>{{ checks().hasLower ? '✓' : '○' }}</span>
          <span>Lowercase letter (a-z)</span>
        </div>
        <div class="flex items-center gap-2" [class.text-green-500]="checks().hasNumber" [class.text-gray-400]="!checks().hasNumber">
          <span>{{ checks().hasNumber ? '✓' : '○' }}</span>
          <span>Number (0-9)</span>
        </div>
        <div class="flex items-center gap-2" [class.text-green-500]="checks().hasSpecial" [class.text-gray-400]="!checks().hasSpecial">
          <span>{{ checks().hasSpecial ? '✓' : '○' }}</span>
          <span>Special character (!@#...)</span>
        </div>
      </div>
    </div>
  `
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
      hasSpecial: /[^A-Za-z0-9]/.test(pwd)
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
