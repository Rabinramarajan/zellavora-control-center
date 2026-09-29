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
  template: `
    <app-settings-card
      heading="General settings"
      headingId="general-settings-heading"
      description="Configure basic application settings and preferences."
      [showSave]="true"
      [saving]="saving()"
      [dirty]="dirty()"
      (save)="save.emit(draft())"
      (reset)="draft.set(settings())"
    >
      <app-setting-row label="Site title" hint="The name of your application" icon="globe">
        <app-form-input-control
          type="text"
          aria-label="Site title"
          [value]="draft().siteTitle"
          (valueChange)="patch({ siteTitle: $event })"
        />
      </app-setting-row>

      <app-setting-row
        label="Site description"
        hint="A short description about your application"
        icon="document"
        controlId="site-description"
        [alignTop]="true"
      >
        <div class="relative">
          <textarea
            id="site-description"
            rows="3"
            [maxLength]="descriptionMax"
            [value]="draft().siteDescription"
            (input)="patch({ siteDescription: $any($event.target).value })"
            aria-describedby="site-description-count"
            class="w-full resize-none bg-slate-900/50 border border-white/10 text-slate-200 text-sm rounded-xl px-4 py-3 pb-7 transition-colors duration-200 focus:outline-none focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20"
          ></textarea>
          <span
            id="site-description-count"
            class="absolute right-3 bottom-3 text-[11px] tabular-nums"
            [class]="descriptionNearLimit() ? 'text-amber-300' : 'text-slate-500'"
          >
            {{ draft().siteDescription.length }}/{{ descriptionMax }}
          </span>
        </div>
      </app-setting-row>

      <app-setting-row label="Default timezone" hint="Used for dates across the app" icon="clock">
        <app-select-control
          aria-label="Default timezone"
          [options]="timezoneOptions"
          [value]="draft().timezone"
          (valueChange)="patch({ timezone: $event })"
        />
      </app-setting-row>

      <app-setting-row label="Date format" hint="Choose your preferred date format" icon="calendar">
        <app-select-control
          aria-label="Date format"
          [options]="dateFormatOptions"
          [value]="draft().dateFormat"
          (valueChange)="patch({ dateFormat: $event })"
        />
      </app-setting-row>

      <app-setting-row label="Items per page" hint="Default rows shown in tables" icon="list">
        <app-select-control
          aria-label="Items per page"
          [options]="itemsPerPageOptions"
          [value]="'' + draft().itemsPerPage"
          (valueChange)="patch({ itemsPerPage: +$event })"
        />
      </app-setting-row>

      <app-setting-row
        label="Maintenance mode"
        hint="Temporarily disable public access to the application"
        icon="bolt"
        controlId="maintenance-mode"
      >
        <app-toggle-switch
          toggleId="maintenance-mode"
          [checked]="draft().maintenanceMode"
          [stateLabel]="draft().maintenanceMode ? 'Application is offline' : 'Application is live'"
          (checkedChange)="patch({ maintenanceMode: $event })"
        />
      </app-setting-row>
    </app-settings-card>
  `,
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
    this.draft.update(current => ({ ...current, ...changes }));
  }
}
