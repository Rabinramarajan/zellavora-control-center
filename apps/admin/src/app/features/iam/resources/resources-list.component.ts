import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IamApiService, unwrap } from '@core/api/iam.api';
import { ResourceListItem, ResourceTreeNode, ResourceType } from '@shared/models/iam.model';
import { createListStore } from '@shared/utils/create-list-store';
import {
  DataTableComponent,
  DataTableColumn,
  FilterBarComponent,
  PaginationBarComponent,
  StatusChipComponent,
  EmptyStateComponent,
} from '@shared/components/iam';
import { firstValueFrom } from 'rxjs';

const TYPE_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'API', value: 'API' },
  { label: 'Feature', value: 'FEATURE' },
  { label: 'Data', value: 'DATA' },
  { label: 'Menu', value: 'MENU' },
  { label: 'Report', value: 'REPORT' },
  { label: 'Integration', value: 'INTEGRATION' },
];

@Component({
  selector: 'zcc-resources-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DataTableComponent,
    FilterBarComponent,
    PaginationBarComponent,
    StatusChipComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-gray-900 dark:text-white">Resources</h1>
        <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          Protected entitlements — each action maps to a permission key.
        </p>
      </div>
      <a
        routerLink="/iam/resources/new"
        class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-600"
      >
        <i class="pi pi-plus text-xs" aria-hidden="true"></i>
        New Resource
      </a>
    </div>

    <div class="mb-4">
      <zcc-filter-bar
        [query]="store.q()"
        [filters]="filters()"
        [selected]="selectedFilters()"
        (search)="onSearch($event)"
        (filtersChange)="onFiltersChange($event)"
        (resetClicked)="onReset()"
      />
    </div>

    @if (store.loading()) {
      <div class="space-y-2">
        @for (_ of [1, 2, 3, 4, 5]; track $index) {
          <div
            class="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5"
          ></div>
        }
      </div>
    } @else if (store.error()) {
      <zcc-empty-state
        icon="pi pi-exclamation-triangle"
        title="Failed to load resources"
        [message]="store.error()!"
      />
    } @else if (store.hasItems()) {
      <zcc-data-table
        [columns]="columns()"
        [rows]="store.items()"
        [rowTemplate]="rowTpl"
        [rowClickable]="true"
        (rowClick)="onRowClick($event)"
      >
        <ng-template #rowTpl let-r>
          <td class="px-4 py-3">
            <a
              [routerLink]="['/iam/resources', r.id]"
              class="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              (click)="$event.stopPropagation()"
            >
              {{ r.name }}
            </a>
            <p class="text-xs text-gray-400 font-mono">{{ r.key }}</p>
          </td>
          <td class="px-4 py-3">
            <zcc-status-chip [value]="r.type" [label]="r.typeLabel" />
          </td>
          <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ r.category ?? '—' }}</td>
          <td class="px-4 py-3 text-gray-600 dark:text-gray-300">
            <span class="tabular-nums">{{ r.actionCount }}</span>
          </td>
          <td class="px-4 py-3">
            <zcc-status-chip [value]="r.status" [label]="r.status === 'ACTIVE' ? 'Active' : 'Inactive'" />
          </td>
        </ng-template>
      </zcc-data-table>

      <zcc-pagination-bar
        [page]="store.page()"
        [pageSize]="store.pageSize()"
        [total]="store.total()"
        (pageChange)="store.setPage($event)"
      />
    } @else {
      <zcc-empty-state
        icon="pi pi-database"
        title="No resources found"
        message="Try adjusting your search or create a new resource."
      />
    }
  `,
})
export class ResourcesListComponent {
  private readonly api = inject(IamApiService);

  readonly store = createListStore<ResourceListItem>({
    filterKeys: ['type'],
    loader: (query) =>
      firstValueFrom(this.api.listResources(query)).then(unwrap),
  });

  readonly filters = () => [
    { key: 'type', label: 'Type', options: TYPE_OPTIONS, allLabel: 'All types' },
  ];

  readonly selectedFilters = computed<Record<string, string>>((): Record<string, string> => {
    const t = this.store.filters()['type'];
    return t ? { type: String(t) } : {};
  });

  readonly columns = () =>
    [
      { key: 'name', label: 'Resource', width: '30%' },
      { key: 'type', label: 'Type' },
      { key: 'category', label: 'Category' },
      { key: 'actionCount', label: 'Actions' },
      { key: 'status', label: 'Status' },
    ] satisfies DataTableColumn[];

  onSearch(q: string): void {
    this.store.setQ(q);
  }

  onFiltersChange(next: Record<string, string>): void {
    const filters: Record<string, unknown> = {};
    if (next['type']) filters['type'] = next['type'];
    this.store.setFilters(filters);
  }

  onReset(): void {
    this.store.setFilters({});
    this.store.setQ('');
  }

  onRowClick(row: ResourceListItem): void {
    // Cell links handle navigation; here for future row-level actions.
    void row;
  }
}
