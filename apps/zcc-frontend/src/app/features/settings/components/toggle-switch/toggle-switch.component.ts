import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-toggle-switch',
  standalone: true,
  templateUrl: './toggle-switch.component.html',
  styleUrl: './toggle-switch.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToggleSwitchComponent {
  readonly checked = input.required<boolean>();
  readonly toggleId = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null);
  readonly stateLabel = input('');
  readonly checkedChange = output<boolean>();
}
