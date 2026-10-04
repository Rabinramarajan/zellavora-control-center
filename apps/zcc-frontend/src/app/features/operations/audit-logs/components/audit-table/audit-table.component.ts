import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuditSearchItem } from '../../audit-log.models';

@Component({
  selector: 'zcc-audit-table',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './audit-table.component.html',
})
export class AuditTableComponent {
  readonly logs = input.required<AuditSearchItem[]>();
  readonly loading = input<boolean>(false);
  readonly currentSort = input<string>('createdAt,desc');
  readonly page = input<number>(1);
  readonly size = input<number>(25);
  readonly totalElements = input<number>(0);
  readonly totalPages = input<number>(1);

  readonly sortChange = output<string>();
  readonly pageChange = output<number>();
  readonly sizeChange = output<number>();
  readonly viewDetails = output<AuditSearchItem>();

  onSort(field: string) {
    const [currentField, currentDir] = this.currentSort().split(',');
    let newDir = 'desc';
    if (currentField === field && currentDir === 'desc') {
      newDir = 'asc';
    }
    this.sortChange.emit(`${field},${newDir}`);
  }

  isSorted(field: string): 'asc' | 'desc' | null {
    const [currentField, currentDir] = this.currentSort().split(',');
    if (currentField === field) {
      return currentDir === 'asc' ? 'asc' : 'desc';
    }
    return null;
  }

  onPageSelect(newPage: number) {
    if (newPage >= 1 && newPage <= this.totalPages() && newPage !== this.page()) {
      this.pageChange.emit(newPage);
    }
  }

  onSizeSelect(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.sizeChange.emit(parseInt(target.value, 10));
  }
}
