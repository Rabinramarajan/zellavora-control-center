import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, catchError, of } from 'rxjs';
import { FormInputControl, SelectControl, SelectControlOption } from '@zellavoras/ui';
import { CmsBuilderApiService } from '../../../core/api/cms-builder.api';
import { PermissionService } from '../../../core/rbac/services/permission.service';
import {
  CmsPageSummary,
  CmsPageStats,
  CmsPageStatus,
} from '../../../shared/models';
import {
  DataTableActionsDirective,
  DataTableCellDirective,
  DataTableColumn,
  DataTableComponent,
  DataTableEmptyDirective,
  DataTableSort,
} from '../../../shared/components/data-table';
import { PageChangeEvent } from '../../../shared/components/pagination/pagination.component';
import { IamDialogsService } from '../../iam/shared/iam-dialogs.service';
import { IamFeedbackService } from '../../iam/shared/iam-feedback.service';
import { formatDate } from '../../iam/shared/iam-format';
import { IAM_BTN, IamPageHeaderComponent } from '../../iam/shared/iam-page-header.component';
import { FilterChipOption, FilterChipsComponent } from '../../../shared/components/filter-chips';
import { PaginatedList } from '../../../shared/models/iam.model';
import { CmsCreatePageDialogComponent } from '../shared/cms-create-page-dialog.component';

// track/label helpers (must be class properties, not inline fns, for ChangeDetection.OnPush)

interface Filters {
  q: string;
  status: string;
  type: string;
}

const EMPTY: Filters = { q: '', status: '', type: '' };
const CHIP_STATUSES: CmsPageStatus[] = ['PUBLISHED', 'DRAFT', 'SCHEDULED', 'ARCHIVED'];
const MENU_WIDTH = 220;

interface OpenMenu {
  page: CmsPageSummary;
  top: number;
  left: number;
}

