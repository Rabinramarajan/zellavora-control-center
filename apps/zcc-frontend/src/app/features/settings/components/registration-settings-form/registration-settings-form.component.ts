import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import {
  ORGANIZATION_REGISTRATION_TYPES,
  OrganizationRegistrationType,
  RegistrationSettings,
  RegistrationSettingsPayload,
} from '../../models/registration-settings.model';
import { SettingsCardComponent } from '../settings-card/settings-card.component';
import { SettingRowComponent } from '../setting-row/setting-row.component';
import { ToggleSwitchComponent } from '../toggle-switch/toggle-switch.component';

/**
 * Who may create their own account in this organization.
 *
 * Off by default, and off for every existing organization: turning on the
 * deployment-wide flag must not silently open every tenant to public sign-up.
 * Enabling it here also puts the organization in the public registration
 * picker, so the form says so rather than leaving it to be discovered.
 */
@Component({
  selector: 'app-registration-settings-form',
  standalone: true,
  imports: [SettingsCardComponent, SettingRowComponent, ToggleSwitchComponent],
  templateUrl: './registration-settings-form.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrationSettingsFormComponent {
  readonly settings = input.required<RegistrationSettings>();
  readonly saving = input(false);

  readonly save = output<RegistrationSettingsPayload>();

  protected readonly draft = linkedSignal<RegistrationSettingsPayload>(() => {
    const s = this.settings();
    return {
      allowSelfRegistration: s.allowSelfRegistration,
      allowedRegistrationTypes: [...s.allowedRegistrationTypes],
      requireAdminApproval: s.requireAdminApproval,
      requireEmailVerification: s.requireEmailVerification,
    };
  });

  /** Types this deployment offers at all; the rest are not shown as choices. */
  protected readonly availableTypes = computed(() =>
    ORGANIZATION_REGISTRATION_TYPES.filter((t) => this.settings().globallyAvailableTypes.includes(t))
  );

  protected readonly canSave = computed(() => {
    const s = this.settings();
    const d = this.draft();
    return (
      d.allowSelfRegistration !== s.allowSelfRegistration ||
      d.requireAdminApproval !== s.requireAdminApproval ||
      d.requireEmailVerification !== s.requireEmailVerification ||
      d.allowedRegistrationTypes.join() !== [...s.allowedRegistrationTypes].join()
    );
  });

  /** What the draft would mean once saved, so the effect is stated before saving. */
  protected readonly draftOpens = computed(
    () =>
      this.settings().globallyEnabled &&
      this.draft().allowSelfRegistration &&
      this.draft().allowedRegistrationTypes.length > 0
  );

  protected patch(partial: Partial<RegistrationSettingsPayload>): void {
    this.draft.update((d) => ({ ...d, ...partial }));
  }

  protected toggleType(type: OrganizationRegistrationType, on: boolean): void {
    this.patch({
      allowedRegistrationTypes: on
        ? [...new Set([...this.draft().allowedRegistrationTypes, type])]
        : this.draft().allowedRegistrationTypes.filter((t) => t !== type),
    });
  }

  protected isTypeOn(type: OrganizationRegistrationType): boolean {
    return this.draft().allowedRegistrationTypes.includes(type);
  }

  protected submit(): void {
    this.save.emit(this.draft());
  }

  protected reset(): void {
    this.draft.set({
      allowSelfRegistration: this.settings().allowSelfRegistration,
      allowedRegistrationTypes: [...this.settings().allowedRegistrationTypes],
      requireAdminApproval: this.settings().requireAdminApproval,
      requireEmailVerification: this.settings().requireEmailVerification,
    });
  }
}
