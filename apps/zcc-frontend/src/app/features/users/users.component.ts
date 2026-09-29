import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { IamApiService, unwrap } from '@core/api/iam.api';
import { IamUserListItem, UserStatus } from '@shared/models/iam.model';
import { createListStore } from '@shared/utils/create-list-store';
import { CsvExporter } from '../../shared/utils/csv-exporter';

type SortKey = 'fullName' | 'email' | 'status' | 'department' | 'createdAt' | 'lastLoginDatetime';

interface UserFilters {
  q: string;
  name: string;
  email: string;
  mobile: string;
  department: string;
  roleId: string;
  groupId: string;
  status: string;
  createdFrom: string;
  createdTo: string;
  lastLoginFrom: string;
  lastLoginTo: string;
}

interface Option {
  value: string;
  label: string;
}

interface StatCard {
  label: string;
  icon: string;
  tone: 'violet' | 'emerald' | 'rose' | 'amber' | 'indigo';
  status: UserStatus | '';
}

const EMPTY_FILTERS: UserFilters = {
  q: '',
  name: '',
  email: '',
  mobile: '',
  department: '',
  roleId: '',
  groupId: '',
  status: '',
  createdFrom: '',
  createdTo: '',
  lastLoginFrom: '',
  lastLoginTo: '',
};

const FILTER_KEYS = Object.keys(EMPTY_FILTERS) as Array<keyof UserFilters>;

const STATUS_OPTIONS: Option[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'LOCKED', label: 'Locked' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

const STAT_CARDS: StatCard[] = [
  { label: 'Total Users', icon: 'pi pi-users', tone: 'violet', status: '' },
  { label: 'Active', icon: 'pi pi-user', tone: 'emerald', status: 'ACTIVE' },
  { label: 'Inactive', icon: 'pi pi-user-minus', tone: 'rose', status: 'INACTIVE' },
  { label: 'Pending Invites', icon: 'pi pi-envelope', tone: 'amber', status: 'PENDING' },
  { label: 'Locked', icon: 'pi pi-lock', tone: 'indigo', status: 'LOCKED' },
];

const AVATAR_TONES = ['#7c3aed', '#8b5cf6', '#a855f7', '#6366f1', '#db2777', '#c026d3'];

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [FormsModule, RouterLink, ToastModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEscape()', '(document:click)': 'openMenuId.set(null)' },
})
export class UsersComponent {
  private readonly api = inject(IamApiService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  readonly pageSizes = [10, 25, 50, 100];
  readonly statusOptions = STATUS_OPTIONS;
  readonly roleOptions = signal<Option[]>([]);
  readonly groupOptions = signal<Option[]>([]);

  readonly columns: Array<{ key: SortKey | null; label: string }> = [
    { key: null, label: 'User ID' },
    { key: 'fullName', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'department', label: 'Department' },
    { key: null, label: 'Title' },
    { key: null, label: 'Groups' },
    { key: null, label: 'Roles' },
    { key: 'status', label: 'Status' },
    { key: 'lastLoginDatetime', label: 'Last Login' },
    { key: 'createdAt', label: 'Created On' },
  ];

  readonly textFields: Array<{ key: keyof UserFilters; label: string; icon: string; placeholder: string; type: string; hint?: string }> = [
    { key: 'q', label: 'Keyword', icon: 'pi pi-search', placeholder: 'Name, email, username, title...', type: 'search', hint: 'Matches name, email, username, department or title' },
    { key: 'name', label: 'Name', icon: 'pi pi-user', placeholder: 'Enter name', type: 'text' },
    { key: 'email', label: 'Email', icon: 'pi pi-envelope', placeholder: 'Enter email', type: 'text' },
    { key: 'mobile', label: 'Mobile', icon: 'pi pi-phone', placeholder: 'Enter mobile number', type: 'tel' },
    { key: 'department', label: 'Department', icon: 'pi pi-building', placeholder: 'Exact department name', type: 'text' },
  ];

  readonly selectFields = computed<Array<{ key: keyof UserFilters; label: string; icon: string; all: string; options: Option[] }>>(() => [
    { key: 'roleId', label: 'Role', icon: 'pi pi-shield', all: 'All Roles', options: this.roleOptions() },
    { key: 'groupId', label: 'Group', icon: 'pi pi-sitemap', all: 'All Groups', options: this.groupOptions() },
    { key: 'status', label: 'Account Status', icon: 'pi pi-circle', all: 'All Status', options: STATUS_OPTIONS },
  ]);

  readonly dateRanges: Array<{ label: string; from: keyof UserFilters; to: keyof UserFilters }> = [
    { label: 'Created Date', from: 'createdFrom', to: 'createdTo' },
    { label: 'Last Login', from: 'lastLoginFrom', to: 'lastLoginTo' },
  ];

  readonly store = createListStore<IamUserListItem>({
    initialPageSize: 10,
    filterKeys: [...FILTER_KEYS.filter((k) => k !== 'q'), 'sort', 'order'],
    loader: (query) => firstValueFrom(this.api.listIamUsers(query)).then(unwrap),
  });

  readonly statCounts = signal<Record<string, number | null>>({});
  readonly stats = STAT_CARDS;

  readonly filtersOpen = signal(false);
  readonly draft = signal<UserFilters>({ ...EMPTY_FILTERS });
  readonly applied = signal<UserFilters>({ ...EMPTY_FILTERS });
  readonly sortKey = signal<SortKey>('createdAt');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly selected = signal<ReadonlySet<string>>(new Set());
  readonly openMenuId = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);

  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  readonly activeFilterCount = computed(() => {
    const f = this.applied();
    const ranges = [f.createdFrom || f.createdTo, f.lastLoginFrom || f.lastLoginTo].filter(Boolean).length;
    const plain = FILTER_KEYS.filter((k) => !this.dateRanges.some((r) => r.from === k || r.to === k) && f[k].trim()).length;
    return plain + ranges;
  });

