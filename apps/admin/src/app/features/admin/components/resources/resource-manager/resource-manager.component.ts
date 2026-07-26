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
  template: `
    <div class="resource-manager">
      <header class="page-header">
        <h1>Resources</h1>
        <button
          *hasPermission="'admin:resources:create'"
          class="btn btn-primary"
          (click)="onCreate()"
        >
          + New Resource
        </button>
      </header>

      <div class="filters-section">
        <input
          type="text"
          [(ngModel)]="searchTerm"
          (ngModelChange)="onSearch($event)"
          placeholder="Search resources..."
          class="search-input"
        />
        <button class="btn btn-secondary" (click)="onReset()">Reset</button>
      </div>

      <div class="loading" *ngIf="loading()">Loading resources...</div>
      <div class="error" *ngIf="error()">{{ error() }}</div>

      <div class="resources-grid">
        @for (resource of filteredResources(); track resource.resourceId) {
          <div class="resource-card">
            <h3>{{ resource.resourceName }}</h3>
            <p class="description">{{ resource.resourceDescription || 'No description' }}</p>
            <div class="meta">
              <span class="type">{{ resource.resourceTypeDescription || resource.resourceTypeValue }}</span>
              <span class="badge badge-active">Available</span>
            </div>
            <div class="actions">
              <button
                *hasPermission="'admin:resources:read'"
                class="btn btn-sm btn-ghost"
                (click)="onView(resource)"
              >
                View
              </button>
              <button
                *hasPermission="'admin:resources:update'"
                class="btn btn-sm btn-ghost"
                (click)="onEdit(resource)"
              >
                Edit
              </button>
              <button
                *hasPermission="'admin:resources:delete'"
                class="btn btn-sm btn-danger"
                (click)="onDelete(resource)"
              >
                Delete
              </button>
            </div>
          </div>
        } @empty {
          <div class="empty">No resources found.</div>
        }
      </div>
    </div>
  `,
  styles: [`
    .resource-manager { padding: 1.5rem; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .page-header h1 { margin: 0; }
    .filters-section { display: flex; gap: 0.75rem; margin-bottom: 1rem; }
    .search-input { flex: 1; min-width: 250px; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px; }
    .search-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
    .loading, .error { padding: 1rem; border-radius: 6px; margin-bottom: 1rem; }
    .loading { background: #dbeafe; color: #1e40af; }
    .error { background: #fee2e2; color: #991b1b; }
    .resources-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
    .resource-card { padding: 1rem; border: 1px solid #e5e7eb; border-radius: 8px; background: white; }
    .resource-card h3 { margin: 0 0 0.5rem 0; font-size: 1rem; }
    .description { margin: 0.5rem 0; color: #6b7280; font-size: 0.875rem; line-height: 1.4; }
    .meta { display: flex; gap: 0.5rem; margin: 0.75rem 0; }
    .type { display: inline-block; padding: 0.25rem 0.5rem; background: #f3f4f6; border-radius: 4px; font-size: 0.75rem; }
    .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.75rem; font-weight: 500; }
    .badge-active { background: #dcfce7; color: #166534; }
    .badge-inactive { background: #f3f4f6; color: #374151; }
    .actions { display: flex; gap: 0.5rem; margin-top: 1rem; }
    .actions button { flex: 1; }
    .empty { grid-column: 1 / -1; text-align: center; color: #6b7280; padding: 2rem; }
    .btn { padding: 0.5rem 1rem; border: none; border-radius: 6px; cursor: pointer; font-size: 0.875rem; }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-secondary { background: #e5e7eb; color: #111827; }
    .btn-ghost { background: transparent; color: #3b82f6; border: 1px solid #d1d5db; }
    .btn-danger { background: #ef4444; color: white; }
    .btn-sm { padding: 0.25rem 0.5rem; font-size: 0.75rem; }
  `]
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
    } catch (error) {
      console.error('Failed to load resources:', error);
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
    } catch (error) {
      console.error('Failed to delete resource:', error);
    }
  }
}
