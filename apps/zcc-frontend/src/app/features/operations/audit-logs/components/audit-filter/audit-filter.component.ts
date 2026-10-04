import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditFilterCriteria, AuditFilterOptions } from '../../audit-log.models';

@Component({
  selector: 'zcc-audit-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './audit-filter.component.html',
})
export class AuditFilterComponent {
  readonly options = input<AuditFilterOptions | null>(null);
  readonly searchSubmit = output<AuditFilterCriteria>();
  readonly resetFilters = output<void>();

  // Local filter form model
  readonly filterForm = signal<AuditFilterCriteria>({
    dateFrom: '',
    dateTo: '',
    user: '',
    module: '',
    action: '',
    resourceType: '',
    resourceId: '',
    status: '',
    ipAddress: '',
    correlationId: '',
    searchText: '',
  });

  onSearch() {
    this.searchSubmit.emit({ ...this.filterForm() });
  }

  onReset() {
    this.filterForm.set({
      dateFrom: '',
      dateTo: '',
      user: '',
      module: '',
      action: '',
      resourceType: '',
      resourceId: '',
      status: '',
      ipAddress: '',
      correlationId: '',
      searchText: '',
    });
    this.resetFilters.emit();
  }

  updateField<K extends keyof AuditFilterCriteria>(key: K, value: string) {
    this.filterForm.update((prev) => ({ ...prev, [key]: value }));
  }
}
