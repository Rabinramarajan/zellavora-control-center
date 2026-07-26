import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

import { Technology, ProjectTechnology } from '@shared/models';

interface TechnologyState {
  allTechnologies: Technology[];
  projectTechnologies: ProjectTechnology[];
  isLoading: boolean;
  error: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class TechnologyService {
  private state = signal<TechnologyState>({
    allTechnologies: [],
    projectTechnologies: [],
    isLoading: false,
    error: null,
  });

  // Public computed signals
  allTechnologies = computed(() => this.state().allTechnologies);
  projectTechnologies = computed(() => this.state().projectTechnologies);
  isLoading = computed(() => this.state().isLoading);
  error = computed(() => this.state().error);

  // Get selected technology IDs for quick filtering
  selectedTechIds = computed(() =>
    this.projectTechnologies().map((pt) => pt.technologyId)
  );

  constructor(private http: HttpClient) {
    this.loadAllTechnologies();
  }

  // ========== GET ALL TECHNOLOGIES ==========

  getAllTechnologies(): Observable<Technology[]> {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));

    return this.http.get<Technology[]>('/api/v1/technologies').pipe(
      tap((technologies) => {
        this.state.update((s) => ({
          ...s,
          allTechnologies: technologies.sort((a, b) =>
            (a.name ?? '').localeCompare(b.name ?? '')
          ),
          isLoading: false,
        }));
      }),
      catchError((error) => this.handleError(error))
    );
  }

  // ========== GET PROJECT TECHNOLOGIES ==========

  getProjectTechnologies(projectId: string): Observable<Technology[]> {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));

    return this.http
      .get<Technology[]>(`/api/v1/projects/${projectId}/technologies`)
      .pipe(
        tap((technologies) => {
          this.state.update((s) => ({
            ...s,
            projectTechnologies: technologies.map((tech) => ({
              id: tech.id,
              projectId,
              technologyId: tech.id,
              createdAt: new Date(),
            })),
            isLoading: false,
          }));
        }),
        catchError((error) => this.handleError(error))
      );
  }

  // ========== ADD TECHNOLOGY TO PROJECT ==========

  addTechnologyToProject(
    projectId: string,
    technologyId: string
  ): Observable<ProjectTechnology> {
    return this.http
      .post<ProjectTechnology>(
        `/api/v1/projects/${projectId}/technologies`,
        { technologyId }
      )
      .pipe(
        tap((pt) => {
          this.state.update((s) => ({
            ...s,
            projectTechnologies: [...s.projectTechnologies, pt],
          }));
        }),
        catchError((error) => this.handleError(error))
      );
  }

  // ========== REMOVE TECHNOLOGY FROM PROJECT ==========

  removeTechnologyFromProject(
    projectId: string,
    technologyId: string
  ): Observable<void> {
    return this.http
      .delete<void>(
        `/api/v1/projects/${projectId}/technologies/${technologyId}`
      )
      .pipe(
        tap(() => {
          this.state.update((s) => ({
            ...s,
            projectTechnologies: s.projectTechnologies.filter(
              (pt) => pt.technologyId !== technologyId
            ),
          }));
        }),
        catchError((error) => this.handleError(error))
      );
  }

  // ========== BULK UPDATE TECHNOLOGIES ==========

  updateProjectTechnologies(
    projectId: string,
    technologyIds: string[]
  ): Observable<ProjectTechnology[]> {
    return this.http
      .put<ProjectTechnology[]>(
        `/api/v1/projects/${projectId}/technologies`,
        { technologyIds }
      )
      .pipe(
        tap((pts) => {
          this.state.update((s) => ({
            ...s,
            projectTechnologies: pts,
          }));
        }),
        catchError((error) => this.handleError(error))
      );
  }

  // ========== CREATE TECHNOLOGY ==========

  createTechnology(
    data: Omit<Technology, 'id' | 'createdAt' | 'updatedAt'>
  ): Observable<Technology> {
    return this.http
      .post<Technology>('/api/v1/technologies', data)
      .pipe(
        tap((tech) => {
          this.state.update((s) => ({
            ...s,
            allTechnologies: [...s.allTechnologies, tech].sort((a, b) =>
              (a.name ?? '').localeCompare(b.name ?? '')
            ),
          }));
        }),
        catchError((error) => this.handleError(error))
      );
  }

  // ========== UTILITY ==========

  clearProjectTechnologies(): void {
    this.state.update((s) => ({
      ...s,
      projectTechnologies: [],
    }));
  }

  getTechnologyById(id: string): Technology | undefined {
    return this.allTechnologies().find((t) => t.id === id);
  }

  getTechologiesByIds(ids: string[]): Technology[] {
    const idSet = new Set(ids);
    return this.allTechnologies().filter((t) => idSet.has(t.id));
  }

  getTechologiesByCategory(category: string): Technology[] {
    return this.allTechnologies().filter((t) => t.category === category);
  }

  private loadAllTechnologies(): void {
    this.getAllTechnologies().subscribe();
  }

  private handleError(error: any): Observable<never> {
    const message = error.error?.error?.message || 'An error occurred';
    this.state.update((s) => ({ ...s, error: message, isLoading: false }));
    console.error('Technology error:', error);
    return throwError(() => error);
  }
}
