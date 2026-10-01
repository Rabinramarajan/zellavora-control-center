import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SettingsIconComponent } from '../settings-icon/settings-icon.component';

/** Section shell: header, projected body, and an optional save footer. */
@Component({
  selector: 'app-settings-card',
  standalone: true,
  imports: [SettingsIconComponent],
  templateUrl: './settings-card.component.html',
  styleUrl: './settings-card.component.scss',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsCardComponent {
  readonly heading = input.required<string>();
  readonly headingId = input.required<string>();
  readonly description = input('');
  readonly showSave = input(false);
  readonly saving = input(false);
  readonly dirty = input(false);

  readonly save = output<void>();
  readonly reset = output<void>();
}
