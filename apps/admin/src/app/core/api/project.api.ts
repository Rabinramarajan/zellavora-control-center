import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiDataService } from '../http/api-data.service';
import { Project } from '@shared/models';

@Injectable({ providedIn: 'root' })
export class ProjectApiService {
  private readonly apiData = inject(ApiDataService);

  getProjects(params?: any): Observable<Project[]> {
    return this.apiData.getData<Project[]>('/projects', params);
  }

  getProjectById(id: string): Observable<Project> {
    return this.apiData.getData<Project>(`/projects/${id}`);
  }

  createProject(project: Partial<Project>): Observable<Project> {
    return this.apiData.postData<Project>('/projects', project);
  }

  updateProject(id: string, project: Partial<Project>): Observable<Project> {
    return this.apiData.putData<Project>(`/projects/${id}`, project);
  }

  deleteProject(id: string): Observable<void> {
    return this.apiData.deleteData<void>(`/projects/${id}`);
  }
}
