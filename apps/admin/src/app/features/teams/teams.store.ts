import { Injectable, inject, signal, computed } from '@angular/core';
import { ApiIntegrationService } from '../../core/services/api-integration.service';

interface Team {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

interface TeamsState {
  items: Team[];
  selectedTeam: Team | null;
  isLoading: boolean;
  error: string | null;
  totalCount: number;
  pageSize: number;
  currentPage: number;
  searchQuery: string;
  sortBy: 'recent' | 'name' | 'members';
}

@Injectable({
  providedIn: 'root',
})
export class TeamsStore {
  private api = inject(ApiIntegrationService);

  private state = signal<TeamsState>({
    items: [],
    selectedTeam: null,
    isLoading: false,
    error: null,
    totalCount: 0,
    pageSize: 20,
    currentPage: 1,
    searchQuery: '',
    sortBy: 'recent',
  });

  // Public signals
  items = computed(() => this.state().items);
  selectedTeam = computed(() => this.state().selectedTeam);
  isLoading = computed(() => this.state().isLoading);
  error = computed(() => this.state().error);
  totalCount = computed(() => this.state().totalCount);
  pageSize = computed(() => this.state().pageSize);
  currentPage = computed(() => this.state().currentPage);
  searchQuery = computed(() => this.state().searchQuery);
  sortBy = computed(() => this.state().sortBy);

  // Computed derived values
  totalPages = computed(() => Math.ceil(this.totalCount() / this.pageSize()));

  filteredItems = computed(() => {
    let filtered = [...this.items()];

    if (this.searchQuery()) {
      const query = this.searchQuery().toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          (t.description?.toLowerCase().includes(query) ?? false)
      );
    }

    return this.sortTeams(filtered);
  });

  totalMembers = computed(() =>
    this.items().reduce((sum, team) => sum + team.memberCount, 0)
  );

  setSearchQuery(query: string): void {
    this.state.update((s) => ({ ...s, searchQuery: query }));
  }

  setSortBy(sortBy: 'recent' | 'name' | 'members'): void {
    this.state.update((s) => ({ ...s, sortBy }));
  }

  setCurrentPage(page: number): void {
    this.state.update((s) => ({ ...s, currentPage: page }));
  }

  clearError(): void {
    this.state.update((s) => ({ ...s, error: null }));
  }

  loadTeams(): void {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));
    const params = this.buildQueryParams();
    this.api.getTeams(params).subscribe({
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
          error: err.message || 'Failed to load teams',
          isLoading: false,
        }));
      },
    });
  }

  loadTeam(id: string): void {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));
    this.api.getTeamById(id).subscribe({
      next: (response) => {
        this.state.update((s) => ({
          ...s,
          selectedTeam: response.data,
          isLoading: false,
        }));
      },
      error: (err) => {
        this.state.update((s) => ({
          ...s,
          error: err.message || 'Failed to load team',
          isLoading: false,
        }));
      },
    });
  }

  createTeam(data: Omit<Team, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>): void {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));
    this.api.createTeam(data).subscribe({
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
          error: err.message || 'Failed to create team',
          isLoading: false,
        }));
      },
    });
  }

  updateTeam(id: string, data: Partial<Team>): void {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));
    this.api.updateTeam(id, data).subscribe({
      next: (response) => {
        this.state.update((s) => ({
          ...s,
          items: s.items.map((t) => (t.id === id ? response.data : t)),
          selectedTeam: s.selectedTeam?.id === id ? response.data : s.selectedTeam,
          isLoading: false,
        }));
      },
      error: (err) => {
        this.state.update((s) => ({
          ...s,
          error: err.message || 'Failed to update team',
          isLoading: false,
        }));
      },
    });
  }

  deleteTeam(id: string): void {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));
    this.api.deleteTeam(id).subscribe({
      next: () => {
        this.state.update((s) => ({
          ...s,
          items: s.items.filter((t) => t.id !== id),
          totalCount: s.totalCount - 1,
          selectedTeam: s.selectedTeam?.id === id ? null : s.selectedTeam,
          isLoading: false,
        }));
      },
      error: (err) => {
        this.state.update((s) => ({
          ...s,
          error: err.message || 'Failed to delete team',
          isLoading: false,
        }));
      },
    });
  }

  private sortTeams(teams: Team[]): Team[] {
    const sortBy = this.sortBy();

    switch (sortBy) {
      case 'name':
        return teams.sort((a, b) => a.name.localeCompare(b.name));
      case 'members':
        return teams.sort((a, b) => b.memberCount - a.memberCount);
      case 'recent':
      default:
        return teams.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }
  }

  private buildQueryParams(): Record<string, any> {
    const params: Record<string, any> = {
      page: this.currentPage(),
      pageSize: this.pageSize(),
    };

    if (this.searchQuery()) {
      params.search = this.searchQuery();
    }

    params.sortBy = this.sortBy();

    return params;
  }
}
