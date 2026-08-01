import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IamApiService, unwrap } from '@core/api/iam.api';
import { GroupListItem } from '@shared/models/iam.model';
import { createListStore } from '@shared/utils/create-list-store';
import {
  DataTableComponent,
  DataTableColumn,
  FilterBarComponent,
  PaginationBarComponent,
  StatusChipComponent,
  EmptyStateComponent,
} from '@shared/components/iam';

const TYPE_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Security', value: 'SECURITY' },
  { label: 'Organization', value: 'ORG' },
  { label: 'Distribution', value: 'DISTRIBUTION' },
  { label: 'Project', value: 'PROJECT' },
  { label: 'Dynamic', value: 'DYNAMIC' },
];

@Component({
  selector: 'zcc-groups-list',
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
        <h1 class="text-xl font-bold text-gray-900 dark:text-white">Groups</h1>
        <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          Users inherit roles through group membership and hierarchy.
        </p>
      </div>
      <a
        routerLink="/iam/groups/new"
        class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-600"
      >
        <i class="pi pi-plus text-xs" aria-hidden="true"></i>
        New Group
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
          <div class="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5"></div>
        }
      </div>
    } @else if (store.error()) {
      <zcc-empty-state
        icon="pi pi-exclamation-triangle"
        title="Failed to load groups"
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
              [routerLink]="['/iam/groups', r.id]"
              class="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              (click)="$event.stopPropagation()"
            >
              {{ r.name }}
            </a>
            @if (r.parentName) {
              <p class="text-xs text-gray-400">in {{ r.parentName }}</p>
            }
          </td>
          <td class="px-4 py-3">
            <zcc-status-chip [value]="r.type" [label]="r.typeLabel" />
          </td>
          <td class="px-4 py-3 text-gray-600 dark:text-gray-300">
            <span class="tabular-nums">{{ r.memberCount }}</span>
          </td>
          <td class="px-4 py-3 text-gray-600 dark:text-gray-300">
            <span class="tabular-nums">{{ r.roleCount }}</span>
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
        icon="pi pi-sitemap"
        title="No groups found"
        message="Try adjusting your search or create a new group."
      />
    }
  `,
})
export class GroupsListComponent {
  private readonly api = inject(IamApiService);

  readonly store = createListStore<GroupListItem>({
    filterKeys: ['type'],
    loader: (query) => firstValueFrom(this.api.listGroups(query)).then(unwrap),
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
      { key: 'name', label: 'Group', width: '30%' },
      { key: 'type', label: 'Type' },
      { key: 'memberCount', label: 'Members' },
      { key: 'roleCount', label: 'Roles' },
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

  onRowClick(_row: GroupListItem): void {
    /* cell links navigate */
  }
}
