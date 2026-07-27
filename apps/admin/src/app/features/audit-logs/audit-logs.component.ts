import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditRepository } from '@core/repositories/audit.repository';
import { AuditRecord } from '@shared/models';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 space-y-6">
      <!-- Header -->
      <div class="flex justify-between items-center">
        <div>
          <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Audit Logs</h2>
          <p class="text-slate-600 dark:text-slate-400 mt-1">Review system interactions, logins, and modification records.</p>
        </div>
        <button (click)="exportCSV()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
          Export History CSV
        </button>
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap gap-4 items-center bg-white dark:bg-slate-800 p-4 border rounded-xl dark:border-slate-700 shadow-sm">
        <div class="flex items-center gap-2">
          <label class="text-xs font-semibold text-slate-500 uppercase">Severity</label>
          <select [(ngModel)]="filterSeverity" class="px-3 py-1.5 border rounded-lg dark:bg-slate-700 text-sm text-slate-900 dark:text-white">
            <option value="all">All Severities</option>
            <option value="info">Information</option>
            <option value="warn">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div class="flex-1 min-w-0">
          <input type="text" [(ngModel)]="searchTerm" placeholder="Search logs by action or actor..." class="w-full px-3 py-1.5 border rounded-lg dark:bg-slate-700 text-sm text-slate-900 dark:text-white" />
        </div>
      </div>

      <!-- Log Timeline -->
      <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div class="divide-y divide-slate-100 dark:divide-slate-700">
          <div *ngIf="filteredLogs().length === 0" class="p-12 text-center text-slate-500 text-sm">
            No matching audit records found.
          </div>

          <div *ngFor="let record of filteredLogs()" class="p-6 flex gap-4 items-start hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
            <!-- Severity Indicator -->
            <div class="w-2.5 h-2.5 rounded-full mt-2 shrink-0"
              [class.bg-blue-500]="record.severity === 'info'"
              [class.bg-yellow-500]="record.severity === 'warn'"
              [class.bg-red-500]="record.severity === 'critical'">
            </div>

            <!-- Content -->
            <div class="flex-1 space-y-1">
              <div class="flex justify-between items-start">
                <p class="font-semibold text-slate-900 dark:text-white">{{ record.action }}</p>
                <span class="text-xs text-slate-500 font-mono">{{ record.createdAt | date:'medium' }}</span>
              </div>
              <div class="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                <div class="flex gap-4">
                  <span>Actor: <strong>{{ record.actorName }}</strong></span>
                  <span *ngIf="record.ipAddress">IP: {{ record.ipAddress }}</span>
                </div>
                <span *ngIf="record.userAgent" class="truncate max-w-[250px]">{{ record.userAgent }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [],
})
export class AuditLogsComponent {
  readonly repository = inject(AuditRepository);

  filterSeverity: 'all' | 'info' | 'warn' | 'critical' = 'all';
  searchTerm = '';

  constructor() {
    this.repository.loadAuditLogs().subscribe();
  }

  filteredLogs(): AuditRecord[] {
    return this.repository.logs().filter((log) => {
      const matchSeverity = this.filterSeverity === 'all' || log.severity === this.filterSeverity;
      const matchSearch = !this.searchTerm.trim() || 
        log.action.toLowerCase().includes(this.searchTerm.toLowerCase()) || 
        log.actorName.toLowerCase().includes(this.searchTerm.toLowerCase());
      return matchSeverity && matchSearch;
    });
  }

  exportCSV() {
    this.repository.exportLogs().subscribe((blob) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    });
  }
}
