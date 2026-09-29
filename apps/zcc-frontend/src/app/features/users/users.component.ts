import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CsvExporter } from '../../shared/utils/csv-exporter';

type UserRole = 'Super Admin' | 'Admin' | 'Manager' | 'Editor' | 'Viewer';
type UserStatus = 'Online' | 'Offline';

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  branch: string;
  status: UserStatus;
  lastLogin: Date;
  joined: Date;
}

interface StatCard {
  label: string;
  value: number;
  caption: string;
  captionTone: 'up' | 'muted';
  icon: string;
  accent: 'violet' | 'emerald' | 'amber' | 'fuchsia' | 'blue';
  chart: 'bars' | 'line';
  path: string;
}

const ROLES: UserRole[] = ['Super Admin', 'Admin', 'Manager', 'Editor', 'Viewer'];
const BRANCHES = [
  'Head Office',
  'Chennai Branch',
  'Bangalore Branch',
  'Hyderabad Branch',
  'Coimbatore Branch',
  'Pune Branch',
];

const ROLE_META: Record<UserRole, { icon: string; tone: string }> = {
  'Super Admin': { icon: 'pi pi-crown', tone: 'violet' },
  Admin: { icon: 'pi pi-home', tone: 'blue' },
  Manager: { icon: 'pi pi-star-fill', tone: 'amber' },
  Editor: { icon: 'pi pi-pencil', tone: 'emerald' },
  Viewer: { icon: 'pi pi-heart', tone: 'rose' },
};

const AVATAR_GRADIENTS = [
  'from-indigo-500 to-violet-600',
  'from-violet-500 to-fuchsia-600',
  'from-purple-500 to-indigo-600',
  'from-fuchsia-500 to-purple-600',
];

const NOW = new Date(2025, 4, 24, 12, 30);

