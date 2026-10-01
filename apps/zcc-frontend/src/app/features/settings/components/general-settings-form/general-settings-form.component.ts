import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { FormInputControl, SelectControl } from '@zellavoras/ui';
import {
  DATE_FORMAT_OPTIONS,
  GeneralSettings,
  ITEMS_PER_PAGE_OPTIONS,
  SITE_DESCRIPTION_MAX_LENGTH,
  TIMEZONE_OPTIONS,
} from '../../models/settings.model';
import { SettingsCardComponent } from '../settings-card/settings-card.component';
import { SettingRowComponent } from '../setting-row/setting-row.component';
import { ToggleSwitchComponent } from '../toggle-switch/toggle-switch.component';

@Component({
  selector: 'app-general-settings-form',
  standalone: true,
  imports: [
    FormInputControl,
    SelectControl,
    SettingsCardComponent,
    SettingRowComponent,
    ToggleSwitchComponent,
  ],
  templateUrl: './general-settings-form.component.html',
  styleUrl: './general-settings-form.component.scss',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeneralSettingsFormComponent {
  readonly settings = input.required<GeneralSettings>();
  readonly saving = input(false);
  readonly save = output<GeneralSettings>();

  protected readonly timezoneOptions = TIMEZONE_OPTIONS;
  protected readonly dateFormatOptions = DATE_FORMAT_OPTIONS;
  protected readonly itemsPerPageOptions = ITEMS_PER_PAGE_OPTIONS;
  protected readonly descriptionMax = SITE_DESCRIPTION_MAX_LENGTH;

  /** Local editable copy; resets whenever the parent supplies new saved settings. */
  protected readonly draft = linkedSignal(() => ({ ...this.settings() }));

  protected readonly dirty = computed(
    () => JSON.stringify(this.draft()) !== JSON.stringify(this.settings())
  );

  protected readonly descriptionNearLimit = computed(
    () => this.draft().siteDescription.length > this.descriptionMax * 0.9
  );

  protected patch(changes: Partial<GeneralSettings>): void {
    this.draft.update((current) => ({ ...current, ...changes }));
  }
}
