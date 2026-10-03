import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IamApiService, unwrap } from '../../../core/api/iam.api';
import { GroupListItem } from '../../../shared/models/iam.model';
import { createListStore } from '../../../shared/utils/create-list-store';
import {
  FilterBarComponent,
  StatusChipComponent,
  EmptyStateComponent,
} from '../../../shared/components/iam';
import {
  DataTableColumn,
  DataTableComponent,
  DataTableCellDirective,
} from '../../../shared/components/data-table';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

const TYPE_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Security', value: 'SECURITY' },
  { label: 'Organization', value: 'ORG' },
  { label: 'Distribution', value: 'DISTRIBUTION' },
  { label: 'Project', value: 'PROJECT' },
  { label: 'Dynamic', value: 'DYNAMIC' },
];

@Component({
  selector: 'zcc-groups-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    RouterLink,
    DataTableComponent,
    DataTableCellDirective,
    FilterBarComponent,
    PaginationComponent,
    StatusChipComponent,
    EmptyStateComponent,
  ],
  templateUrl: './groups-list.component.html',
  styleUrl: './groups-list.component.scss',
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

  readonly columns: DataTableColumn<unknown>[] = [
    { id: 'name', label: 'Group', width: '30%' },
    { id: 'type', label: 'Type' },
    { id: 'memberCount', label: 'Members' },
    { id: 'roleCount', label: 'Roles' },
    { id: 'status', label: 'Status' },
  ];

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
