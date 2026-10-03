import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SelectControl, SelectControlOption } from '@zellavoras/ui';
import { BlogApiService } from '../../core/api/blog.api';
import { PermissionService } from '../../core/rbac/services/permission.service';
import { BlogCategory, BlogPost, BlogStats } from '../../shared/models/blog.model';
import { createListStore } from '../../shared/utils/create-list-store';
import {
  DataTableActionsDirective,
  DataTableCellDirective,
  DataTableColumn,
  DataTableComponent,
  DataTableEmptyDirective,
  DataTableSort,
} from '../../shared/components/data-table';
import { PageChangeEvent } from '../../shared/components/pagination/pagination.component';
import { IamDialogsService } from '../iam/shared/iam-dialogs.service';
import { IamFeedbackService } from '../iam/shared/iam-feedback.service';
import { formatDate } from '../iam/shared/iam-format';
import { SparklineComponent } from './components/sparkline.component';
import {
  PERIOD_OPTIONS,
  STATUS_LABEL,
  STATUS_OPTIONS,
  categoryTone,
  compactNumber,
  initials,
} from './blog-ui';

type SortKey = 'title' | 'viewCount' | 'publishedAt' | 'createdAt';

interface Filters {
  q: string;
  category: string;
  status: string;
  period: string;
}

const EMPTY: Filters = { q: '', category: '', status: '', period: '' };
const SEARCH_DEBOUNCE_MS = 300;
const MENU_WIDTH = 210;

interface StatCard {
  key: string;
  label: string;
  value: string;
  hint: string;
  hintUp: boolean;
  icon: string;
  tone: string;
  color: string;
  series: number[];
}

interface OpenMenu {
  post: BlogPost;
  top: number;
  left: number;
}

@Component({
  selector: 'app-blog-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    RouterLink,
    SelectControl,
    SparklineComponent,
    DataTableComponent,
    DataTableCellDirective,
    DataTableActionsDirective,
    DataTableEmptyDirective,
  ],
  host: {
    '(document:click)': 'menu.set(null)',
    '(document:keydown.escape)': 'menu.set(null)',
    '(window:resize)': 'menu.set(null)',
  },
  templateUrl: './blog-list.component.html',
  styleUrl: './blog-list.component.scss',
})
export class BlogListComponent {
  private readonly api = inject(BlogApiService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(IamDialogsService);
  private readonly feedback = inject(IamFeedbackService);
  protected readonly canManage = inject(PermissionService).can('blog:manage');

  protected readonly categoryTone = categoryTone;
  protected readonly initials = initials;
  protected readonly date = formatDate;
  protected readonly statusOptions: SelectControlOption[] = STATUS_OPTIONS;
  protected readonly periodOptions: SelectControlOption[] = PERIOD_OPTIONS;
  protected readonly pageSizes = [6, 10, 25, 50];

  private readonly categories = signal<BlogCategory[]>([]);
  protected readonly categoryOptions = computed<SelectControlOption[]>(() => [
    { value: '', label: 'All Categories' },
    ...this.categories().map((c) => ({ value: c.name, label: `${c.name} (${c.count})` })),
  ]);

  private readonly stats = signal<BlogStats | null>(null);
  protected readonly statCards = computed<StatCard[]>(() => {
    const s = this.stats();
    if (!s) return [];
    const share = (n: number): string =>
      s.total ? `${Math.round((n / s.total) * 1000) / 10}% of total` : '—';
    return [
      {
        key: 'total',
        label: 'Total Posts',
        value: compactNumber(s.total),
        hint: `${s.createdThisMonth} this month`,
        hintUp: s.createdThisMonth > 0,
        icon: 'pi pi-file',
        tone: 'blue',
        color: '#3b82f6',
        series: s.trend.created,
      },
      {
        key: 'published',
        label: 'Published',
        value: compactNumber(s.published),
        hint: share(s.published),
        hintUp: false,
        icon: 'pi pi-check',
        tone: 'green',
        color: '#10b981',
        series: s.trend.published,
      },
      {
        key: 'drafts',
        label: 'Drafts',
        value: compactNumber(s.drafts),
        hint: s.scheduled ? `${share(s.drafts)} · ${s.scheduled} scheduled` : share(s.drafts),
        hintUp: false,
        icon: 'pi pi-file-edit',
        tone: 'amber',
        color: '#f59e0b',
        series: s.trend.drafts,
      },
      {
        key: 'views',
        label: 'Total Views',
        value: compactNumber(s.totalViews),
        hint: `${s.published} published post${s.published === 1 ? '' : 's'}`,
        hintUp: false,
        icon: 'pi pi-eye',
        tone: 'violet',
        color: '#8b5cf6',
        series: s.trend.views,
      },
    ];
  });

  protected readonly columns: DataTableColumn<BlogPost>[] = [
    { id: 'index', label: '#', cellClass: 'tabular-nums text-slate-400' },
    { id: 'title', label: 'Post Title', sortKey: 'title' },
    { id: 'category', label: 'Category' },
    { id: 'author', label: 'Author' },
    { id: 'status', label: 'Status' },
    { id: 'views', label: 'Views', sortKey: 'viewCount', cellClass: 'tabular-nums' },
    { id: 'publishedOn', label: 'Published On', sortKey: 'publishedAt' },
  ];

  protected readonly postId = (p: BlogPost): string => p.id;
  protected readonly postTitle = (p: BlogPost): string => p.title;

  protected readonly store = createListStore<BlogPost>({
    initialPageSize: 6,
    // The constructor's push() issues the first load with the default sort.
    autoLoad: false,
    filterKeys: ['q', 'category', 'status', 'period', 'sort', 'order'],
    loader: (query) => firstValueFrom(this.api.list(query)),
  });

  protected readonly filters = signal<Filters>({ ...EMPTY });
  protected readonly sort = signal<DataTableSort<SortKey>>({ key: 'createdAt', dir: 'desc' });
  protected readonly hasFilters = computed(() =>
    Object.values(this.filters()).some((v) => v.trim())
  );
  protected readonly busyId = signal<string | null>(null);
  protected readonly menu = signal<OpenMenu | null>(null);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  public constructor() {
    this.push();
    void this.loadMeta();
  }

  // ---------------------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------------------

  protected onSearch(value: string): void {
    this.filters.update((f) => ({ ...f, q: value }));
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.push(), SEARCH_DEBOUNCE_MS);
  }

