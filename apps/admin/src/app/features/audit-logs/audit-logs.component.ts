import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditRepository } from '@core/repositories/audit.repository';
import { AuditRecord } from '@shared/models';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit-logs.component.html',
  styleUrl: './audit-logs.component.css',
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
