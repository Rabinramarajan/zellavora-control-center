import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { FormInputControl } from '@zellavoras/ui';
import { ProfileSettings } from '../../models/settings.model';
import { SettingsCardComponent } from '../settings-card/settings-card.component';
import { SettingRowComponent } from '../setting-row/setting-row.component';

@Component({
  selector: 'app-profile-settings-form',
  standalone: true,
  imports: [FormInputControl, SettingsCardComponent, SettingRowComponent],
  template: `
    <app-settings-card
      heading="Profile"
      headingId="profile-settings-heading"
      description="Your personal information shown across the workspace."
      [showSave]="true"
      [saving]="saving()"
      [dirty]="dirty()"
      (save)="save.emit(draft())"
      (reset)="draft.set(settings())"
    >
      <app-setting-row label="Full name" icon="user">
        <app-form-input-control
          type="text"
          aria-label="Full name"
          [value]="draft().fullName"
          (valueChange)="patch({ fullName: $event })"
        />
      </app-setting-row>

      <app-setting-row label="Email address" icon="mail">
        <app-form-input-control
          type="email"
          aria-label="Email address"
          [value]="draft().email"
          (valueChange)="patch({ email: $event })"
        />
      </app-setting-row>

      <app-setting-row label="Phone" icon="phone">
        <app-form-input-control
          type="tel"
          aria-label="Phone"
          [value]="draft().phone"
          (valueChange)="patch({ phone: $event })"
        />
      </app-setting-row>

      <app-setting-row label="Location" icon="map-pin">
        <app-form-input-control
          type="text"
          aria-label="Location"
          [value]="draft().location"
          (valueChange)="patch({ location: $event })"
        />
      </app-setting-row>

      <app-setting-row
        label="Biography"
        hint="A short introduction about yourself"
        icon="document"
        controlId="profile-bio"
        [alignTop]="true"
      >
        <textarea
          id="profile-bio"
          rows="4"
          [value]="draft().bio"
          (input)="patch({ bio: $any($event.target).value })"
          class="w-full resize-none bg-slate-900/50 border border-white/10 text-slate-200 text-sm rounded-xl px-4 py-3 transition-colors duration-200 focus:outline-none focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20"
        ></textarea>
      </app-setting-row>
    </app-settings-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileSettingsFormComponent {
  readonly settings = input.required<ProfileSettings>();
  readonly saving = input(false);
  readonly save = output<ProfileSettings>();

  protected readonly draft = linkedSignal(() => ({ ...this.settings() }));

  protected readonly dirty = computed(
    () => JSON.stringify(this.draft()) !== JSON.stringify(this.settings())
  );

  protected patch(changes: Partial<ProfileSettings>): void {
    this.draft.update(current => ({ ...current, ...changes }));
  }
}
