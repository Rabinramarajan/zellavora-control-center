import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IamApiService, unwrap } from '@core/api/iam.api';
import { IamUserListItem } from '@shared/models/iam.model';
import { createListStore } from '@shared/utils/create-list-store';
import {
  DataTableComponent,
  DataTableColumn,
  FilterBarComponent,
  PaginationBarComponent,
  StatusChipComponent,
  EmptyStateComponent,
} from '@shared/components/iam';

const STATUS_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Inactive', value: 'INACTIVE' },
  { label: 'Locked', value: 'LOCKED' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Suspended', value: 'SUSPENDED' },
];

@Component({
  selector: 'zcc-users-list',
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
        <h1 class="text-xl font-bold text-gray-900 dark:text-white">Users</h1>
        <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          Directory of users with roles and group memberships.
        </p>
      </div>
      <a
        routerLink="/iam/users/new"
        class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-600"
      >
        <i class="pi pi-plus text-xs" aria-hidden="true"></i>
        New User
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
        title="Failed to load users"
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
        <ng-template #rowTpl let-u>
          <td class="px-4 py-3">
            <div class="flex items-center gap-3">
              <div
                class="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-sm font-semibold text-indigo-500"
              >
                {{ initials(u.fullName) }}
              </div>
              <div class="min-w-0">
                <a
                  [routerLink]="['/iam/users', u.id]"
                  class="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  (click)="$event.stopPropagation()"
                >
                  {{ u.fullName }}
                </a>
                <p class="truncate text-xs text-gray-400">{{ u.email }}</p>
              </div>
            </div>
          </td>
          <td class="px-4 py-3">
            <zcc-status-chip [value]="u.status" [label]="u.statusLabel" />
          </td>
          <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ u.department ?? '—' }}</td>
          <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ u.jobTitle ?? '—' }}</td>
          <td class="px-4 py-3 text-gray-600 dark:text-gray-300">
            <span class="tabular-nums">{{ u.roleCount }}</span>
          </td>
          <td class="px-4 py-3 text-gray-600 dark:text-gray-300">
            <span class="tabular-nums">{{ u.groupCount }}</span>
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
        icon="pi pi-users"
        title="No users found"
        message="Try adjusting your search or invite a new user."
      />
    }
  `,
})
export class UsersListComponent {
  private readonly api = inject(IamApiService);

  readonly store = createListStore<IamUserListItem>({
    filterKeys: ['status'],
    loader: (query) => firstValueFrom(this.api.listIamUsers(query)).then(unwrap),
  });

  readonly filters = () => [
    { key: 'status', label: 'Status', options: STATUS_OPTIONS, allLabel: 'All statuses' },
  ];

  readonly selectedFilters = computed<Record<string, string>>((): Record<string, string> => {
    const s = this.store.filters()['status'];
    return s ? { status: String(s) } : {};
  });

  readonly columns = () =>
    [
      { key: 'fullName', label: 'User', width: '32%' },
      { key: 'status', label: 'Status' },
      { key: 'department', label: 'Department' },
      { key: 'jobTitle', label: 'Title' },
      { key: 'roleCount', label: 'Roles' },
      { key: 'groupCount', label: 'Groups' },
    ] satisfies DataTableColumn[];

  initials(name: string): string {
    return name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  onSearch(q: string): void {
    this.store.setQ(q);
  }

  onFiltersChange(next: Record<string, string>): void {
    const filters: Record<string, unknown> = {};
    if (next['status']) filters['status'] = next['status'];
    this.store.setFilters(filters);
  }

  onReset(): void {
    this.store.setFilters({});
    this.store.setQ('');
  }

  onRowClick(_row: IamUserListItem): void {
    /* cell links navigate */
  }
}
