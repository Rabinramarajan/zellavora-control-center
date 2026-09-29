import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-toggle-switch',
  standalone: true,
  template: `
    <button
      type="button"
      role="switch"
      [id]="toggleId()"
      [attr.aria-checked]="checked()"
      [attr.aria-label]="ariaLabel()"
      (click)="checkedChange.emit(!checked())"
      class="group inline-flex items-center gap-3 min-h-[44px] cursor-pointer focus:outline-none"
    >
      <span
        class="relative w-10 h-6 rounded-full transition-colors duration-200 group-focus-visible:ring-2 group-focus-visible:ring-violet-500/60"
        [class]="checked() ? 'bg-violet-600' : 'bg-slate-700'"
      >
        <span
          class="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 motion-reduce:transition-none"
          [class.translate-x-4]="checked()"
        ></span>
      </span>
      @if (stateLabel()) {
        <span class="text-xs font-medium" [class]="checked() ? 'text-amber-300' : 'text-slate-400'">
          {{ stateLabel() }}
        </span>
      }
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToggleSwitchComponent {
  readonly checked = input.required<boolean>();
  readonly toggleId = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null);
  readonly stateLabel = input('');
  readonly checkedChange = output<boolean>();
}
