import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ProjectApiService } from '@core/api/project.api';
import { Project } from '@shared/models';

@Injectable({ providedIn: 'root' })
export class ProjectRepository {
  private readonly api = inject(ProjectApiService);

  // Signal Store State
  private readonly _projects = signal<Project[]>([]);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  // Readonly Selectors
  readonly projects = computed(() => this._projects());
  readonly loading = computed(() => this._loading());
  readonly error = computed(() => this._error());

  loadProjects(params?: any): Observable<Project[]> {
    this._loading.set(true);
    this._error.set(null);
    return this.api.getProjects(params).pipe(
      tap((data) => {
        this._projects.set(data);
        this._loading.set(false);
      }),
      catchError((err) => {
        this._error.set(err.message || 'Failed to load projects');
        this._loading.set(false);
        return throwError(() => err);
      })
    );
  }

  loadProjectById(id: string): Observable<Project> {
    this._loading.set(true);
    this._error.set(null);
    return this.api.getProjectById(id).pipe(
      tap(() => this._loading.set(false)),
      catchError((err) => {
        this._error.set(err.message || 'Failed to load project details');
        this._loading.set(false);
        return throwError(() => err);
      })
    );
  }

  createProject(project: Partial<Project>): Observable<Project> {
    this._loading.set(true);
    return this.api.createProject(project).pipe(
      tap((newProj) => {
        this._projects.update((current) => [...current, newProj]);
        this._loading.set(false);
      }),
      catchError((err) => {
        this._loading.set(false);
        return throwError(() => err);
      })
    );
  }

  updateProject(id: string, project: Partial<Project>): Observable<Project> {
    this._loading.set(true);
    return this.api.updateProject(id, project).pipe(
      tap((updatedProj) => {
        this._projects.update((current) =>
          current.map((p) => (p.id === id ? { ...p, ...updatedProj } : p))
        );
        this._loading.set(false);
      }),
      catchError((err) => {
        this._loading.set(false);
        return throwError(() => err);
      })
    );
  }

  deleteProject(id: string): Observable<void> {
    this._loading.set(true);
    return this.api.deleteProject(id).pipe(
      tap(() => {
        this._projects.update((current) => current.filter((p) => p.id !== id));
        this._loading.set(false);
      }),
      catchError((err) => {
        this._loading.set(false);
        return throwError(() => err);
      })
    );
  }
}
