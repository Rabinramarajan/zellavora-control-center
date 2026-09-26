import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormInputControl, SelectControl, SelectControlOption } from '@zellavoras/ui';
import { AuditRepository } from '@core/repositories/audit.repository';
import { AuditRecord } from '@shared/models';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, FormInputControl, SelectControl],
  templateUrl: './audit-logs.component.html',
  styleUrl: './audit-logs.component.css',
})
export class AuditLogsComponent {
  readonly repository = inject(AuditRepository);

  filterSeverity: 'all' | 'info' | 'warn' | 'critical' = 'all';
  readonly severityOptions: SelectControlOption[] = [
    { value: 'all', label: 'All Severities' },
    { value: 'info', label: 'Information', color: '#38bdf8' },
    { value: 'warn', label: 'Warning', color: '#f59e0b' },
    { value: 'critical', label: 'Critical', color: '#f43f5e' },
  ];
  searchTerm = '';

  constructor() {
    void firstValueFrom(this.repository.loadAuditLogs());
  }

  filteredLogs(): AuditRecord[] {
    return this.repository.logs().filter((log) => {
      const matchSeverity = this.filterSeverity === 'all' || log.severity === this.filterSeverity;
      const matchSearch =
        !this.searchTerm.trim() ||
        log.action.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        log.actorName.toLowerCase().includes(this.searchTerm.toLowerCase());
      return matchSeverity && matchSearch;
    });
  }

  async exportCSV() {
    const blob = await firstValueFrom(this.repository.exportLogs());
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }
}
