import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { RouterLink } from '@angular/router';
import { IamApiService, unwrap } from '../../../core/api/iam.api';
import { ResourceListItem } from '../../../shared/models/iam.model';
import { createListStore } from '../../../shared/utils/create-list-store';
import {
  DataTableComponent,
  DataTableColumn,
  FilterBarComponent,
  StatusChipComponent,
  EmptyStateComponent,
} from '../../../shared/components/iam';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    RouterLink,
    DataTableComponent,
    FilterBarComponent,
    PaginationComponent,
    StatusChipComponent,
    EmptyStateComponent,
  ],
  templateUrl: './resources-list.component.html',
  styleUrl: './resources-list.component.scss',
})
export class ResourcesListComponent {
  private readonly api = inject(IamApiService);

  readonly store = createListStore<ResourceListItem>({
    filterKeys: ['type'],
    loader: (query) => firstValueFrom(this.api.listResources(query)).then(unwrap),
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