  readonly rangeLabel = computed(() => {
    const total = this.store.total();
    if (!total) return 'Showing 0 users';
    const start = (this.store.page() - 1) * this.store.pageSize() + 1;
    const end = Math.min(start + this.store.items().length - 1, total);
    return `Showing ${start} - ${end} of ${total.toLocaleString()} users`;
  });

  readonly totalPages = computed(() => Math.max(1, this.store.totalPages()));

  readonly pageItems = computed<Array<number | '…'>>(() => {
    const total = this.totalPages();
    const cur = this.store.page();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (cur <= 4) return [1, 2, 3, 4, 5, '…', total];
    if (cur >= total - 3) return [1, '…', ...Array.from({ length: 5 }, (_, i) => total - 4 + i)];
    return [1, '…', cur - 1, cur, cur + 1, '…', total];
  });

  readonly allOnPageSelected = computed(() => {
    const rows = this.store.items();
    const sel = this.selected();
    return rows.length > 0 && rows.every((u) => sel.has(u.id));
  });

  readonly someOnPageSelected = computed(() => !this.allOnPageSelected() && this.store.items().some((u) => this.selected().has(u.id)));

  constructor() {
    void this.loadStats();
    void this.loadLookups();
  }

  onQuickSearch(value: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.store.setQ(value.trim()), 300);
  }

  openFilters(): void {
    this.draft.set({ ...this.applied(), q: this.store.q() });
    this.filtersOpen.set(true);
  }

  closeFilters(): void {
    this.filtersOpen.set(false);
  }

  patchDraft(key: keyof UserFilters, value: string): void {
    this.draft.update((d) => ({ ...d, [key]: value ?? '' }));
  }

  applyFilters(): void {
    const next = { ...this.draft() };
    this.applied.set(next);
    this.filtersOpen.set(false);
    this.pushFilters();
    if (next.q !== this.store.q()) this.store.setQ(next.q.trim());
  }

  resetDraft(): void {
    this.draft.set({ ...EMPTY_FILTERS });
  }

  resetAll(): void {
    this.draft.set({ ...EMPTY_FILTERS });
    this.applied.set({ ...EMPTY_FILTERS });
    this.selected.set(new Set());
    this.pushFilters();
    this.store.setQ('');
  }

  filterByStatus(status: UserStatus | ''): void {
    this.applied.update((f) => ({ ...f, status }));
    this.pushFilters();
  }

  onEscape(): void {
    if (this.filtersOpen()) this.closeFilters();
    this.openMenuId.set(null);
  }

  sortBy(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
    this.pushFilters();
  }

  ariaSort(key: SortKey | null): 'ascending' | 'descending' | null {
    if (!key) return null;
    return this.sortKey() !== key ? null : this.sortDir() === 'asc' ? 'ascending' : 'descending';
  }

  goToPage(p: number): void {
    const target = Math.min(Math.max(1, p), this.totalPages());
    if (target !== this.store.page()) this.store.setPage(target);
  }

  setPageSize(size: number): void {
    this.store.setPageSize(Number(size));
  }

  toggleRow(id: string): void {
    this.selected.update((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  togglePage(): void {
    const ids = this.store.items().map((u) => u.id);
    const clear = this.allOnPageSelected();
    this.selected.update((s) => {
      const next = new Set(s);
      ids.forEach((id) => (clear ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  toggleMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.openMenuId.update((cur) => (cur === id ? null : id));
  }

  viewUser(user: IamUserListItem): void {
    void this.router.navigate(['/iam/users', user.id]);
  }

  async toggleLock(user: IamUserListItem): Promise<void> {
    this.openMenuId.set(null);
    this.busyId.set(user.id);
    const locking = !user.isAccountLocked;
    try {
      await firstValueFrom(locking ? this.api.lockIamUser(user.id) : this.api.unlockIamUser(user.id));
      this.notify(locking ? 'warn' : 'success', locking ? 'Account locked' : 'Account unlocked', user.fullName);
      await Promise.all([this.store.reload(), this.loadStats()]);
    } catch (err) {
      this.notify('error', 'Action failed', this.errorMessage(err));
    } finally {
      this.busyId.set(null);
    }
  }

  async removeUser(user: IamUserListItem): Promise<void> {
    this.openMenuId.set(null);
    if (!confirm(`Remove ${user.fullName}? This cannot be undone.`)) return;
    this.busyId.set(user.id);
    try {
      await firstValueFrom(this.api.deleteIamUser(user.id));
      this.selected.update((s) => {
        const next = new Set(s);
        next.delete(user.id);
        return next;
      });
      this.notify('warn', 'User removed', `${user.fullName} has been removed`);
      await Promise.all([this.store.reload(), this.loadStats()]);
    } catch (err) {
      this.notify('error', 'Remove failed', this.errorMessage(err));
    } finally {
      this.busyId.set(null);
    }
  }

  exportUsers(): void {
    const sel = this.selected();
    const rows = sel.size ? this.store.items().filter((u) => sel.has(u.id)) : this.store.items();
    if (!rows.length) {
      this.notify('info', 'Nothing to export', 'No users on this page.');
      return;
    }
    CsvExporter.export(
      'users',
      ['User ID', 'Name', 'Email', 'Mobile', 'Department', 'Title', 'Role', 'Roles', 'Groups', 'Status', 'Last Login', 'Created On'],
      rows.map((u) => [
        u.id,
        u.fullName,
        u.email,
        u.mobile,
        u.department,
        u.jobTitle,
        u.primaryRole?.name,
        u.roleCount,
        u.groupCount,
        u.statusLabel,
        u.lastLoginDatetime ? this.formatDate(u.lastLoginDatetime) : 'Never',
        this.formatDate(u.createdAt),
      ]),
    );
    this.notify('success', 'Export complete', `${rows.length} users exported`);
  }

  shortId(user: IamUserListItem): string {
    return user.username ?? user.id.slice(0, 8).toUpperCase();
  }

  initials(name: string): string {
    return name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  avatarColor(user: IamUserListItem): string {
    return AVATAR_TONES[user.fullName.charCodeAt(0) % AVATAR_TONES.length];
  }

  roleTone(key: string | undefined): string {
    if (!key) return 'slate';
    if (key.includes('owner') || key.includes('super')) return 'violet';
    if (key.includes('admin')) return 'blue';
    if (key.includes('manager')) return 'amber';
    if (key.includes('editor') || key.includes('employee')) return 'emerald';
    return 'rose';
  }

  relativeTime(iso: string | null): string {
    if (!iso) return 'Never';
    const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    return this.formatDate(iso);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private pushFilters(): void {
    const f = this.applied();
    const filters: Record<string, string> = { sort: this.sortKey(), order: this.sortDir() };
    for (const key of FILTER_KEYS) {
      if (key !== 'q' && f[key]) filters[key] = f[key];
    }
    this.store.setFilters(filters);
  }

  private async loadStats(): Promise<void> {
    const results = await Promise.all(
      STAT_CARDS.map(async (card) => {
        try {
          const list = unwrap(
            await firstValueFrom(this.api.listIamUsers({ page: 1, pageSize: 1, status: card.status ? [card.status] : undefined })),
          );
          return [card.label, list.meta.total] as const;
        } catch {
          return [card.label, null] as const;
        }
      }),
    );
    this.statCounts.set(Object.fromEntries(results));
  }

  private async loadLookups(): Promise<void> {
    try {
      const [roles, groups] = await Promise.all([
        firstValueFrom(this.api.listRoles({ page: 1, pageSize: 100 })).then(unwrap),
        firstValueFrom(this.api.listGroups({ page: 1, pageSize: 100 })).then(unwrap),
      ]);
      this.roleOptions.set(roles.data.map((r) => ({ value: r.id, label: r.name })));
      this.groupOptions.set(groups.data.map((g) => ({ value: g.id, label: g.name })));
    } catch {
      this.notify('warn', 'Filters limited', 'Could not load roles and groups.');
    }
  }

  private errorMessage(err: unknown): string {
    const e = err as { error?: { error?: { message?: string } } };
    return e?.error?.error?.message ?? 'Please try again.';
  }

  private notify(severity: 'success' | 'info' | 'warn' | 'error', summary: string, detail: string): void {
    this.messages.add({ severity, summary, detail, life: 3000 });
  }
}
