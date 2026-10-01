import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { SystemHealthRepository } from '../../core/repositories/system-health.repository';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-system-health',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [],
  templateUrl: './system-health.component.html',
  styleUrl: './system-health.component.scss',
})
export class SystemHealthComponent {
  readonly repository = inject(SystemHealthRepository);

  constructor() {
    void this.refreshMetrics();
  }

  async refreshMetrics() {
    await firstValueFrom(this.repository.loadHealthMetrics());
  }
}
