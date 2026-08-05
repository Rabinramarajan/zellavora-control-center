import { Injectable, inject, signal, computed } from '@angular/core';
import { throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

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

  // Stub methods for API calls (implement when backend is ready)
  loadTeams(): void {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));
    // TODO: Call API when ready
    setTimeout(() => {
      this.state.update((s) => ({
        ...s,
        items: [
          {
            id: '1',
            name: 'Engineering',
            description: 'Engineering team',
            memberCount: 5,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 'admin',
          },
        ],
        totalCount: 1,
        isLoading: false,
      }));
    }, 500);
  }

  loadTeam(id: string): void {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));
    // TODO: Call API when ready
  }

  createTeam(data: Omit<Team, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>): void {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));
    // TODO: Call API when ready
  }

  updateTeam(id: string, data: Partial<Team>): void {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));
    // TODO: Call API when ready
  }

  deleteTeam(id: string): void {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));
    // TODO: Call API when ready
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
}
