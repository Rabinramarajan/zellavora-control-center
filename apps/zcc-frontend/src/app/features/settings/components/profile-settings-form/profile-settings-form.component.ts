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

const BIO_MAX_LENGTH = 280;

@Component({
  selector: 'app-profile-settings-form',
  standalone: true,
  imports: [FormInputControl, SettingsCardComponent],
  templateUrl: './profile-settings-form.component.html',
  styleUrl: './profile-settings-form.component.scss',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileSettingsFormComponent {
  readonly settings = input.required<ProfileSettings>();
  readonly saving = input(false);
  readonly save = output<ProfileSettings>();

  protected readonly bioMax = BIO_MAX_LENGTH;
  protected readonly draft = linkedSignal(() => ({ ...this.settings() }));

  protected readonly dirty = computed(
    () => JSON.stringify(this.draft()) !== JSON.stringify(this.settings())
  );

  protected patch(changes: Partial<ProfileSettings>): void {
    this.draft.update((current) => ({ ...current, ...changes }));
  }
}
