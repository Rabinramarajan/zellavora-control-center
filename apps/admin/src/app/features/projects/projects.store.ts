import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { Project, ProjectStatus } from '@shared/models';
import { ProjectRepository } from '@core/repositories/project.repository';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

interface ProjectsState {
  items: Project[];
  selectedProject: Project | null;
  isLoading: boolean;
  error: string | null;
  totalCount: number;
  pageSize: number;
  currentPage: number;
  searchQuery: string;
  statusFilter: ProjectStatus | 'all';
  sortBy: 'recent' | 'name' | 'status';
}

@Injectable({
  providedIn: 'root',
})
export class ProjectsStore {
  private readonly projectRepo = inject(ProjectRepository);

  private state = signal<ProjectsState>({
    items: [],
    selectedProject: null,
    isLoading: false,
    error: null,
    totalCount: 0,
    pageSize: 20,
    currentPage: 1,
    searchQuery: '',
    statusFilter: 'all',
    sortBy: 'recent',
  });

  // Public signals
  items = computed(() => this.state().items);
  selectedProject = computed(() => this.state().selectedProject);
  isLoading = computed(() => this.state().isLoading);
  error = computed(() => this.state().error);
  totalCount = computed(() => this.state().totalCount);
  pageSize = computed(() => this.state().pageSize);
  currentPage = computed(() => this.state().currentPage);
  searchQuery = computed(() => this.state().searchQuery);
  statusFilter = computed(() => this.state().statusFilter);
  sortBy = computed(() => this.state().sortBy);

  // Computed derived values
  totalPages = computed(() => Math.ceil(this.totalCount() / this.pageSize()));

  filteredItems = computed(() => {
    let filtered = [...this.items()];

    if (this.searchQuery()) {
      const query = this.searchQuery().toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          (p.description?.toLowerCase().includes(query) ?? false)
      );
    }

    if (this.statusFilter() !== 'all') {
      filtered = filtered.filter((p) => p.status === this.statusFilter());
    }

    return this.sortProjects(filtered);
  });

  statusCounts = computed(() => ({
    all: this.items().length,
    draft: this.items().filter((p) => p.status === 'draft').length,
    published: this.items().filter((p) => p.status === 'published').length,
    archived: this.items().filter((p) => p.status === 'archived').length,
  }));

  constructor() {
    effect(() => {
      if (this.currentPage()) {
        this.loadProjects();
      }
    });
  }

  loadProjects(): void {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));

    this.projectRepo
      .loadProjects({ page: this.currentPage(), pageSize: this.pageSize() })
      .pipe(
        tap((projects) => {
          this.state.update((s) => ({
            ...s,
            items: projects,
            totalCount: projects.length,
            isLoading: false,
          }));
        }),
        catchError((error) => {
          this.state.update((s) => ({
            ...s,
            error: error.message || 'Failed to load projects',
            isLoading: false,
          }));
          return throwError(() => error);
        })
      )
      .subscribe();
  }

  loadProject(id: string): void {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));

    this.projectRepo
      .loadProjectById(id)
      .pipe(
        tap((project) => {
          this.state.update((s) => ({
            ...s,
            selectedProject: project,
            isLoading: false,
          }));
        }),
        catchError((error) => {
          this.state.update((s) => ({
            ...s,
            error: error.message || 'Failed to load project',
            isLoading: false,
          }));
          return throwError(() => error);
        })
      )
      .subscribe();
  }

  createProject(data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): void {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));

    this.projectRepo
      .createProject(data)
      .pipe(
        tap((project) => {
          this.state.update((s) => ({
            ...s,
            items: [project, ...s.items],
            totalCount: s.totalCount + 1,
            isLoading: false,
          }));
        }),
        catchError((error) => {
          this.state.update((s) => ({
            ...s,
            error: error.message || 'Failed to create project',
            isLoading: false,
          }));
          return throwError(() => error);
        })
      )
      .subscribe();
  }

  updateProject(id: string, data: Partial<Project>): void {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));

    this.projectRepo
      .updateProject(id, data)
      .pipe(
        tap((updated) => {
          this.state.update((s) => ({
            ...s,
            items: s.items.map((p) => (p.id === id ? updated : p)),
            selectedProject: s.selectedProject?.id === id ? updated : s.selectedProject,
            isLoading: false,
          }));
        }),
        catchError((error) => {
          this.state.update((s) => ({
            ...s,
            error: error.message || 'Failed to update project',
            isLoading: false,
          }));
          return throwError(() => error);
        })
      )
      .subscribe();
  }

  deleteProject(id: string): void {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));

    this.projectRepo
      .deleteProject(id)
      .pipe(
        tap(() => {
          this.state.update((s) => ({
            ...s,
            items: s.items.filter((p) => p.id !== id),
            selectedProject: s.selectedProject?.id === id ? null : s.selectedProject,
            totalCount: s.totalCount - 1,
            isLoading: false,
          }));
        }),
        catchError((error) => {
          this.state.update((s) => ({
            ...s,
            error: error.message || 'Failed to delete project',
            isLoading: false,
          }));
          return throwError(() => error);
        })
      )
      .subscribe();
  }

  publishProject(id: string): void {
    this.updateProject(id, {
      status: 'published' as ProjectStatus,
      publishedAt: new Date(),
    });
  }

  archiveProject(id: string): void {
    this.updateProject(id, {
      status: 'archived' as ProjectStatus,
    });
  }

  setSearchQuery(query: string): void {
    this.state.update((s) => ({ ...s, searchQuery: query }));
  }

  setStatusFilter(status: ProjectStatus | 'all'): void {
    this.state.update((s) => ({ ...s, statusFilter: status }));
  }

  setSortBy(sortBy: 'recent' | 'name' | 'status'): void {
    this.state.update((s) => ({ ...s, sortBy }));
  }

  setCurrentPage(page: number): void {
    this.state.update((s) => ({ ...s, currentPage: page }));
  }

  clearError(): void {
    this.state.update((s) => ({ ...s, error: null }));
  }

  private sortProjects(projects: Project[]): Project[] {
    const sortBy = this.sortBy();

    switch (sortBy) {
      case 'name':
        return projects.sort((a, b) => a.title.localeCompare(b.title));
      case 'status':
        return projects.sort((a, b) => a.status.localeCompare(b.status));
      case 'recent':
      default:
        return projects.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }
  }
}
