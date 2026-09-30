import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { DateControl, FormInputControl, SelectControl, SelectControlOption } from '@zellavoras/ui';
import {
  PageChangeEvent,
  PaginationComponent,
} from '@shared/components/pagination/pagination.component';
import { UserAdminApiService } from '@core/api/user-admin.api';
import { UserRequestsApiService } from '@core/api/user-requests.api';
import { PermissionService } from '@core/rbac/services/permission.service';
import { AccountStatus, IamUserListItem } from '@shared/models/iam.model';
import { UserRequestLookups } from '@shared/models/user-request.model';
import { createListStore } from '@shared/utils/create-list-store';
import { MultiSelectComponent, MultiSelectOption } from '../iam/shared/multi-select.component';
import { CsvExporter } from '../../shared/utils/csv-exporter';
import { ACTION_META, StateAction, UserActionsService, rowActions } from './user-actions';

type SortKey =
  'userNo' | 'fullName' | 'email' | 'employeeCode' | 'status' | 'createdAt' | 'lastLoginDatetime';
type TextKey =
  'q' | 'userId' | 'username' | 'firstName' | 'lastName' | 'employeeCode' | 'email' | 'mobile';
type ListKey =
  'status' | 'userType' | 'branchId' | 'departmentId' | 'teamId' | 'groupId' | 'roleId';
type ChoiceKey = 'emailVerified' | 'mfaEnabled';
type DateKey = 'createdFrom' | 'createdTo' | 'lastLoginFrom' | 'lastLoginTo';

type UserFilters = Record<TextKey | ChoiceKey | DateKey, string> & Record<ListKey, string[]>;

const EMPTY_FILTERS: UserFilters = {
  q: '',
  userId: '',
  username: '',
  firstName: '',
  lastName: '',
  employeeCode: '',
  email: '',
  mobile: '',
  status: [],
  userType: [],
  branchId: [],
  departmentId: [],
  teamId: [],
  groupId: [],
  roleId: [],
  emailVerified: '',
  mfaEnabled: '',
  createdFrom: '',
  createdTo: '',
  lastLoginFrom: '',
  lastLoginTo: '',
};

const FILTER_KEYS = Object.keys(EMPTY_FILTERS) as Array<keyof UserFilters>;
const clone = (f: UserFilters): UserFilters => structuredClone(f);

const STATUS_OPTIONS: MultiSelectOption[] = [
  { value: 'INVITED', label: 'Invited' },
  { value: 'PENDING_VERIFICATION', label: 'Pending Verification' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'LOCKED', label: 'Locked' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'DISABLED', label: 'Disabled' },
];

const USER_TYPE_OPTIONS: MultiSelectOption[] = [
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'CONTRACTOR', label: 'Contractor' },
  { value: 'EXTERNAL', label: 'External' },
];

interface StatCard {
  label: string;
  icon: string;
  tone: 'violet' | 'emerald' | 'rose' | 'amber' | 'indigo';
  status: AccountStatus | '';
}

const STAT_CARDS: StatCard[] = [
  { label: 'Total Users', icon: 'pi pi-users', tone: 'violet', status: '' },
  { label: 'Active', icon: 'pi pi-user', tone: 'emerald', status: 'ACTIVE' },
  { label: 'Invited', icon: 'pi pi-envelope', tone: 'amber', status: 'INVITED' },
  { label: 'Locked', icon: 'pi pi-lock', tone: 'indigo', status: 'LOCKED' },
  { label: 'Inactive', icon: 'pi pi-user-minus', tone: 'rose', status: 'INACTIVE' },
  { label: 'Disabled', icon: 'pi pi-ban', tone: 'rose', status: 'DISABLED' },
];

const AVATAR_TONES = ['#7c3aed', '#8b5cf6', '#a855f7', '#6366f1', '#db2777', '#c026d3'];

interface MenuItem {
  key: string;
  label: string;
  icon: string;
  danger?: boolean;
  run: () => void;
}

interface OpenMenu {
  user: IamUserListItem;
  items: MenuItem[];
  top: number;
  left: number;
  /** Opened above the trigger because there was no room below. */
  above: boolean;
  trigger: HTMLElement;
}

