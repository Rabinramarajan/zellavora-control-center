import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HasPermissionDirective } from '@core/rbac';
import { Table, ColumnDef, CellDirective } from '@shared/components/table/table';
import { AdminStoreService } from '../../../services';
import { Branch, BranchSearchCriteria } from '../../../models';

@Component({
  selector: 'zcc-branch-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, HasPermissionDirective, Table, CellDirective],
  templateUrl: './branch-manager.component.html',
  styleUrl: './branch-manager.component.css'
})
export class BranchManagerComponent implements OnInit {
  private store = inject(AdminStoreService);

  readonly branches = this.store.branches;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  readonly trackBy = (branch: Branch) => branch.admBranchId;

  readonly columns: ColumnDef<Branch>[] = [
    { key: 'branchCode', header: 'Branch Code', sortable: true },
    { key: 'branchName', header: 'Branch Name', sortable: true },
    { key: 'effectiveDate', header: 'Effective Date', value: (b) => b.effectiveDate ?? '' },
    { key: 'status', header: 'Status', sortable: true, value: (b) => b.statusValue ?? '' },
    { key: 'actions', header: 'Actions', align: 'right' },
  ];

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    try {
      const criteria: BranchSearchCriteria = {
        pageSize: 100,
        pageNumber: 1,
        ascending: true,
      };
      await this.store.loadBranches(criteria);
    } catch {
      // Error handling is done by the store
    }
  }

  onCreate(): void {
    // Navigate to new branch form
  }

  onView(branch: Branch): void {
    // Show branch details
  }

  onEdit(branch: Branch): void {
    // Show branch edit form
  }
}