function seedUsers(): ManagedUser[] {
  const featured: Array<[string, string, UserRole, string, UserStatus, Date, Date]> = [
    ['Rabin R', 'rabin', 'Super Admin', 'Head Office', 'Online', new Date(2025, 4, 24, 10, 30), new Date(2025, 0, 10)],
    ['Ananya S', 'ananya', 'Admin', 'Head Office', 'Online', new Date(2025, 4, 24, 9, 15), new Date(2025, 1, 18)],
    ['Karthik P', 'karthik', 'Manager', 'Chennai Branch', 'Online', new Date(2025, 4, 23, 18, 45), new Date(2025, 2, 2)],
    ['Meera R', 'meera', 'Editor', 'Bangalore Branch', 'Online', new Date(2025, 4, 24, 12, 10), new Date(2025, 3, 11)],
    ['Vikram T', 'vikram', 'Viewer', 'Hyderabad Branch', 'Offline', new Date(2025, 4, 19, 11, 20), new Date(2025, 3, 30)],
    ['Divya L', 'divya', 'Editor', 'Coimbatore Branch', 'Online', new Date(2025, 4, 24, 8, 40), new Date(2025, 4, 5)],
    ['Arun Kumar', 'arun', 'Manager', 'Pune Branch', 'Offline', new Date(2025, 4, 19, 15, 30), new Date(2025, 0, 25)],
    ['Sneha M', 'sneha', 'Viewer', 'Head Office', 'Offline', new Date(2025, 4, 17, 10, 0), new Date(2025, 1, 15)],
  ];
  const firstNames = ['Priya', 'Rahul', 'Nisha', 'Suresh', 'Kavya', 'Manoj', 'Lakshmi', 'Deepak', 'Asha', 'Ganesh', 'Revathi', 'Harish'];
  const initials = 'ABCDEGHJKLMNPRSTV';
  // Weighted so the generated roster mirrors a realistic role distribution.
  const roleCycle: UserRole[] = ['Viewer', 'Viewer', 'Viewer', 'Editor', 'Viewer', 'Manager', 'Viewer', 'Editor', 'Admin'];

  const users: ManagedUser[] = featured.map(([name, handle, role, branch, status, lastLogin, joined], i) => ({
    id: String(i + 1),
    name,
    email: `${handle}@zellavora.com`,
    role,
    branch,
    status,
    lastLogin,
    joined,
  }));

  for (let i = users.length; i < 128; i++) {
    const first = firstNames[i % firstNames.length];
    const initial = initials[(i * 7) % initials.length];
    const role: UserRole = i % 40 === 0 ? 'Super Admin' : roleCycle[i % roleCycle.length];
    users.push({
      id: String(i + 1),
      name: `${first} ${initial}`,
      email: `${first.toLowerCase()}.${initial.toLowerCase()}${i}@zellavora.com`,
      role,
      branch: BRANCHES[(i * 5) % BRANCHES.length],
      status: i % 4 === 0 ? 'Offline' : 'Online',
      lastLogin: new Date(NOW.getTime() - ((i * 37) % 96) * 3_600_000 - (i % 60) * 60_000),
      joined: new Date(2024, 6 + (i % 11), 1 + ((i * 3) % 27)),
    });
  }
  return users;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [FormsModule, ToastModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersComponent {
  private readonly messages = inject(MessageService);

  readonly roles = ROLES;
  readonly branches = BRANCHES;
  readonly pageSizes = [8, 16, 32, 64];

  readonly users = signal<ManagedUser[]>(seedUsers());

  readonly searchDraft = signal('');
  readonly roleDraft = signal('');
  readonly statusDraft = signal('');
  readonly branchDraft = signal('');
  readonly joinedFrom = signal('');
  readonly joinedTo = signal('');
  readonly dateRangeOpen = signal(false);

  private readonly applied = signal({ search: '', role: '', status: '', branch: '', from: '', to: '' });

  readonly page = signal(1);
  readonly pageSize = signal(8);
  readonly selected = signal<ReadonlySet<string>>(new Set());
  readonly openMenuId = signal<string | null>(null);

  readonly dateRangeLabel = computed(() => {
    const from = this.joinedFrom();
    const to = this.joinedTo();
    if (!from && !to) return 'Select date range';
    const fmt = (v: string) => (v ? this.formatDate(new Date(v)) : '…');
    return `${fmt(from)} – ${fmt(to)}`;
  });

  readonly filteredUsers = computed(() => {
    const f = this.applied();
    const term = f.search.trim().toLowerCase();
    const from = f.from ? new Date(f.from).getTime() : -Infinity;
    const to = f.to ? new Date(f.to).getTime() + 86_399_999 : Infinity;
    return this.users().filter(
      (u) =>
        (!term ||
          u.name.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term) ||
          u.role.toLowerCase().includes(term)) &&
        (!f.role || u.role === f.role) &&
        (!f.status || u.status === f.status) &&
        (!f.branch || u.branch === f.branch) &&
        u.joined.getTime() >= from &&
        u.joined.getTime() <= to,
    );
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredUsers().length / this.pageSize())));

  readonly pagedUsers = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.filteredUsers().slice(start, start + this.pageSize());
  });

  readonly rangeStart = computed(() => (this.filteredUsers().length ? (this.page() - 1) * this.pageSize() + 1 : 0));
  readonly rangeEnd = computed(() => Math.min(this.page() * this.pageSize(), this.filteredUsers().length));

  readonly pageItems = computed<Array<number | 'gap'>>(() => {
    const total = this.totalPages();
    const current = this.page();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, 'gap', total];
    if (current >= total - 3) return [1, 'gap', total - 4, total - 3, total - 2, total - 1, total];
    return [1, 'gap', current - 1, current, current + 1, 'gap', total];
  });

  readonly allOnPageSelected = computed(() => {
    const rows = this.pagedUsers();
    const sel = this.selected();
    return rows.length > 0 && rows.every((u) => sel.has(u.id));
  });

  readonly someOnPageSelected = computed(
    () => !this.allOnPageSelected() && this.pagedUsers().some((u) => this.selected().has(u.id)),
  );

  readonly stats = computed<StatCard[]>(() => {
    const all = this.users();
    const total = all.length;
    const pct = (n: number) => `${((n / total) * 100).toFixed(1)}% of total`;
    const count = (predicate: (u: ManagedUser) => boolean) => all.filter(predicate).length;
    const thisMonth = count((u) => u.joined.getFullYear() === NOW.getFullYear() && u.joined.getMonth() === NOW.getMonth());
    const active = count((u) => u.status === 'Online');
    const superAdmins = count((u) => u.role === 'Super Admin');
    const editors = count((u) => u.role === 'Editor');
    const viewers = count((u) => u.role === 'Viewer');
    return [
      { label: 'Total Users', value: total, caption: `${thisMonth} this month`, captionTone: 'up', icon: 'pi pi-users', accent: 'violet', chart: 'bars', path: '' },
      { label: 'Active Users', value: active, caption: pct(active), captionTone: 'muted', icon: 'pi pi-circle-fill', accent: 'emerald', chart: 'line', path: 'M2 34 C 18 34, 22 26, 34 30 S 52 36, 62 22 S 76 6, 86 8' },
      { label: 'Super Admins', value: superAdmins, caption: pct(superAdmins), captionTone: 'muted', icon: 'pi pi-crown', accent: 'amber', chart: 'line', path: 'M2 12 C 14 10, 22 8, 30 16 S 46 36, 58 34 S 76 18, 86 12' },
      { label: 'Editors', value: editors, caption: pct(editors), captionTone: 'muted', icon: 'pi pi-pencil', accent: 'fuchsia', chart: 'line', path: 'M2 30 C 12 22, 20 16, 30 22 S 44 36, 54 28 S 70 12, 86 20' },
      { label: 'Viewers', value: viewers, caption: pct(viewers), captionTone: 'muted', icon: 'pi pi-eye', accent: 'blue', chart: 'line', path: 'M2 32 C 14 34, 24 30, 36 32 S 52 16, 62 14 S 78 24, 86 26' },
    ];
  });

  readonly barHeights = [38, 62, 46, 84, 56, 100];

  roleMeta(role: UserRole) {
    return ROLE_META[role];
  }

  avatarGradient(user: ManagedUser): string {
    return AVATAR_GRADIENTS[Number(user.id) % AVATAR_GRADIENTS.length];
  }

  formatDate(d: Date): string {
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  }

  formatDateTime(d: Date): string {
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `${this.formatDate(d)} ${time}`;
  }

  relativeTime(d: Date): string {
    const hours = Math.floor((NOW.getTime() - d.getTime()) / 3_600_000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }

  applyFilters(): void {
    this.applied.set({
      search: this.searchDraft(),
      role: this.roleDraft(),
      status: this.statusDraft(),
      branch: this.branchDraft(),
      from: this.joinedFrom(),
      to: this.joinedTo(),
    });
    this.dateRangeOpen.set(false);
    this.page.set(1);
  }

  clearFilters(): void {
    this.searchDraft.set('');
    this.roleDraft.set('');
    this.statusDraft.set('');
    this.branchDraft.set('');
    this.joinedFrom.set('');
    this.joinedTo.set('');
    this.applyFilters();
  }

  goToPage(target: number): void {
    this.page.set(Math.min(Math.max(1, target), this.totalPages()));
  }

  changePageSize(size: number): void {
    this.pageSize.set(Number(size));
    this.page.set(1);
  }

  toggleRow(id: string): void {
    this.selected.update((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  togglePage(): void {
    const ids = this.pagedUsers().map((u) => u.id);
    const selectAll = !this.allOnPageSelected();
    this.selected.update((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (selectAll ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  toggleMenu(id: string): void {
    this.openMenuId.update((current) => (current === id ? null : id));
  }

  addUser(): void {
    this.notify('info', 'Add New User', 'User invitation form will open here.');
  }

  viewUser(user: ManagedUser): void {
    this.notify('info', 'View User', `Viewing ${user.name}'s profile`);
  }

  editUser(user: ManagedUser): void {
    this.notify('info', 'Edit User', `Editing ${user.name}'s profile`);
  }

  toggleStatus(user: ManagedUser): void {
    const status: UserStatus = user.status === 'Online' ? 'Offline' : 'Online';
    this.users.update((list) => list.map((u) => (u.id === user.id ? { ...u, status } : u)));
    this.openMenuId.set(null);
    this.notify('success', 'Status Updated', `${user.name} is now ${status.toLowerCase()}`);
  }

  deleteUser(user: ManagedUser): void {
    this.users.update((list) => list.filter((u) => u.id !== user.id));
    this.selected.update((prev) => {
      const next = new Set(prev);
      next.delete(user.id);
      return next;
    });
    this.openMenuId.set(null);
    this.goToPage(this.page());
    this.notify('warn', 'User Removed', `${user.name} has been removed`);
  }

  importUsers(): void {
    this.notify('info', 'Import', 'Upload a CSV file to import users.');
  }

  exportUsers(): void {
    const sel = this.selected();
    const rows = sel.size ? this.filteredUsers().filter((u) => sel.has(u.id)) : this.filteredUsers();
    CsvExporter.export(
      'users',
      ['Name', 'Email', 'Role', 'Branch', 'Status', 'Last Login', 'Joined'],
      rows.map((u) => [u.name, u.email, u.role, u.branch, u.status, this.formatDateTime(u.lastLogin), this.formatDate(u.joined)]),
    );
    this.notify('success', 'Export Complete', `${rows.length} users exported`);
  }

  private notify(severity: 'info' | 'success' | 'warn', summary: string, detail: string): void {
    this.messages.add({ severity, summary, detail, life: 3000 });
  }
}