const MENU_WIDTH = 232;
const MENU_ITEM_HEIGHT = 40;
const MENU_CHROME = 44;
const VIEWPORT_GAP = 8;
const NAV_KEYS = ['view', 'edit', 'groups', 'roles', 'audit'];

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    ToastModule,
    FormInputControl,
    SelectControl,
    DateControl,
    MultiSelectComponent,
    PaginationComponent,
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscape()',
    '(document:click)': 'closeMenu()',
    '(window:resize)': 'closeMenu()',
    '(window:scroll)': 'closeMenu()',
  },
})
export class UsersComponent {
  private readonly api = inject(UserAdminApiService);
  private readonly requestsApi = inject(UserRequestsApiService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly actions = inject(UserActionsService);
  protected readonly canManage = inject(PermissionService).can('users:manage');

  readonly pageSizes = [10, 25, 50, 100];
  readonly statusOptions = STATUS_OPTIONS;
  readonly userTypeOptions = USER_TYPE_OPTIONS;
  readonly verifiedOptions: SelectControlOption[] = [
    { value: '', label: 'Any' },
    { value: 'true', label: 'Verified' },
    { value: 'false', label: 'Unverified' },
  ];
  readonly mfaOptions: SelectControlOption[] = [
    { value: '', label: 'Any' },
    { value: 'true', label: 'Enabled' },
    { value: 'false', label: 'Disabled' },
  ];

  private readonly lookups = signal<UserRequestLookups | null>(null);
  readonly branchOptions = computed(() => this.toOptions(this.lookups()?.branches));
  readonly departmentOptions = computed(() => this.toOptions(this.lookups()?.departments));
  readonly teamOptions = computed(() => this.toOptions(this.lookups()?.teams));
  readonly groupOptions = computed(() => this.toOptions(this.lookups()?.groups));
  readonly roleOptions = computed(() => this.toOptions(this.lookups()?.roles));

  readonly columns: Array<{ key: SortKey | null; label: string; wide?: boolean }> = [
    { key: 'userNo', label: 'User ID' },
    { key: 'fullName', label: 'Name' },
    { key: 'employeeCode', label: 'Employee Code' },
    { key: 'email', label: 'Email' },
    { key: null, label: 'Branch' },
    { key: null, label: 'Team', wide: true },
    { key: null, label: 'Group', wide: true },
    { key: null, label: 'Role' },
    { key: 'status', label: 'Status' },
    { key: 'lastLoginDatetime', label: 'Last Login' },
  ];

  readonly identityFields: Array<{
    key: TextKey;
    label: string;
    icon: 'search' | 'user' | 'email' | 'phone' | 'list';
    type: 'text' | 'tel';
    placeholder: string;
  }> = [
    { key: 'userId', label: 'User ID', icon: 'search', type: 'text', placeholder: 'USR000236' },
    { key: 'username', label: 'Username', icon: 'user', type: 'text', placeholder: 'eric.parker' },
    {
      key: 'firstName',
      label: 'First Name',
      icon: 'user',
      type: 'text',
      placeholder: 'First name',
    },
    { key: 'lastName', label: 'Last Name', icon: 'user', type: 'text', placeholder: 'Last name' },
    {
      key: 'employeeCode',
      label: 'Employee Code',
      icon: 'list',
      type: 'text',
      placeholder: 'EMP00236',
    },
    {
      key: 'email',
      label: 'Email ID',
      icon: 'email',
      type: 'text',
      placeholder: 'name@company.com',
    },
    {
      key: 'mobile',
      label: 'Contact Number',
      icon: 'phone',
      type: 'tel',
      placeholder: 'Digits only',
    },
  ];

  readonly accessFields = computed<
    Array<{ key: ListKey; label: string; options: MultiSelectOption[] }>
  >(() => [
    { key: 'status', label: 'Account Status', options: STATUS_OPTIONS },
    { key: 'userType', label: 'User Type', options: USER_TYPE_OPTIONS },
    { key: 'branchId', label: 'Branch', options: this.branchOptions() },
    { key: 'departmentId', label: 'Department', options: this.departmentOptions() },
    { key: 'teamId', label: 'Team', options: this.teamOptions() },
    { key: 'groupId', label: 'Group', options: this.groupOptions() },
    { key: 'roleId', label: 'Role', options: this.roleOptions() },
  ]);

  readonly dateRanges: Array<{ label: string; from: DateKey; to: DateKey }> = [
    { label: 'Created', from: 'createdFrom', to: 'createdTo' },
    { label: 'Last Login', from: 'lastLoginFrom', to: 'lastLoginTo' },
  ];

  readonly store = createListStore<IamUserListItem>({
    initialPageSize: 10,
    filterKeys: [...FILTER_KEYS, 'sort', 'order'],
    loader: (query) => firstValueFrom(this.api.search(query)),
  });

  readonly statCounts = signal<Record<string, number | null>>({});
  readonly stats = STAT_CARDS;

  readonly filtersOpen = signal(false);
  readonly draft = signal<UserFilters>(clone(EMPTY_FILTERS));
  readonly applied = signal<UserFilters>(clone(EMPTY_FILTERS));
  readonly search = signal('');
  readonly sortKey = signal<SortKey>('createdAt');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly selected = signal<ReadonlySet<string>>(new Set());
  readonly busyId = signal<string | null>(null);
  readonly menu = signal<OpenMenu | null>(null);
  readonly menuFor = computed(() => this.menu()?.user.id ?? null);

  /** Filters behind "More Filters" that are currently applied. */
  readonly moreFilterCount = computed(() => {
    const f = this.applied();
    const quick = new Set<keyof UserFilters>(['q', 'status', 'roleId', 'groupId', 'branchId']);
    const ranges = this.dateRanges.filter((r) => f[r.from] || f[r.to]).length;
    const rest = FILTER_KEYS.filter(
      (k) =>
        !quick.has(k) &&
        !this.dateRanges.some((r) => r.from === k || r.to === k) &&
        this.isSet(f[k])
    ).length;
    return rest + ranges;
  });

  readonly activeChips = computed(() => {
    const f = this.applied();
    const chips: Array<{ label: string; value: string; keys: Array<keyof UserFilters> }> = [];
    if (f.q) chips.push({ label: 'Search', value: f.q, keys: ['q'] });
    for (const field of this.identityFields) {
      if (f[field.key]) chips.push({ label: field.label, value: f[field.key], keys: [field.key] });
    }
    for (const field of this.accessFields()) {
      const values = f[field.key];
      if (values.length) {
        const labels = values.map((v) => field.options.find((o) => o.value === v)?.label ?? v);
        chips.push({ label: field.label, value: labels.join(', '), keys: [field.key] });
      }
    }
    if (f.emailVerified) {
      chips.push({
        label: 'Email',
        value: f.emailVerified === 'true' ? 'Verified' : 'Unverified',
        keys: ['emailVerified'],
      });
    }
    if (f.mfaEnabled) {
      chips.push({
        label: 'MFA',
        value: f.mfaEnabled === 'true' ? 'Enabled' : 'Disabled',
        keys: ['mfaEnabled'],
      });
    }
    for (const range of this.dateRanges) {
      if (f[range.from] || f[range.to]) {
        chips.push({
          label: range.label,
          value: `${f[range.from] || '…'} → ${f[range.to] || '…'}`,
          keys: [range.from, range.to],
        });
      }
    }
    return chips;
  });

  readonly allOnPageSelected = computed(() => {
    const rows = this.store.items();
    const sel = this.selected();
    return rows.length > 0 && rows.every((u) => sel.has(u.id));
  });

  readonly someOnPageSelected = computed(
    () => !this.allOnPageSelected() && this.store.items().some((u) => this.selected().has(u.id))
  );

  constructor() {
    void this.loadStats();
    firstValueFrom(this.requestsApi.lookups())
      .then((l) => this.lookups.set(l))
      .catch(() =>
        this.notify('warn', 'Filters limited', 'Could not load branches, groups and roles.')
      );
  }

  // ---------------------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------------------

  runSearch(): void {
    this.applied.update((f) => ({ ...f, q: this.search().trim() }));
    this.pushFilters();
  }

  setQuick(key: ListKey, values: string[]): void {
    this.applied.update((f) => ({ ...f, [key]: values }));
    this.pushFilters();
  }

  removeChip(keys: Array<keyof UserFilters>): void {
    if (keys.includes('q')) this.search.set('');
    this.applied.update((f) => {
      const next = clone(f);
      for (const key of keys) (next as Record<string, unknown>)[key] = clone(EMPTY_FILTERS)[key];
      return next;
    });
    this.pushFilters();
  }

  openFilters(): void {
    this.draft.set(clone(this.applied()));
    this.filtersOpen.set(true);
  }

  closeFilters(): void {
    this.filtersOpen.set(false);
  }

  patchDraft(key: keyof UserFilters, value: string | string[]): void {
    this.draft.update((d) => ({ ...d, [key]: value ?? '' }));
  }

  draftList(key: ListKey): string[] {
    return this.draft()[key];
  }

  draftText(key: TextKey | ChoiceKey | DateKey): string {
    return this.draft()[key];
  }

  applyFilters(): void {
    const next = clone(this.draft());
    this.applied.set(next);
    this.search.set(next.q);
    this.filtersOpen.set(false);
    this.pushFilters();
  }

  resetDraft(): void {
    this.draft.set(clone(EMPTY_FILTERS));
  }

  resetAll(): void {
    this.draft.set(clone(EMPTY_FILTERS));
    this.applied.set(clone(EMPTY_FILTERS));
    this.search.set('');
    this.selected.set(new Set());
    this.pushFilters();
  }

  filterByStatus(status: AccountStatus | ''): void {
    this.applied.update((f) => ({ ...f, status: status ? [status] : [] }));
    this.pushFilters();
  }

  isStatusCard(status: AccountStatus | ''): boolean {
    const current = this.applied().status;
    return status ? current.length === 1 && current[0] === status : current.length === 0;
  }

  onEscape(): void {
    if (this.menu()) this.closeMenu(true);
    else if (this.filtersOpen()) this.closeFilters();
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

  onPaginate({ page, pageSize }: PageChangeEvent): void {
    if (pageSize !== this.store.pageSize()) this.store.setPageSize(pageSize);
    else this.store.setPage(page);
  }

  // ---------------------------------------------------------------------------
  // Selection & export
  // ---------------------------------------------------------------------------

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

  exportUsers(): void {
    const sel = this.selected();
    const rows = sel.size ? this.store.items().filter((u) => sel.has(u.id)) : this.store.items();
    if (!rows.length) {
      this.notify('info', 'Nothing to export', 'No users on this page.');
      return;
    }
    CsvExporter.export(
      'users',
      [
        'User ID',
        'Name',
        'Employee Code',
        'Email',
        'Branch',
        'Team',
        'Group',
        'Role',
        'Status',
        'Last Login',
      ],
      rows.map((u) => [
        u.userCode ?? u.id,
        u.fullName,
        u.employeeCode,
        u.email,
        u.branchName,
        u.teamName,
        u.primaryGroup,
        u.primaryRole?.name,
        u.statusLabel,
        u.lastLoginDatetime ? this.formatDateTime(u.lastLoginDatetime) : 'Never',
      ])
    );
    this.notify('success', 'Export complete', `${rows.length} users exported`);
  }

  // ---------------------------------------------------------------------------
  // Row actions
  // ---------------------------------------------------------------------------

  /**
   * The menu is rendered once, outside the scrolling table, with fixed
   * positioning, so neither the scroll container nor the animated rows can clip
   * or cover it. It opens below the trigger and flips above when there is no room.
   */
  toggleMenu(user: IamUserListItem, event: MouseEvent): void {
    event.stopPropagation();
    if (this.menuFor() === user.id) {
      this.closeMenu();
      return;
    }
    const trigger = event.currentTarget as HTMLElement;
    const rect = trigger.getBoundingClientRect();
    const items = this.menuItems(user);
    const dividers = new Set(items.map((i) => this.groupOf(i))).size - 1;
    const height = items.length * MENU_ITEM_HEIGHT + MENU_CHROME + dividers * 9;
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_GAP;
    const spaceAbove = rect.top - VIEWPORT_GAP;
    const above = spaceBelow < height && spaceAbove > spaceBelow;
    const top = above
      ? rect.top - height - 6
      : Math.min(rect.bottom + 6, window.innerHeight - height - VIEWPORT_GAP);
    const left = Math.min(
      Math.max(VIEWPORT_GAP, rect.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - VIEWPORT_GAP
    );
    this.menu.set({ user, items, top: Math.max(VIEWPORT_GAP, top), left, above, trigger });
    queueMicrotask(() => this.focusMenuItem(0));
  }

  closeMenu(restoreFocus = false): void {
    const open = this.menu();
    if (!open) return;
    this.menu.set(null);
    if (restoreFocus) open.trigger.focus();
  }

  selectMenuItem(item: MenuItem): void {
    this.closeMenu();
    item.run();
  }

  /** Arrow keys, Home and End move through the items; Tab closes the menu. */
  onMenuKeydown(event: KeyboardEvent): void {
    const buttons = this.menuButtons();
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const target: Record<string, number> = {
      ArrowDown: index + 1,
      ArrowUp: index - 1,
      Home: 0,
      End: buttons.length - 1,
    };
    if (event.key in target) {
      event.preventDefault();
      this.focusMenuItem((target[event.key] + buttons.length) % buttons.length);
    } else if (event.key === 'Tab') {
      this.closeMenu(true);
    }
  }

  /** Items are grouped: navigation, state actions, then destructive actions. */
  groupOf(item: MenuItem): number {
    if (item.danger) return 2;
    return NAV_KEYS.includes(item.key) ? 0 : 1;
  }

  private menuButtons(): HTMLButtonElement[] {
    return Array.from(document.querySelectorAll<HTMLButtonElement>('.us-menu [role="menuitem"]'));
  }

  private focusMenuItem(index: number): void {
    this.menuButtons()[index]?.focus();
  }

  menuItems(user: IamUserListItem): MenuItem[] {
    const go =
      (section: string, extra: Record<string, string> = {}) =>
      () =>
        void this.router.navigate(['/iam/users', user.id], { queryParams: { section, ...extra } });
    const allowed = rowActions(user, this.canManage());
    const items: MenuItem[] = [
      { key: 'view', label: 'View Details', icon: 'pi pi-eye', run: go('overview') },
    ];
    if (allowed.includes('edit'))
      items.push({ key: 'edit', ...ACTION_META.edit, run: go('personal', { edit: '1' }) });
    if (allowed.includes('manageAccess')) {
      items.push({ key: 'groups', label: 'Manage Groups', icon: 'pi pi-users', run: go('groups') });
      items.push({ key: 'roles', label: 'Manage Roles', icon: 'pi pi-key', run: go('roles') });
    }
    for (const action of allowed.filter(
      (a): a is StateAction => a !== 'edit' && a !== 'manageAccess'
    )) {
      items.push({
        key: action,
        ...ACTION_META[action],
        run: () => void this.runAction(action, user),
      });
    }
    items.push({ key: 'audit', label: 'View Audit', icon: 'pi pi-shield', run: go('audit') });
    return items.sort((a, b) => this.groupOf(a) - this.groupOf(b));
  }

  async runAction(action: StateAction, user: IamUserListItem): Promise<void> {
    this.busyId.set(user.id);
    try {
      if (await this.actions.run(action, user)) {
        await Promise.all([this.store.reload(), this.loadStats()]);
      }
    } finally {
      this.busyId.set(null);
    }
  }

  addUser(): void {
    void this.router.navigate(['/iam/user-requests/create'], { queryParams: { type: 'NEW_USER' } });
  }

  // ---------------------------------------------------------------------------
  // Display helpers
  // ---------------------------------------------------------------------------

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

  formatDateTime(iso: string | null): string {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  private isSet(value: string | string[]): boolean {
    return Array.isArray(value) ? value.length > 0 : !!value.trim();
  }

  private toOptions(items: Array<{ id: string; name: string }> | undefined): MultiSelectOption[] {
    return (items ?? []).map((i) => ({ value: i.id, label: i.name }));
  }

  private pushFilters(): void {
    const f = this.applied();
    const filters: Record<string, string | string[]> = {
      sort: this.sortKey(),
      order: this.sortDir(),
    };
    for (const key of FILTER_KEYS) {
      if (this.isSet(f[key])) filters[key] = f[key];
    }
    this.store.setFilters(filters);
  }

  private async loadStats(): Promise<void> {
    try {
      const { total, byStatus } = await firstValueFrom(this.api.stats());
      this.statCounts.set(
        Object.fromEntries(
          STAT_CARDS.map((c) => [c.label, c.status ? (byStatus[c.status] ?? 0) : total])
        )
      );
    } catch {
      this.statCounts.set(Object.fromEntries(STAT_CARDS.map((c) => [c.label, null])));
    }
  }

  private notify(
    severity: 'success' | 'info' | 'warn' | 'error',
    summary: string,
    detail: string
  ): void {
    this.messages.add({ severity, summary, detail, life: 3000 });
  }
}