  protected setFilter(key: Exclude<keyof Filters, 'q'>, value: string | null): void {
    this.filters.update((f) => ({ ...f, [key]: value ?? '' }));
    this.push();
  }

  protected clear(): void {
    this.filters.set({ ...EMPTY });
    this.push();
  }

  protected onSort(sort: DataTableSort | null): void {
    if (!sort) return;
    this.sort.set(sort as DataTableSort<SortKey>);
    this.push();
  }

  protected onPaginate({ page, pageSize }: PageChangeEvent): void {
    if (pageSize !== this.store.pageSize()) this.store.setPageSize(pageSize);
    else this.store.setPage(page);
  }

  protected label(status: string): string {
    return STATUS_LABEL[status as BlogPost['status']] ?? status;
  }

  protected rowNumber(post: BlogPost): number {
    const index = this.store.items().indexOf(post);
    return (this.store.page() - 1) * this.store.pageSize() + index + 1;
  }

  // ---------------------------------------------------------------------------
  // Row actions
  // ---------------------------------------------------------------------------

  protected toggleMenu(post: BlogPost, event: MouseEvent): void {
    event.stopPropagation();
    if (this.menu()?.post.id === post.id) {
      this.menu.set(null);
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const height = 176;
    const below = rect.bottom + 6 + height < window.innerHeight;
    this.menu.set({
      post,
      top: below ? rect.bottom + 6 : rect.top - height - 6,
      left: Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
    });
  }

  protected async remove(post: BlogPost): Promise<void> {
    const ok = await this.dialogs.confirm(
      `Delete “${post.title}”?`,
      post.status === 'PUBLISHED'
        ? 'This post is live. Deleting it removes it for every reader. This cannot be undone.'
        : 'This cannot be undone.',
      'Delete',
      true
    );
    if (!ok) return;
    await this.act(post, () => firstValueFrom(this.api.remove(post.id)), 'Post deleted.');
  }

  protected async togglePublish(post: BlogPost): Promise<void> {
    this.menu.set(null);
    const live = post.status === 'PUBLISHED' || post.status === 'SCHEDULED';
    await this.act(
      post,
      () => firstValueFrom(live ? this.api.unpublish(post.id) : this.api.publish(post.id)),
      live ? 'Moved back to drafts.' : 'Post published.'
    );
  }

  protected async duplicate(post: BlogPost): Promise<void> {
    this.menu.set(null);
    this.busyId.set(post.id);
    try {
      const copy = await firstValueFrom(this.api.duplicate(post.id));
      this.feedback.success('Draft copy created.');
      await this.router.navigate(['/blog', copy.id, 'edit']);
    } catch (err) {
      this.feedback.error(err);
    } finally {
      this.busyId.set(null);
    }
  }

  protected async copySlug(post: BlogPost): Promise<void> {
    this.menu.set(null);
    try {
      await navigator.clipboard.writeText(post.slug);
      this.feedback.success('Slug copied.');
    } catch {
      this.feedback.error(null, 'Clipboard access was blocked.');
    }
  }

  private async act(post: BlogPost, call: () => Promise<unknown>, success: string): Promise<void> {
    this.busyId.set(post.id);
    try {
      await call();
      this.feedback.success(success);
      await Promise.all([this.store.reload(), this.loadMeta()]);
    } catch (err) {
      this.feedback.error(err);
    } finally {
      this.busyId.set(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------------

  private push(): void {
    const f = this.filters();
    const next: Record<string, string> = { sort: this.sort().key, order: this.sort().dir };
    if (f.q.trim()) next['q'] = f.q.trim();
    if (f.category) next['category'] = f.category;
    if (f.status) next['status'] = f.status;
    if (f.period) next['period'] = f.period;
    this.store.setFilters(next);
  }

  private async loadMeta(): Promise<void> {
    const [stats, categories] = await Promise.allSettled([
      firstValueFrom(this.api.stats()),
      firstValueFrom(this.api.categories()),
    ]);
    if (stats.status === 'fulfilled') this.stats.set(stats.value);
    if (categories.status === 'fulfilled') this.categories.set(categories.value);
  }
}