const STATUS_LABEL: Record<CmsPageStatus, string> = {
  DRAFT: 'Draft',
  IN_REVIEW: 'In Review',
  APPROVED: 'Approved',
  SCHEDULED: 'Scheduled',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

const STATUS_BADGE: Record<CmsPageStatus, string> = {
  DRAFT: 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300',
  IN_REVIEW: 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-400/20 dark:text-blue-300',
  APPROVED: 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-teal-100 text-teal-700 dark:bg-teal-400/20 dark:text-teal-300',
  SCHEDULED: 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300',
  PUBLISHED: 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300',
  ARCHIVED: 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-white/5 dark:text-zinc-400',
};

const TYPE_OPTIONS: SelectControlOption[] = [
  { value: '', label: 'All Types' },
  { value: 'STANDARD', label: 'Standard Page' },
  { value: 'LANDING', label: 'Landing Page' },
  { value: 'ARTICLE', label: 'Article' },
  { value: 'SYSTEM', label: 'System Page' },
  { value: 'CUSTOM', label: 'Custom Page' },
];

const STATUS_OPTIONS: SelectControlOption[] = [
  { value: '', label: 'All Statuses' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'ARCHIVED', label: 'Archived' },
];

@Component({
  selector: 'app-cms-page-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormInputControl,
    SelectControl,
    FilterChipsComponent,
    IamPageHeaderComponent,
    DataTableComponent,
    DataTableCellDirective,
    DataTableActionsDirective,
    DataTableEmptyDirective,
    CmsCreatePageDialogComponent,
  ],
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'menu.set(null); filtersOpen.set(false)',
    '(window:resize)': 'menu.set(null)',
  },
  templateUrl: './cms-page-list.component.html',
  styleUrl: './cms-page-list.component.scss',
})
export class CmsPageListComponent implements OnInit {
  private readonly api = inject(CmsBuilderApiService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(IamDialogsService);
  private readonly feedback = inject(IamFeedbackService);
  protected readonly canManage = inject(PermissionService).can('cms:manage');

  protected readonly btn = IAM_BTN;
  protected readonly typeOptions = TYPE_OPTIONS;
  protected readonly statusOptions = STATUS_OPTIONS;

  protected date(iso: string | null | undefined): string { return formatDate(iso); }
  protected label(status: string): string { return STATUS_LABEL[status as CmsPageStatus] ?? status; }
  protected badge(status: string): string { return STATUS_BADGE[status as CmsPageStatus] ?? ''; }

  // List state
  protected readonly items = signal<CmsPageSummary[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);

  // Stats
  protected readonly stats = signal<CmsPageStats | null>(null);

  // Filters
  protected readonly filtersOpen = signal(false);
  protected readonly draft = signal<Filters>({ ...EMPTY });
  protected readonly applied = signal<Filters>({ ...EMPTY });

  // Sorting
  protected readonly sort = signal<DataTableSort | null>({ key: 'updatedAt', dir: 'desc' });

  // Row menu
  protected readonly menu = signal<OpenMenu | null>(null);
  protected readonly menuWidth = MENU_WIDTH;

  // Dialogs
  protected readonly createOpen = signal(false);

  // Columns
  protected readonly columns: DataTableColumn<CmsPageSummary>[] = [
    { id: 'title', label: 'Page', sortKey: 'title' },
    { id: 'slug', label: 'Slug', sortKey: 'slug' },
    { id: 'status', label: 'Status', sortKey: 'status' },
    { id: 'updatedAt', label: 'Updated', sortKey: 'updatedAt' },
  ];

  // Filter chips
  protected readonly chipStatuses = CHIP_STATUSES;
  protected readonly chipOptions = computed<FilterChipOption<string>[]>(() => {
    const s = this.stats();
    return this.chipStatuses.map((status) => ({
      value: status,
      label: STATUS_LABEL[status],
      count: s ? (s[status.toLowerCase() as keyof CmsPageStats] as number) ?? 0 : undefined,
    }));
  });

  protected readonly activeChip = computed(() => this.applied().status);

  protected readonly trackId = (p: CmsPageSummary): string => p.id;
  protected readonly rowTitle = (p: CmsPageSummary): string => p.title;
  protected readonly activeFilterCount = computed(() => {
    const f = this.applied();
    return [f.q, f.status, f.type].filter(Boolean).length;
  });

  ngOnInit(): void {
    void this.load();
    void this.loadStats();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const f = this.applied();
      const s = this.sort();
      const result = await firstValueFrom(
        this.api.getPages({
          q: f.q,
          status: f.status,
          type: f.type,
          page: this.page(),
          pageSize: this.pageSize(),
          sortBy: s?.key ?? 'updatedAt',
          sortDir: s?.dir ?? 'desc',
        }).pipe(
          catchError(() =>
            of<PaginatedList<CmsPageSummary>>({
              data: MOCK_PAGES,
              meta: { total: MOCK_PAGES.length, page: 1, pageSize: 20, totalPages: 1 },
            } as unknown as PaginatedList<CmsPageSummary>)
          )
        )
      );
      // API may return PaginatedCmsPages or PaginatedList shape
      const data = (result as any).items ?? (result as any).data ?? [];
      const totalCount = (result as any).total ?? (result as any).meta?.total ?? 0;
      this.items.set(data);
      this.total.set(totalCount);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadStats(): Promise<void> {
    const s = await firstValueFrom(
      this.api.getStats().pipe(catchError(() => of(MOCK_STATS)))
    );
    this.stats.set(s);
  }

  protected patch(key: keyof Filters, value: string): void {
    this.draft.update((f) => ({ ...f, [key]: value }));
  }

  protected search(): void {
    this.applied.set({ ...this.draft() });
    this.page.set(1);
    this.filtersOpen.set(false);
    void this.load();
  }

  protected clearFilters(): void {
    this.draft.set({ ...EMPTY });
    this.applied.set({ ...EMPTY });
    this.page.set(1);
    void this.load();
  }

  protected toggleFilters(): void {
    this.filtersOpen.update((v) => !v);
  }

  protected setChip(status: string | null | undefined): void {
    const next = !status || this.applied().status === status ? '' : status;
    this.applied.update((f) => ({ ...f, status: next }));
    this.draft.update((f) => ({ ...f, status: next }));
    this.page.set(1);
    void this.load();
  }

  protected onSort(s: DataTableSort | null): void {
    this.sort.set(s);
    void this.load();
  }

  protected onPageChange(e: PageChangeEvent): void {
    this.page.set(e.page);
    void this.load();
  }

  protected openMenu(event: MouseEvent, page: CmsPageSummary): void {
    event.stopPropagation();
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    let left = rect.right + scrollX - MENU_WIDTH;
    if (left < 8) left = rect.left + scrollX;
    this.menu.set({ page, top: rect.bottom + scrollY + 4, left });
  }

  protected onDocumentClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target.closest('.cms-menu-popup')) this.menu.set(null);
    if (!target.closest('.filter-anchor')) this.filtersOpen.set(false);
  }

