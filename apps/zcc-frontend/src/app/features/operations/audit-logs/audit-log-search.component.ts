import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuditLogService } from './audit-log.service';
import {
  AuditFilterCriteria,
  AuditFilterOptions,
  AuditSearchCriteria,
  AuditSearchItem,
} from './audit-log.models';
import { SEARCH_ENDPOINTS } from '../../../core/api/search-endpoints';
import { createSearchStore } from '../../../shared/search';
import { AuditFilterComponent } from './components/audit-filter/audit-filter.component';
import { AuditTableComponent } from './components/audit-table/audit-table.component';
import { AuditDetailsComponent } from './components/audit-details/audit-details.component';
import { AppDialogService } from '../../../shared/components/dialog/app-dialog.service';
import { PermissionService } from '../../../core/rbac/services/permission.service';

@Component({
  selector: 'zcc-audit-log-search',
  standalone: true,
  imports: [CommonModule, AuditFilterComponent, AuditTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './audit-log-search.component.html',
  styleUrl: './audit-log-search.component.scss',
})
export class AuditLogSearchComponent {
  private readonly auditService = inject(AuditLogService);
  private readonly dialogService = inject(AppDialogService);
  private readonly permissionService = inject(PermissionService);

  private readonly store = createSearchStore<AuditSearchCriteria, AuditSearchItem>({
    endpoint: SEARCH_ENDPOINTS.auditLogs,
  });

  readonly logs = this.store.items;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly exporting = signal<boolean>(false);

  readonly filterOptions = signal<AuditFilterOptions | null>(null);
  /** Applied filters in the shape the filter form and CSV export use. */
  readonly activeFilters = computed<AuditFilterCriteria>(() =>
    toFilterCriteria(this.store.criteria())
  );

  readonly page = this.store.pageNumber;
  readonly size = this.store.pageSize;
  /** `field,dir` for the table; empty while the server's default order applies. */
  readonly sort = computed(() => {
    const s = this.store.sort();
    return s ? `${s.key},${s.dir}` : '';
  });
  readonly totalElements = this.store.totalCount;
  readonly totalPages = this.store.totalPages;

  readonly canExport = computed(() => {
    return (
      this.permissionService.canSync('AUDIT_LOG_EXPORT') ||
      this.permissionService.canSync('system:audit:export') ||
      this.permissionService.canSync('system:*') ||
      this.permissionService.canSync('*:*')
    );
  });

  constructor() {
    this.loadFilterOptions();
  }

  loadFilterOptions() {
    this.auditService.getFilterOptions().subscribe({
      next: (options) => this.filterOptions.set(options),
      error: () => {
        // Fallback options
        this.filterOptions.set({
          modules: ['AUTHENTICATION', 'USERS', 'USER_REQUESTS', 'GROUPS', 'ROLES', 'OPERATIONS'],
          actions: ['LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT'],
          resourceTypes: ['USER', 'ROLE', 'GROUP', 'BRANCH'],
          statuses: ['SUCCESS', 'FAILURE'],
        });
      },
    });
  }

  executeSearch() {
    void this.store.reload();
  }

  onFilterSubmit(criteria: AuditFilterCriteria) {
    void this.store.search(toSearchCriteria(criteria));
  }

  onFilterReset() {
    void this.store.reset();
  }

  onSortChange(newSort: string) {
    const [key, dir] = newSort.split(',');
    void this.store.sortBy({ key, dir: dir === 'asc' ? 'asc' : 'desc' });
  }

  onPageChange(newPage: number) {
    void this.store.setPage(newPage);
  }

  onSizeChange(newSize: number) {
    void this.store.setPage(1, newSize);
  }

  openDetails(item: AuditSearchItem) {
    this.dialogService.open(AuditDetailsComponent, {
      data: item.auditId,
      position: 'right',
      size: 'xl',
      width: '680px',
    });
  }

  exportCurrentResults() {
    if (this.exporting() || !this.canExport()) return;

    this.exporting.set(true);
    this.auditService.exportCsv(this.activeFilters(), this.sort() || undefined).subscribe({
      next: (blob) => {
        this.exporting.set(false);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.exporting.set(false);
        alert(err?.message || 'Failed to export audit logs');
      },
    });
  }
}

const blank = (v: string | undefined): string | null => v?.trim() || null;

const toSearchCriteria = (f: AuditFilterCriteria): AuditSearchCriteria => ({
  fromDate: blank(f.dateFrom),
  toDate: blank(f.dateTo),
  changedBy: blank(f.user),
  moduleName: blank(f.module),
  action: blank(f.action),
  resourceType: blank(f.resourceType),
  resourceId: blank(f.resourceId),
  statusValue: blank(f.status),
  ipAddress: blank(f.ipAddress),
  correlationId: blank(f.correlationId),
  searchText: blank(f.searchText),
});

const toFilterCriteria = (c: AuditSearchCriteria | null): AuditFilterCriteria => {
  if (!c) return {};
  const entries: Array<[keyof AuditFilterCriteria, string | null]> = [
    ['dateFrom', c.fromDate],
    ['dateTo', c.toDate],
    ['user', c.changedBy],
    ['module', c.moduleName],
    ['action', c.action],
    ['resourceType', c.resourceType],
    ['resourceId', c.resourceId],
    ['status', c.statusValue],
    ['ipAddress', c.ipAddress],
    ['correlationId', c.correlationId],
    ['searchText', c.searchText],
  ];
  return Object.fromEntries(entries.filter(([, v]) => v)) as AuditFilterCriteria;
};
