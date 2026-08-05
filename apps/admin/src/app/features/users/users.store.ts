import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { throwError } from 'rxjs';
import { ApiIntegrationService } from '../../core/services/api-integration.service';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'manager' | 'member' | 'viewer';
  status: 'active' | 'inactive' | 'invited' | 'suspended';
  lastLogin?: Date;
  joinedAt: Date;
  updatedAt: Date;
}

interface UsersState {
  items: User[];
  selectedUser: User | null;
  isLoading: boolean;
  error: string | null;
  totalCount: number;
  pageSize: number;
  currentPage: number;
  searchQuery: string;
  roleFilter: 'all' | User['role'];
  statusFilter: 'all' | User['status'];
  sortBy: 'recent' | 'name' | 'role';
}

@Injectable({
  providedIn: 'root',
})
export class UsersStore {
  private api = inject(ApiIntegrationService);

  private state = signal<UsersState>({
    items: [],
    selectedUser: null,
    isLoading: false,
    error: null,
    totalCount: 0,
    pageSize: 20,
    currentPage: 1,
    searchQuery: '',
    roleFilter: 'all',
    statusFilter: 'all',
    sortBy: 'recent',
  });

  // Public signals
  items = computed(() => this.state().items);
  selectedUser = computed(() => this.state().selectedUser);
  isLoading = computed(() => this.state().isLoading);
  error = computed(() => this.state().error);
  totalCount = computed(() => this.state().totalCount);
  pageSize = computed(() => this.state().pageSize);
  currentPage = computed(() => this.state().currentPage);
  searchQuery = computed(() => this.state().searchQuery);
  roleFilter = computed(() => this.state().roleFilter);
  statusFilter = computed(() => this.state().statusFilter);
  sortBy = computed(() => this.state().sortBy);

  // Computed derived values
  totalPages = computed(() => Math.ceil(this.totalCount() / this.pageSize()));

  filteredItems = computed(() => {
    let filtered = [...this.items()];

    // Search filter
    if (this.searchQuery()) {
      const query = this.searchQuery().toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.name.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query)
      );
    }

    // Role filter
    if (this.roleFilter() !== 'all') {
      filtered = filtered.filter((u) => u.role === this.roleFilter());
    }

    // Status filter
    if (this.statusFilter() !== 'all') {
      filtered = filtered.filter((u) => u.status === this.statusFilter());
    }