  protected openCreate(): void {
    this.createOpen.set(true);
  }

  protected async onPageCreated(pageId: string): Promise<void> {
    this.createOpen.set(false);
    await this.router.navigate(['/cms', pageId, 'builder']);
  }

  protected onCreateCancelled(): void {
    this.createOpen.set(false);
  }

  protected openBuilder(page: CmsPageSummary): void {
    void this.router.navigate(['/cms', page.id, 'builder']);
  }

  protected async publish(page: CmsPageSummary): Promise<void> {
    this.menu.set(null);
    const ok = await this.dialogs.confirm(
      'Publish page',
      `Publish "${page.title}" and make it live?`,
      'Publish'
    );
    if (!ok) return;
    try {
      await firstValueFrom(this.api.publishPage(page.id));
      this.feedback.success('Page published.');
      void this.load();
      void this.loadStats();
    } catch (err) {
      this.feedback.error(err, 'Failed to publish page.');
    }
  }

  protected async unpublish(page: CmsPageSummary): Promise<void> {
    this.menu.set(null);
    const ok = await this.dialogs.confirm(
      'Unpublish page',
      `Unpublish "${page.title}" and revert to draft?`,
      'Unpublish'
    );
    if (!ok) return;
    try {
      await firstValueFrom(this.api.unpublishPage(page.id));
      this.feedback.success('Page unpublished.');
      void this.load();
      void this.loadStats();
    } catch (err) {
      this.feedback.error(err, 'Failed to unpublish page.');
    }
  }

  protected async duplicate(page: CmsPageSummary): Promise<void> {
    this.menu.set(null);
    try {
      const copy = await firstValueFrom(this.api.duplicatePage(page.id));
      this.feedback.success('Page duplicated.');
      void this.load();
      void this.router.navigate(['/cms', copy.id, 'builder']);
    } catch (err) {
      this.feedback.error(err, 'Failed to duplicate page.');
    }
  }

  protected copySlug(page: CmsPageSummary): void {
    this.menu.set(null);
    void navigator.clipboard.writeText(page.slug);
    this.feedback.success('Slug copied to clipboard.');
  }

  protected async deletePage(page: CmsPageSummary): Promise<void> {
    this.menu.set(null);
    const ok = await this.dialogs.confirm(
      'Delete page',
      `Permanently delete "${page.title}"? This cannot be undone.`,
      'Delete',
      true
    );
    if (!ok) return;
    try {
      await firstValueFrom(this.api.deletePage(page.id));
      this.feedback.success('Page deleted.');
      void this.load();
      void this.loadStats();
    } catch (err) {
      this.feedback.error(err, 'Failed to delete page.');
    }
  }
}

// Dev mock fallback
const MOCK_PAGES: CmsPageSummary[] = [
  { id: '1', title: 'Home', slug: '/', status: 'PUBLISHED', type: 'STANDARD', updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
  { id: '2', title: 'About Us', slug: '/about', status: 'DRAFT', type: 'STANDARD', updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
  { id: '3', title: 'Contact', slug: '/contact', status: 'PUBLISHED', type: 'STANDARD', updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
  { id: '4', title: 'Privacy Policy', slug: '/privacy', status: 'SCHEDULED', type: 'SYSTEM', updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
];

const MOCK_STATS: CmsPageStats = {
  total: 4,
  published: 2,
  draft: 1,
  scheduled: 1,
  archived: 0,
};
