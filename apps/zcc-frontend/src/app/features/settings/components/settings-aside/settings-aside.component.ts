import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { SystemInfoItem } from '../../models/settings.model';
import { SettingsIconComponent } from '../settings-icon/settings-icon.component';

const RING_CIRCUMFERENCE = 100;

@Component({
  selector: 'app-settings-aside',
  standalone: true,
  imports: [SettingsIconComponent, DecimalPipe],
  templateUrl: './settings-aside.component.html',
  styleUrl: './settings-aside.component.scss',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsAsideComponent {
  readonly roleName = input('Super Admin');
  readonly roleDescription = input('Full access to all features and settings.');
  readonly mfaEnabled = input(false);
  readonly storageUsedGb = input(0);
  readonly storageTotalGb = input(1);
  readonly systemInfo = input<readonly SystemInfoItem[]>([]);

  readonly manageSecurity = output<void>();

  protected readonly ringCircumference = RING_CIRCUMFERENCE;
  protected readonly usedPercent = computed(() =>
    Math.min(100, Math.round((this.storageUsedGb() / Math.max(this.storageTotalGb(), 1)) * 100))
  );
}
