import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ApiListResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiSingleResponse<T> {
  data: T;
  meta?: Record<string, any>;
}

@Injectable({
  providedIn: 'root',
})
export class ApiIntegrationService {
  private http = inject(HttpClient);
  private apiUrl = '/api/v1';

  // ========== USERS ==========
  getUsers(filters?: Record<string, any>): Observable<ApiListResponse<any>> {
    return this.http.get<ApiListResponse<any>>(`${this.apiUrl}/users`, {
      params: filters || {},
    });
  }

  getUserById(id: string): Observable<ApiSingleResponse<any>> {
    return this.http.get<ApiSingleResponse<any>>(
      `${this.apiUrl}/users/${id}`
    );
  }

  createUser(user: any): Observable<ApiSingleResponse<any>> {
    return this.http.post<ApiSingleResponse<any>>(`${this.apiUrl}/users`, user);
  }

  updateUser(id: string, user: any): Observable<ApiSingleResponse<any>> {
    return this.http.put<ApiSingleResponse<any>>(
      `${this.apiUrl}/users/${id}`,
      user
    );
  }

  deleteUser(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${this.apiUrl}/users/${id}`
    );
  }

  // ========== BLOG POSTS ==========
  getBlogPosts(filters?: Record<string, any>): Observable<ApiListResponse<any>> {
    return this.http.get<ApiListResponse<any>>(`${this.apiUrl}/blog`, {
      params: filters || {},
    });
  }

  getBlogPostById(id: string): Observable<ApiSingleResponse<any>> {
    return this.http.get<ApiSingleResponse<any>>(
      `${this.apiUrl}/blog/${id}`
    );
  }

  createBlogPost(post: any): Observable<ApiSingleResponse<any>> {
    return this.http.post<ApiSingleResponse<any>>(`${this.apiUrl}/blog`, post);
  }

  updateBlogPost(id: string, post: any): Observable<ApiSingleResponse<any>> {
    return this.http.put<ApiSingleResponse<any>>(
      `${this.apiUrl}/blog/${id}`,
      post
    );
  }

  deleteBlogPost(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${this.apiUrl}/blog/${id}`
    );
  }

  publishBlogPost(id: string): Observable<ApiSingleResponse<any>> {
    return this.http.post<ApiSingleResponse<any>>(
      `${this.apiUrl}/blog/${id}/publish`,
      {}
    );
  }

  // ========== MEDIA FILES ==========
  getMediaFiles(filters?: Record<string, any>): Observable<ApiListResponse<any>> {
    return this.http.get<ApiListResponse<any>>(`${this.apiUrl}/media`, {
      params: filters || {},
    });
  }

  getMediaFileById(id: string): Observable<ApiSingleResponse<any>> {
    return this.http.get<ApiSingleResponse<any>>(
      `${this.apiUrl}/media/${id}`
    );
  }

  deleteMediaFile(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${this.apiUrl}/media/${id}`
    );
  }

  updateMediaMetadata(id: string, metadata: any): Observable<ApiSingleResponse<any>> {
    return this.http.put<ApiSingleResponse<any>>(
      `${this.apiUrl}/media/${id}`,
      metadata
    );
  }

  // ========== PROJECTS ==========
  getProjects(filters?: Record<string, any>): Observable<ApiListResponse<any>> {
    return this.http.get<ApiListResponse<any>>(`${this.apiUrl}/projects`, {
      params: filters || {},
    });
  }

  getProjectById(id: string): Observable<ApiSingleResponse<any>> {
    return this.http.get<ApiSingleResponse<any>>(
      `${this.apiUrl}/projects/${id}`
    );
  }

  createProject(project: any): Observable<ApiSingleResponse<any>> {
    return this.http.post<ApiSingleResponse<any>>(
      `${this.apiUrl}/projects`,
      project
    );
  }

  updateProject(id: string, project: any): Observable<ApiSingleResponse<any>> {
    return this.http.put<ApiSingleResponse<any>>(
      `${this.apiUrl}/projects/${id}`,
      project
    );
  }

  deleteProject(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${this.apiUrl}/projects/${id}`
    );
  }

  // ========== PORTFOLIO SECTIONS ==========
  getPortfolioSection(section: string): Observable<ApiSingleResponse<any>> {
    return this.http.get<ApiSingleResponse<any>>(
      `${this.apiUrl}/portfolio/${section}`
    );
  }

  updatePortfolioSection(section: string, data: any): Observable<ApiSingleResponse<any>> {
    return this.http.put<ApiSingleResponse<any>>(
      `${this.apiUrl}/portfolio/${section}`,
      data
    );
  }

  // ========== ANALYTICS ==========
  getAnalytics(filters?: Record<string, any>): Observable<ApiSingleResponse<any>> {
    return this.http.get<ApiSingleResponse<any>>(`${this.apiUrl}/analytics`, {
      params: filters || {},
    });
  }

  getTrafficData(dateRange?: string): Observable<ApiSingleResponse<any>> {
    return this.http.get<ApiSingleResponse<any>>(
      `${this.apiUrl}/analytics/traffic`,
      {
        params: { dateRange: dateRange || '7d' },
      }
    );
  }

  getDeviceBreakdown(): Observable<ApiSingleResponse<any>> {
    return this.http.get<ApiSingleResponse<any>>(
      `${this.apiUrl}/analytics/devices`
    );
  }

  getTopPages(): Observable<ApiSingleResponse<any>> {
    return this.http.get<ApiSingleResponse<any>>(
      `${this.apiUrl}/analytics/top-pages`
    );
  }

  getTrafficSources(): Observable<ApiSingleResponse<any>> {
    return this.http.get<ApiSingleResponse<any>>(
      `${this.apiUrl}/analytics/sources`
    );
  }

  // ========== SETTINGS ==========
  getSettings(section?: string): Observable<ApiSingleResponse<any>> {
    const url = section
      ? `${this.apiUrl}/settings/${section}`
      : `${this.apiUrl}/settings`;
    return this.http.get<ApiSingleResponse<any>>(url);
  }

  updateSettings(section: string, settings: any): Observable<ApiSingleResponse<any>> {
    return this.http.put<ApiSingleResponse<any>>(
      `${this.apiUrl}/settings/${section}`,
      settings
    );
  }

  // ========== DASHBOARD ==========
  getDashboardStats(): Observable<ApiSingleResponse<any>> {
    return this.http.get<ApiSingleResponse<any>>(
      `${this.apiUrl}/dashboard/stats`
    );
  }

  getDashboardActivities(): Observable<ApiListResponse<any>> {
    return this.http.get<ApiListResponse<any>>(
      `${this.apiUrl}/dashboard/activities`
    );
  }

  // ========== ROLES & PERMISSIONS ==========
  getRoles(filters?: Record<string, any>): Observable<ApiListResponse<any>> {
    return this.http.get<ApiListResponse<any>>(`${this.apiUrl}/roles`, {
      params: filters || {},
    });
  }

  getRoleById(id: string): Observable<ApiSingleResponse<any>> {
    return this.http.get<ApiSingleResponse<any>>(
      `${this.apiUrl}/roles/${id}`
    );
  }

  createRole(role: any): Observable<ApiSingleResponse<any>> {
    return this.http.post<ApiSingleResponse<any>>(`${this.apiUrl}/roles`, role);
  }

  updateRole(id: string, role: any): Observable<ApiSingleResponse<any>> {
    return this.http.put<ApiSingleResponse<any>>(
      `${this.apiUrl}/roles/${id}`,
      role
    );
  }

  deleteRole(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${this.apiUrl}/roles/${id}`
    );
  }

  // ========== BRANCHES ==========
  getBranches(filters?: Record<string, any>): Observable<ApiListResponse<any>> {
    return this.http.get<ApiListResponse<any>>(`${this.apiUrl}/branches`, {
      params: filters || {},
    });
  }

  getBranchById(id: string): Observable<ApiSingleResponse<any>> {
    return this.http.get<ApiSingleResponse<any>>(
      `${this.apiUrl}/branches/${id}`
    );
  }

  createBranch(branch: any): Observable<ApiSingleResponse<any>> {
    return this.http.post<ApiSingleResponse<any>>(
      `${this.apiUrl}/branches`,
      branch
    );
  }

  updateBranch(id: string, branch: any): Observable<ApiSingleResponse<any>> {
    return this.http.put<ApiSingleResponse<any>>(
      `${this.apiUrl}/branches/${id}`,
      branch
    );
  }

  deleteBranch(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${this.apiUrl}/branches/${id}`
    );
  }

  // ========== AUDIT LOGS ==========
  getAuditLogs(filters?: Record<string, any>): Observable<ApiListResponse<any>> {
    return this.http.get<ApiListResponse<any>>(`${this.apiUrl}/audit-logs`, {
      params: filters || {},
    });
  }
}