    return this.sortUsers(filtered);
  });

  roleCounts = computed(() => ({
    admin: this.items().filter((u) => u.role === 'admin').length,
    manager: this.items().filter((u) => u.role === 'manager').length,
    member: this.items().filter((u) => u.role === 'member').length,
    viewer: this.items().filter((u) => u.role === 'viewer').length,
  }));

  statusCounts = computed(() => ({
    active: this.items().filter((u) => u.status === 'active').length,
    inactive: this.items().filter((u) => u.status === 'inactive').length,
    invited: this.items().filter((u) => u.status === 'invited').length,
    suspended: this.items().filter((u) => u.status === 'suspended').length,
  }));

  // Methods
  loadUsers(): void {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));
    const params = this.buildQueryParams();
    this.api.getIamUsers(params).subscribe({
      next: (response) => {
        this.state.update((s) => ({
          ...s,
          items: response.data,
          totalCount: response.total || 0,
          isLoading: false,
        }));
      },
      error: (err) => {
        this.state.update((s) => ({
          ...s,
          error: err.message || 'Failed to load users',
          isLoading: false,
        }));
      },
    });
  }

  loadUser(id: string): void {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));
    this.api.getIamUserById(id).subscribe({
      next: (response) => {
        this.state.update((s) => ({
          ...s,
          selectedUser: response.data,
          isLoading: false,
        }));
      },
      error: (err) => {
        this.state.update((s) => ({
          ...s,
          error: err.message || 'Failed to load user',
          isLoading: false,
        }));
      },
    });
  }

  createUser(data: Omit<User, 'id' | 'joinedAt' | 'updatedAt'>): void {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));
    this.api.createIamUser(data).subscribe({
      next: (response) => {
        this.state.update((s) => ({
          ...s,
          items: [...s.items, response.data],
          totalCount: s.totalCount + 1,
          isLoading: false,
        }));
      },
      error: (err) => {
        this.state.update((s) => ({
          ...s,
          error: err.message || 'Failed to create user',
          isLoading: false,
        }));
      },
    });
  }

  updateUser(id: string, data: Partial<User>): void {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));
    this.api.updateIamUser(id, data).subscribe({
      next: (response) => {
        this.state.update((s) => ({
          ...s,
          items: s.items.map((u) => (u.id === id ? response.data : u)),
          selectedUser: s.selectedUser?.id === id ? response.data : s.selectedUser,
          isLoading: false,
        }));
      },
      error: (err) => {
        this.state.update((s) => ({
          ...s,
          error: err.message || 'Failed to update user',
          isLoading: false,
        }));
      },
    });
  }

  deleteUser(id: string): void {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));
    this.api.deleteIamUser(id).subscribe({
      next: () => {
        this.state.update((s) => ({
          ...s,
          items: s.items.filter((u) => u.id !== id),
          totalCount: s.totalCount - 1,
          selectedUser: s.selectedUser?.id === id ? null : s.selectedUser,
          isLoading: false,
        }));
      },
      error: (err) => {
        this.state.update((s) => ({
          ...s,
          error: err.message || 'Failed to delete user',
          isLoading: false,
        }));
      },
    });
  }

  updateUserRole(id: string, role: User['role']): void {
    this.updateUser(id, { role });
  }

  suspendUser(id: string): void {
    this.updateUser(id, { status: 'suspended' });
  }

  activateUser(id: string): void {
    this.updateUser(id, { status: 'active' });
  }

  inviteUsers(emails: string[]): void {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));
    this.api.inviteIamUsers({ emails }).subscribe({
      next: (response) => {
        this.state.update((s) => ({
          ...s,
          isLoading: false,
        }));
      },
      error: (err) => {
        this.state.update((s) => ({
          ...s,
          error: err.message || 'Failed to invite users',
          isLoading: false,
        }));
      },
    });
  }

  setSearchQuery(query: string): void {
    this.state.update((s) => ({ ...s, searchQuery: query }));
  }

  setRoleFilter(role: 'all' | User['role']): void {
    this.state.update((s) => ({ ...s, roleFilter: role }));
  }

  setStatusFilter(status: 'all' | User['status']): void {
    this.state.update((s) => ({ ...s, statusFilter: status }));
  }

  setSortBy(sortBy: 'recent' | 'name' | 'role'): void {
    this.state.update((s) => ({ ...s, sortBy }));
  }

  setCurrentPage(page: number): void {
    this.state.update((s) => ({ ...s, currentPage: page }));
  }

  clearError(): void {
    this.state.update((s) => ({ ...s, error: null }));
  }

  private sortUsers(users: User[]): User[] {
    const sortBy = this.sortBy();

    switch (sortBy) {
      case 'name':
        return users.sort((a, b) => a.name.localeCompare(b.name));
      case 'role':
        return users.sort((a, b) => a.role.localeCompare(b.role));
      case 'recent':
      default:
        return users.sort(
          (a, b) =>
            new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()
        );
    }
  }

  private buildQueryParams(): Record<string, any> {
    const params: Record<string, any> = {
      page: this.currentPage(),
      pageSize: this.pageSize(),
    };

    if (this.searchQuery()) {
      params.q = this.searchQuery();
    }

    if (this.roleFilter() !== 'all') {
      params.roleId = this.roleFilter();
    }

    if (this.statusFilter() !== 'all') {
      params.status = this.statusFilter();
    }

    return params;
  }
}
