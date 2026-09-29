import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiDataService } from '../http/api-data.service';
import { PaginationParams, Project } from '@shared/models';

interface ProjectListResponse {
  data: Project[];
  pagination: { page: number; pageSize: number; total: number };
}

@Injectable({ providedIn: 'root' })
export class ProjectApiService {
  private readonly apiData = inject(ApiDataService);

  public getProjects(params?: PaginationParams): Observable<Project[]> {
    return this.apiData
      .getData<ProjectListResponse>('/projects', params)
      .pipe(map((response) => response.data));
  }

  public getProjectById(id: string): Observable<Project> {
    return this.apiData.getData<Project>(`/projects/${id}`);
  }

  public createProject(project: Partial<Project>): Observable<Project> {
    return this.apiData.postData<Project>('/projects', project);
  }

  public updateProject(id: string, project: Partial<Project>): Observable<Project> {
    return this.apiData.putData<Project>(`/projects/${id}`, project);
  }

  public deleteProject(id: string): Observable<void> {
    return this.apiData.deleteData<void>(`/projects/${id}`);
  }
}
