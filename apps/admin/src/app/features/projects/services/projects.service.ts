import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

import { Project, ProjectStatus, PaginatedResponse, PaginationParams } from '@shared/models';

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
  private state = signal<ProjectsState>({
    projects: [],
    selectedProject: null,
    isLoading: false,
    error: null,
    totalCount: 0,
    currentPage: 1,
  });

  // Public computed signals
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

  constructor(private http: HttpClient) {
    this.loadProjects();
  }

  // ========== LIST PROJECTS ==========

  getProjects(params?: PaginationParams): Observable<PaginatedResponse<Project>> {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));

    const httpParams = params ? { page: params.page.toString(), pageSize: params.pageSize.toString() } : undefined;

    return this.http
      .get<PaginatedResponse<Project>>('/api/v1/projects', { params: httpParams })
      .pipe(
        tap((response) => {
          this.state.update((s) => ({
            ...s,
            projects: response.data,
            totalCount: response.pagination.total,
            currentPage: response.pagination.page,
            isLoading: false,
          }));
        }),
        catchError((error) => this.handleError(error))
      );
  }

  // ========== GET PROJECT ==========

  getProject(id: string): Observable<Project> {
    return this.http.get<Project>(`/api/v1/projects/${id}`).pipe(
      tap((project) => {
        this.state.update((s) => ({
          ...s,
          selectedProject: project,
        }));
      }),
      catchError((error) => this.handleError(error))
    );
  }

  // ========== CREATE PROJECT ==========

  createProject(
    data: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'publishedAt' | 'archivedAt' | 'viewCount' | 'downloadCount'>
  ): Observable<Project> {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));

    return this.http.post<Project>('/api/v1/projects', data).pipe(
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

  // ========== UPDATE PROJECT ==========

  updateProject(id: string, data: Partial<Project>): Observable<Project> {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));

    return this.http.put<Project>(`/api/v1/projects/${id}`, data).pipe(
      tap((updated) => {
        this.state.update((s) => ({
          ...s,
          projects: s.projects.map((p) => (p.id === id ? updated : p)),
          selectedProject:
            s.selectedProject?.id === id ? updated : s.selectedProject,
          isLoading: false,
        }));
      }),
      catchError((error) => this.handleError(error))
    );
  }

  // ========== DELETE PROJECT ==========

  deleteProject(id: string): Observable<void> {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));

    return this.http.delete<void>(`/api/v1/projects/${id}`).pipe(
      tap(() => {
        this.state.update((s) => ({
          ...s,
          projects: s.projects.filter((p) => p.id !== id),
          selectedProject:
            s.selectedProject?.id === id ? null : s.selectedProject,
          isLoading: false,
        }));
      }),
      catchError((error) => this.handleError(error))
    );
  }

  // ========== PUBLISH PROJECT ==========

  publishProject(id: string): Observable<Project> {
    return this.updateProject(id, {
      status: 'published' as ProjectStatus,
      publishedAt: new Date(),
    });
  }

  // ========== ARCHIVE PROJECT ==========

  archiveProject(id: string): Observable<Project> {
    return this.updateProject(id, {
      status: 'archived' as ProjectStatus,
    });
  }

  // ========== UNARCHIVE PROJECT ==========

  unarchiveProject(id: string): Observable<Project> {
    return this.updateProject(id, {
      status: 'draft' as ProjectStatus,
    });
  }

  // ========== UTILITY METHODS ==========

  private loadProjects(): void {
    this.getProjects({ page: 1, pageSize: 50 }).subscribe();
  }

  private handleError(error: any): Observable<never> {
    const message = error.error?.error?.message || 'An error occurred';
    this.state.update((s) => ({ ...s, error: message, isLoading: false }));
    console.error('Projects error:', error);
    return throwError(() => error);
  }

  // Get project by slug (for public use)
  getProjectBySlug(slug: string): Observable<Project> {
    return this.http.get<Project>(`/api/v1/projects/slug/${slug}`);
  }

  // Get featured projects
  getFeaturedProjects(): Observable<Project[]> {
    return this.http.get<Project[]>('/api/v1/projects?featured=true');
  }

  // Search projects
  searchProjects(query: string): Observable<Project[]> {
    return this.http.get<Project[]>('/api/v1/projects/search', {
      params: { q: query },
    });
  }
}
