import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Project, ProjectStatus, PaginatedResponse, PaginationParams } from '@shared/models';
import { ProjectRepository } from '@core/repositories/project.repository';

interface ProjectsState {
  projects: Project[];
  selectedProject: Project | null;
  isLoading: boolean;
  error: string | null;
  totalCount: number;
  currentPage: number;
}

@Injectable({
  providedIn: 'root',
})
export class ProjectsService {
  private readonly projectRepo = inject(ProjectRepository);

  private state = signal<ProjectsState>({
    projects: [],
    selectedProject: null,
    isLoading: false,
    error: null,
    totalCount: 0,
    currentPage: 1,
  });

  // Public computed signals proxying values from state
  projects = computed(() => this.state().projects);
  selectedProject = computed(() => this.state().selectedProject);
  isLoading = computed(() => this.state().isLoading);
  error = computed(() => this.state().error);
  totalCount = computed(() => this.state().totalCount);
  currentPage = computed(() => this.state().currentPage);

  // Computed totals
  draftCount = computed(() =>
    this.projects().filter((p) => p.status === 'draft').length
  );
  publishedCount = computed(() =>
    this.projects().filter((p) => p.status === 'published').length
  );
  archivedCount = computed(() =>
    this.projects().filter((p) => p.status === 'archived').length
  );

  constructor() {
    this.loadProjects();
  }

  getProjects(params?: PaginationParams): Observable<Project[]> {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));
    return this.projectRepo.loadProjects(params).pipe(
      tap((projects) => {
        this.state.update((s) => ({
          ...s,
          projects,
          totalCount: projects.length,
          isLoading: false,
        }));
      }),
      catchError((error) => this.handleError(error))
    );
  }

  getProject(id: string): Observable<Project> {
    return this.projectRepo.loadProjectById(id).pipe(
      tap((project) => {
        this.state.update((s) => ({
          ...s,
          selectedProject: project,
        }));
      }),
      catchError((error) => this.handleError(error))
    );
  }

  createProject(
    data: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'publishedAt' | 'archivedAt' | 'viewCount' | 'downloadCount'>
  ): Observable<Project> {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));
    return this.projectRepo.createProject(data).pipe(
      tap((project) => {
        this.state.update((s) => ({
          ...s,
          projects: [project, ...s.projects],
          isLoading: false,
        }));
      }),
      catchError((error) => this.handleError(error))
    );
  }

  updateProject(id: string, data: Partial<Project>): Observable<Project> {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));
    return this.projectRepo.updateProject(id, data).pipe(
      tap((updated) => {
        this.state.update((s) => ({
          ...s,
          projects: s.projects.map((p) => (p.id === id ? updated : p)),
          selectedProject: s.selectedProject?.id === id ? updated : s.selectedProject,
          isLoading: false,
        }));
      }),
      catchError((error) => this.handleError(error))
    );
  }

  deleteProject(id: string): Observable<void> {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));
    return this.projectRepo.deleteProject(id).pipe(
      tap(() => {
        this.state.update((s) => ({
          ...s,
          projects: s.projects.filter((p) => p.id !== id),
          selectedProject: s.selectedProject?.id === id ? null : s.selectedProject,
          isLoading: false,
        }));
      }),
      catchError((error) => this.handleError(error))
    );
  }

  publishProject(id: string): Observable<Project> {
    return this.updateProject(id, {
      status: 'published' as ProjectStatus,
      publishedAt: new Date(),
    });
  }

  archiveProject(id: string): Observable<Project> {
    return this.updateProject(id, {
      status: 'archived' as ProjectStatus,
    });
  }

  unarchiveProject(id: string): Observable<Project> {
    return this.updateProject(id, {
      status: 'draft' as ProjectStatus,
    });
  }

  private loadProjects(): void {
    this.getProjects({ page: 1, pageSize: 50 }).subscribe();
  }

  private handleError(error: any): Observable<never> {
    const message = error.message || 'An error occurred';
    this.state.update((s) => ({ ...s, error: message, isLoading: false }));
    return throwError(() => error);
  }
}
