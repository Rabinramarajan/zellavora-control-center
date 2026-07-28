import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HasPermissionDirective } from '@core/rbac';
import { AdminStoreService } from '../../../services';
import { Branch, BranchSearchCriteria } from '../../../models';

@Component({
  selector: 'zcc-branch-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, HasPermissionDirective],
  templateUrl: './branch-manager.component.html',
  styleUrl: './branch-manager.component.css'
})
export class BranchManagerComponent implements OnInit {
  private store = inject(AdminStoreService);

  readonly searchTerm = signal<string>('');
  readonly branches = this.store.branches;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  readonly filteredBranches = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.branches().filter(branch =>
      branch.branchCode.toLowerCase().includes(term) ||
      branch.branchName.toLowerCase().includes(term) ||
      (branch.statusValue?.toLowerCase().includes(term) || false)
    );
  });

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
    } catch (error) {
      console.error('Failed to load branches:', error);
    }
  }

  onSearch(term: string): void {
    this.searchTerm.set(term);
  }

  onReset(): void {
    this.searchTerm.set('');
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
