import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SystemHealthRepository } from '@core/repositories/system-health.repository';

@Component({
  selector: 'app-system-health',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-6 space-y-6">
      <!-- Header -->
      <div class="flex justify-between items-center">
        <div>
          <h2 class="text-2xl font-bold text-slate-900 dark:text-white">System Health Monitor</h2>
          <p class="text-slate-600 dark:text-slate-400 mt-1">Monitor real-time server load, service status indicators, and queues.</p>
        </div>
        <button (click)="refreshMetrics()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
          Refresh Metrics
        </button>
      </div>

      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6" *ngIf="repository.metrics() as metrics">
        <!-- CPU Card -->
        <div class="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div class="flex justify-between items-center">
            <h3 class="text-sm font-bold text-slate-500 uppercase tracking-wider">CPU Usage</h3>
            <span class="text-2xl font-bold">{{ metrics.cpu.percentage }}%</span>
          </div>
          <div class="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
            <div class="h-full rounded-full bg-blue-500" [style.width.%]="metrics.cpu.percentage"></div>
          </div>
          <div class="text-xs text-slate-500 flex justify-between">
            <span>Core Load</span>
            <span>{{ metrics.cpu.used }} / {{ metrics.cpu.total }} Cores</span>
          </div>
        </div>

        <!-- RAM Card -->
        <div class="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div class="flex justify-between items-center">
            <h3 class="text-sm font-bold text-slate-500 uppercase tracking-wider">RAM Usage</h3>
            <span class="text-2xl font-bold">{{ metrics.ram.percentage }}%</span>
          </div>
          <div class="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
            <div class="h-full rounded-full bg-green-500" [style.width.%]="metrics.ram.percentage"></div>
          </div>
          <div class="text-xs text-slate-500 flex justify-between">
            <span>Memory Allocated</span>
            <span>{{ metrics.ram.used }}GB / {{ metrics.ram.total }}GB</span>
          </div>
        </div>

        <!-- Services status -->
        <div class="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <h3 class="text-sm font-bold text-slate-500 uppercase tracking-wider">Services status</h3>
          <div class="space-y-3">
            <!-- Database -->
            <div class="flex justify-between items-center">
              <span class="text-sm font-medium text-slate-700 dark:text-slate-300">Database</span>
              <div class="flex items-center gap-2">
                <span class="text-xs text-slate-400">{{ metrics.database.latencyMs }}ms</span>
                <span class="w-3.5 h-3.5 rounded-full" [class.bg-green-500]="metrics.database.status === 'healthy'"></span>
              </div>
            </div>

            <!-- Redis Cache -->
            <div class="flex justify-between items-center">
              <span class="text-sm font-medium text-slate-700 dark:text-slate-300">Redis Cache</span>
              <div class="flex items-center gap-2">
                <span class="text-xs text-slate-400">{{ metrics.redis.latencyMs }}ms</span>
                <span class="w-3.5 h-3.5 rounded-full" [class.bg-green-500]="metrics.redis.status === 'healthy'"></span>
              </div>
            </div>

            <!-- Supabase Storage -->
            <div class="flex justify-between items-center">
              <span class="text-sm font-medium text-slate-700 dark:text-slate-300">Storage API</span>
              <div class="flex items-center gap-2">
                <span class="text-xs text-slate-400">{{ metrics.storage.latencyMs }}ms</span>
                <span class="w-3.5 h-3.5 rounded-full" [class.bg-green-500]="metrics.storage.status === 'healthy'"></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [],
})
export class SystemHealthComponent {
  readonly repository = inject(SystemHealthRepository);

  constructor() {
    this.refreshMetrics();
  }

  refreshMetrics() {
    this.repository.loadHealthMetrics().subscribe();
  }
}
