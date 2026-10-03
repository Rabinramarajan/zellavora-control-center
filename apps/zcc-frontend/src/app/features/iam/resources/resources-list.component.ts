import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { RouterLink, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IamApiService, unwrap } from '../../../core/api/iam.api';
import { ResourceListItem } from '../../../shared/models/iam.model';
import { createListStore } from '../../../shared/utils/create-list-store';
import {
  FilterBarComponent,
  StatusChipComponent,
  EmptyStateComponent,
} from '../../../shared/components/iam';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import {
  DataTableColumn,
  DataTableComponent,
  DataTableCellDirective,
} from '../../../shared/components/data-table';
import { FormDialogService } from '../../../shared/components/form-dialog';
import { PermissionService } from '../../../core/rbac/services/permission.service';
import { IAM_BTN, IamPageHeaderComponent } from '../shared/iam-page-header.component';
import { IamDialogsService } from '../shared/iam-dialogs.service';
import {
  createResourceDialogConfig,
  toCreateResourceRequest,
  loadParentResourceOptions,
} from './resource-dialog.config';

@Component({
  selector: 'zcc-resources-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    RouterLink,
    IamPageHeaderComponent,
    DataTableComponent,
    DataTableCellDirective,
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
  private readonly router = inject(Router);
  private readonly formDialog = inject(FormDialogService);
  private readonly dialogs = inject(IamDialogsService);
  protected readonly canManage = inject(PermissionService).can('resources:manage');
  protected readonly btn = IAM_BTN;

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

  readonly columns: DataTableColumn<unknown>[] = [
    { id: 'name', label: 'Resource', width: '30%' },
    { id: 'type', label: 'Type' },
    { id: 'category', label: 'Category' },
    { id: 'actionCount', label: 'Actions' },
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

  onRowClick(row: ResourceListItem): void {
    // Cell links handle navigation; here for future row-level actions.
    void row;
  }

  protected async create(): Promise<void> {
    const parentOptions = await loadParentResourceOptions(this.dialogs);
    const created = await this.formDialog.open(
      createResourceDialogConfig(
        (values) =>
          firstValueFrom(this.api.createResource(toCreateResourceRequest(values))).then(unwrap),
        parentOptions
      )
    );
    if (created) {
      await this.router.navigate(['/iam/resources', created.id]);
    }
  }
}

const TYPE_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'API', value: 'API' },
  { label: 'Feature', value: 'FEATURE' },
  { label: 'Data', value: 'DATA' },
  { label: 'Menu', value: 'MENU' },
  { label: 'Report', value: 'REPORT' },
  { label: 'Integration', value: 'INTEGRATION' },
];
