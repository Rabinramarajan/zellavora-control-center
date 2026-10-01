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
  templateUrl: './appearance-settings.component.html',
  styleUrl: './appearance-settings.component.scss',
})
export class AppearanceSettingsComponent {
  protected readonly theme = inject(ThemeService);

  protected readonly options: readonly ThemeOption[] = [
    { value: 'light', label: 'Light', hint: 'Bright surfaces' },
    { value: 'dark', label: 'Dark', hint: 'Easy on the eyes' },
    { value: 'system', label: 'System', hint: 'Match your device' },
  ];
}
