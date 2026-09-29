import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Project, ProjectStatus } from '@shared/models';
import {
  ColumnDef,
  FilterState,
  SmartCellDirective,
  SmartEmptyDirective,
  SmartTableComponent,
  SortState,
} from '../../../../shared/components/smart-table';
import { ProjectsService } from '../../services/projects.service';

type StatusFilter = ProjectStatus | null;

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

const STATUS_TABS: readonly { label: string; value: StatusFilter }[] = [
  { label: 'All', value: null },
  { label: 'Published', value: ProjectStatus.PUBLISHED },
  { label: 'Drafts', value: ProjectStatus.DRAFT },
  { label: 'Archived', value: ProjectStatus.ARCHIVED },
];

const STATUS_BADGE: Record<ProjectStatus, string> = {
  [ProjectStatus.PUBLISHED]: 'bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200',
  [ProjectStatus.DRAFT]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-200',
  [ProjectStatus.ARCHIVED]: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
};

const PROJECT_COLUMNS: ColumnDef<Project>[] = [
  {
    key: 'title',
    header: 'Project',
    sortable: true,
    searchText: (row) => `${row.title} ${row.slug} ${row.description ?? ''}`,
  },
  {
    key: 'category',
    header: 'Category',
    sortable: true,
    format: (value) => (value ? String(value) : '—'),
    cellClass: 'text-slate-600 dark:text-slate-300',
  },
  { key: 'status', header: 'Status', sortable: true, width: '8rem' },
  {
    key: 'viewCount',
    header: 'Views',
    sortable: true,
    align: 'right',
    width: '6rem',
    format: (value) => String(value ?? 0),
    cellClass: 'tabular-nums text-slate-600 dark:text-slate-300',
  },
  {
    key: 'updatedAt',
    header: 'Updated',
    sortable: true,
    width: '9rem',
    value: (row) => (row.updatedAt ? new Date(row.updatedAt).getTime() : 0),
    format: (value) => (value ? dateFormat.format(Number(value)) : '—'),
    cellClass: 'text-slate-600 dark:text-slate-300 whitespace-nowrap',
  },
  { key: 'actions', header: 'Actions', align: 'right', width: '10rem', exportable: false },
];

@Component({
  selector: 'app-projects-list',
  standalone: true,
  imports: [RouterLink, SmartTableComponent, SmartCellDirective, SmartEmptyDirective],
  templateUrl: './projects-list.component.html',
  styleUrl: './projects-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsListComponent {
  public readonly projects = inject(ProjectsService);

  public readonly columns = PROJECT_COLUMNS;
  public readonly statusTabs = STATUS_TABS;
  public readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  public readonly sort = signal<SortState>({ key: 'updatedAt', direction: 'desc' });
  public readonly pageSize = signal(PAGE_SIZE_OPTIONS[0]);
  public readonly filters = signal<FilterState>({});

  /** Ids with a delete in flight, so their buttons stay disabled. */
  public readonly deleting = signal<ReadonlySet<string>>(new Set());

  public readonly activeStatus = computed<StatusFilter>(
    () => (this.filters()['status'] as ProjectStatus | undefined) || null
  );

  public readonly emptyMessage = computed(() => {
    const status = this.activeStatus();
    return status ? `No ${status} projects` : 'No projects yet';
  });

  public setStatus(status: StatusFilter): void {
    this.filters.set(status ? { status } : {});
  }

  public badgeClass(status: ProjectStatus): string {
    return STATUS_BADGE[status] ?? STATUS_BADGE[ProjectStatus.ARCHIVED];
  }

  public isDeleting(id: string): boolean {
    return this.deleting().has(id);
  }

  public async deleteProject(project: Project): Promise<void> {
    if (!confirm(`Delete "${project.title}"? This cannot be undone.`)) return;

    this.deleting.update((ids) => new Set(ids).add(project.id));
    try {
      await firstValueFrom(this.projects.deleteProject(project.id));
    } finally {
      this.deleting.update((ids) => {
        const next = new Set(ids);
        next.delete(project.id);
        return next;
      });
    }
  }
}
