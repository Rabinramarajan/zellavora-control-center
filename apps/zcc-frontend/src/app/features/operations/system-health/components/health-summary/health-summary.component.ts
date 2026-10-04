import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SystemHealthSummary, HealthStatus } from '../../system-health.models';

@Component({
  selector: 'zcc-health-summary',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './health-summary.component.html',
})
export class HealthSummaryComponent {
  readonly status = input.required<HealthStatus>();
  readonly summary = input.required<SystemHealthSummary>();
}
