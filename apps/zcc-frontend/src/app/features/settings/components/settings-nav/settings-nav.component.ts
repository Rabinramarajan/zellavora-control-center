import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SettingsTab, SettingsTabId } from '../../models/settings.model';
import { SettingsIconComponent } from '../settings-icon/settings-icon.component';

@Component({
  selector: 'app-settings-nav',
  standalone: true,
  imports: [SettingsIconComponent],
  templateUrl: './settings-nav.component.html',
  styleUrl: './settings-nav.component.scss',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsNavComponent {
  readonly tabs = input.required<readonly SettingsTab[]>();
  readonly activeTab = input.required<SettingsTabId>();
  readonly tabSelect = output<SettingsTabId>();
}
