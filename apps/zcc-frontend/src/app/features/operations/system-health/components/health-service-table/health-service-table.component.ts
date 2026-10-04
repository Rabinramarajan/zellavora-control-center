import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ServiceHealthResult } from '../../system-health.models';

@Component({
  selector: 'zcc-health-service-table',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './health-service-table.component.html',
})
export class HealthServiceTableComponent {
  readonly services = input.required<ServiceHealthResult[]>();
  readonly viewService = output<ServiceHealthResult>();

  typeBadgeClass(type: string): string {
    switch (type) {
      case 'APPLICATION':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20';
      case 'DATABASE':
        return 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20';
      case 'AUTHENTICATION':
        return 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20';
      case 'STORAGE':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20';
      case 'CACHE':
        return 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20';
      case 'QUEUE':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-500/20';
    }
  }

  statusChip(status: string): { label: string; icon: string; css: string } {
    switch (status) {
      case 'HEALTHY':
        return {
          label: 'Healthy',
          icon: 'pi pi-check-circle',
          css: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
        };
      case 'DEGRADED':
        return {
          label: 'Degraded',
          icon: 'pi pi-exclamation-triangle',
          css: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20',
        };
      case 'DOWN':
        return {
          label: 'Down',
          icon: 'pi pi-times-circle',
          css: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/20',
        };
      default:
        return {
          label: 'Unknown',
          icon: 'pi pi-question-circle',
          css: 'bg-gray-500/15 text-gray-700 dark:text-gray-400 border-gray-500/20',
        };
    }
  }
}
