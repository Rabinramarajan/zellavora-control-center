import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SystemHealthService } from './system-health.service';
import { ServiceHealthResult, SystemHealthDashboard } from './system-health.models';
import { HealthSummaryComponent } from './components/health-summary/health-summary.component';
import { HealthServiceTableComponent } from './components/health-service-table/health-service-table.component';
import { HealthServiceDetailsComponent } from './components/health-service-details/health-service-details.component';
import { AppDialogService } from '../../../shared/components/dialog/app-dialog.service';

@Component({
  selector: 'zcc-system-health',
  standalone: true,
  imports: [
    CommonModule,
    HealthSummaryComponent,
    HealthServiceTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './system-health.component.html',
  styleUrl: './system-health.component.scss',
})
export class SystemHealthComponent {
  private readonly healthService = inject(SystemHealthService);
  private readonly dialogService = inject(AppDialogService);
  private readonly destroyRef = inject(DestroyRef);

  // Signals for state
  readonly dashboard = signal<SystemHealthDashboard | null>(null);
  readonly loading = signal<boolean>(true);
  readonly refreshing = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly autoRefreshInterval = signal<number>(0); // 0 = off, 30, 60, 300
  readonly lastCheckedTime = computed(() => {
    const d = this.dashboard();
    return d ? new Date(d.checkedAt) : null;
  });

  private intervalTimer: any = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearAutoRefresh();
    });

    void this.loadDashboard(false);
  }

  async loadDashboard(fresh = false) {
    if (this.dashboard()) {
      this.refreshing.set(true);
    } else {
      this.loading.set(true);
    }
    this.error.set(null);

    this.healthService.getHealth(fresh).subscribe({
      next: (data) => {
        this.dashboard.set(data);
        this.loading.set(false);
        this.refreshing.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.refreshing.set(false);
        this.error.set(err?.message || 'Unable to load system health information.');
      },
    });
  }

  onManualRefresh() {
    if (this.refreshing()) return;
    void this.loadDashboard(true);
  }

  onAutoRefreshChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const intervalSec = parseInt(target.value, 10);
    this.autoRefreshInterval.set(intervalSec);
    this.clearAutoRefresh();

    if (intervalSec > 0) {
      this.intervalTimer = setInterval(() => {
        if (!this.refreshing()) {
          void this.loadDashboard(true);
        }
      }, intervalSec * 1000);
    }
  }

  openServiceDetails(service: ServiceHealthResult) {
    this.dialogService.open(HealthServiceDetailsComponent, {
      data: service,
      position: 'right',
      size: 'lg',
      width: '520px',
    });
  }

  private clearAutoRefresh() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }
}
