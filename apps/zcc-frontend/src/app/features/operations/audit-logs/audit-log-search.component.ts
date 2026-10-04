import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuditLogService } from './audit-log.service';
import {
  AuditFilterCriteria,
  AuditFilterOptions,
  AuditSearchItem,
} from './audit-log.models';
import { AuditFilterComponent } from './components/audit-filter/audit-filter.component';
import { AuditTableComponent } from './components/audit-table/audit-table.component';
import { AuditDetailsComponent } from './components/audit-details/audit-details.component';
import { AppDialogService } from '../../../shared/components/dialog/app-dialog.service';
import { PermissionService } from '../../../core/rbac/services/permission.service';

@Component({
  selector: 'zcc-audit-log-search',
  standalone: true,
  imports: [
    CommonModule,
    AuditFilterComponent,
    AuditTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './audit-log-search.component.html',
  styleUrl: './audit-log-search.component.scss',
})
export class AuditLogSearchComponent {
  private readonly auditService = inject(AuditLogService);
  private readonly dialogService = inject(AppDialogService);
  private readonly permissionService = inject(PermissionService);

  // Search state signals
  readonly logs = signal<AuditSearchItem[]>([]);
  readonly loading = signal<boolean>(true);
  readonly exporting = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  readonly filterOptions = signal<AuditFilterOptions | null>(null);
  readonly activeFilters = signal<AuditFilterCriteria>({});

  // Pagination & Sorting state
  readonly page = signal<number>(1);
  readonly size = signal<number>(25);
  readonly sort = signal<string>('createdAt,desc');
  readonly totalElements = signal<number>(0);
  readonly totalPages = signal<number>(1);

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
    this.executeSearch();
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
    this.loading.set(true);
    this.error.set(null);

    this.auditService
      .search(this.activeFilters(), this.page(), this.size(), this.sort())
      .subscribe({
        next: (result) => {
          this.logs.set(result.content);
          this.totalElements.set(result.totalElements);
          this.totalPages.set(result.totalPages);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(err?.message || 'Unable to load audit logs.');
        },
      });
  }

  onFilterSubmit(criteria: AuditFilterCriteria) {
    this.activeFilters.set(criteria);
    this.page.set(1);
    this.executeSearch();
  }

  onFilterReset() {
    this.activeFilters.set({});
    this.page.set(1);
    this.executeSearch();
  }

  onSortChange(newSort: string) {
    this.sort.set(newSort);
    this.executeSearch();
  }

  onPageChange(newPage: number) {
    this.page.set(newPage);
    this.executeSearch();
  }

  onSizeChange(newSize: number) {
    this.size.set(newSize);
    this.page.set(1);
    this.executeSearch();
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
    this.auditService.exportCsv(this.activeFilters(), this.sort()).subscribe({
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
