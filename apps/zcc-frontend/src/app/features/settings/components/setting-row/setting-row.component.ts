import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SettingsIconName } from '../../models/settings.model';
import { SettingsIconComponent } from '../settings-icon/settings-icon.component';

/** Label + hint on the left, projected control on the right (stacked on mobile). */
@Component({
  selector: 'app-setting-row',
  standalone: true,
  imports: [SettingsIconComponent],
  templateUrl: './setting-row.component.html',
  styleUrl: './setting-row.component.scss',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingRowComponent {
  readonly label = input.required<string>();
  readonly hint = input('');
  readonly icon = input<SettingsIconName | null>(null);
  readonly controlId = input<string | null>(null);
  readonly alignTop = input(false);
}
