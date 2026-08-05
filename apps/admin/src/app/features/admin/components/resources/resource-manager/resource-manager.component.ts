import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HasPermissionDirective } from '@core/rbac';
import { AdminStoreService } from '../../../services';
import { Resource, ResourceSearchCriteria } from '../../../models';

@Component({
  selector: 'zcc-resource-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, HasPermissionDirective],
  templateUrl: './resource-manager.component.html',
  styleUrl: './resource-manager.component.css'
})
export class ResourceManagerComponent implements OnInit {
  private store = inject(AdminStoreService);

  readonly searchTerm = signal<string>('');
  readonly resources = this.store.resources;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  readonly filteredResources = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.resources().filter(resource =>
      resource.resourceName.toLowerCase().includes(term) ||
      (resource.resourceDescription?.toLowerCase().includes(term) || false)
    );
  });

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    try {
      const criteria: ResourceSearchCriteria = {
        pageSize: 100,
        pageNumber: 1,
        ascending: true,
      };
      await this.store.loadResources(criteria);
    } catch {
      // Error handling is done by the store
    }
  }

  onSearch(term: string): void {
    this.searchTerm.set(term);
  }

  onReset(): void {
    this.searchTerm.set('');
  }

  onCreate(): void {
    // Navigate to new resource form
  }

  onView(resource: Resource): void {
    // Show resource details
  }

  onEdit(resource: Resource): void {
    // Show resource edit form
  }

  async onDelete(resource: Resource): Promise<void> {
    if (!confirm('Are you sure?')) return;
    try {
      await this.store.deleteResource(resource.resourceId);
    } catch {
      // Error handling is done by the store
    }
  }
}
