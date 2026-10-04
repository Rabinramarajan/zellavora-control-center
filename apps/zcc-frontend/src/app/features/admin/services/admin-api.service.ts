/**
 * Admin API Service - Handles all HTTP communication with backend
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';

import {
  User,
  UserSearchCriteria,
  UserSearchResult,
  Role,
  RoleSearchCriteria,
  RoleSearchResult,
  Resource,
  ResourceSearchCriteria,
  ResourceSearchResult,
  Branch,
  BranchSearchCriteria,
  BranchSearchResult,
  AuditLogSearchCriteria,
  AuditLogSearchResult,
  Config,
  Group,
  ApiResponse,
} from '../models/admin.models';

export type SearchHttpMethod = 'GET' | 'POST';

@Injectable({
  providedIn: 'root',
})
export class AdminApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/admin';

  /**
   * The legacy admin backend wraps every payload in a `{ data, infoMessage,
   * errorMessage, hasError }` envelope. Unwrap it so callers get the payload
   * directly.
   */
  private unwrap<T>(res: ApiResponse<T> | null | undefined): T {
    return (res?.data ?? ({} as T)) as T;
  }

  /**
   * Legacy search endpoints expose GET for screen initialization and POST for
   * executing a search. Keep that distinction in one place so every search
   * screen serializes criteria consistently for either transport.
   */
  private async search<TCriteria extends object, TResult>(
    path: string,
    criteria: TCriteria,
    method: SearchHttpMethod
  ): Promise<TResult> {
    const url = `${this.baseUrl}/${path}/search`;
    const request =
      method === 'GET'
        ? this.http.get<ApiResponse<TResult>>(url, {
            params: this.toQueryParams(criteria),
          })
        : this.http.post<ApiResponse<TResult>>(url, criteria);

    return this.unwrap(await lastValueFrom(request));
  }

  private toQueryParams(criteria: object): Record<string, string> {
    return Object.fromEntries(
      Object.entries(criteria)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => [key, String(value)])
    );
  }

  // ==================== USER ENDPOINTS ====================

  async searchUsers(
    criteria: UserSearchCriteria,
    method: SearchHttpMethod = 'POST'
  ): Promise<UserSearchResult> {
    return this.search('users', criteria, method);
  }

  async createNewUser(): Promise<User> {
    const res = await lastValueFrom(
      this.http.get<ApiResponse<User>>(`${this.baseUrl}/users/template`)
    );
    return this.unwrap(res);
  }

  async openUser(userSerialId: number): Promise<User> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<User>>(`${this.baseUrl}/users/details`, {
        data: userSerialId,
      })
    );
    return this.unwrap(res);
  }

  async saveUser(user: User): Promise<User> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<User>>(`${this.baseUrl}/users/save`, user)
    );
    return this.unwrap(res);
  }

  // ==================== ROLE ENDPOINTS ====================

  async searchRoles(
    criteria: RoleSearchCriteria,
    method: SearchHttpMethod = 'POST'
  ): Promise<RoleSearchResult> {
    return this.search('roles', criteria, method);
  }

  async createNewRole(): Promise<Role> {
    const res = await lastValueFrom(
      this.http.get<ApiResponse<Role>>(`${this.baseUrl}/roles/template`)
    );
    return this.unwrap(res);
  }

  async openRole(roleId: number): Promise<Role> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<Role>>(`${this.baseUrl}/roles/details`, {
        data: roleId,
      })
    );
    return this.unwrap(res);
  }

  async saveRole(role: Role): Promise<Role> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<Role>>(`${this.baseUrl}/roles/save`, role)
    );
    return this.unwrap(res);
  }

  async deleteRole(roleId: number): Promise<Role> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<Role>>(`${this.baseUrl}/roles/delete`, {
        data: roleId,
      })
    );
    return this.unwrap(res);
  }

  // ==================== RESOURCE ENDPOINTS ====================

  async searchResources(
    criteria: ResourceSearchCriteria,
    method: SearchHttpMethod = 'POST'
  ): Promise<ResourceSearchResult> {
    return this.search('resources', criteria, method);
  }

  async createNewResource(): Promise<Resource> {
    const res = await lastValueFrom(
      this.http.get<ApiResponse<Resource>>(`${this.baseUrl}/resources/template`)
    );
    return this.unwrap(res);
  }

  async saveResource(resource: Resource): Promise<Resource> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<Resource>>(`${this.baseUrl}/resources/save`, resource)
    );
    return this.unwrap(res);
  }

  async deleteResource(resourceId: number): Promise<Resource> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<Resource>>(`${this.baseUrl}/resources/delete`, {
        data: resourceId,
      })
    );
    return this.unwrap(res);
  }

  // ==================== BRANCH ENDPOINTS ====================

  async searchBranches(
    criteria: BranchSearchCriteria,
    method: SearchHttpMethod = 'POST'
  ): Promise<BranchSearchResult> {
    return this.search('branches', criteria, method);
  }

  async openBranch(branchId: number): Promise<Branch> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<Branch>>(`${this.baseUrl}/branches/details`, {
        data: branchId,
      })
    );
    return this.unwrap(res);
  }

  async saveBranch(branch: Branch): Promise<Branch> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<Branch>>(`${this.baseUrl}/branches/save`, branch)
    );
    return this.unwrap(res);
  }

  async deleteBranch(branchId: number): Promise<Branch> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<Branch>>(`${this.baseUrl}/branches/delete`, {
        admBranchId: branchId,
      })
    );
    return this.unwrap(res);
  }

  // ==================== AUDIT LOG ENDPOINTS ====================

  async searchAuditLogs(
    criteria: AuditLogSearchCriteria,
    method: SearchHttpMethod = 'POST'
  ): Promise<AuditLogSearchResult> {
    return this.search('audit-logs', criteria, method);
  }

  // ==================== CONFIG ENDPOINTS ====================

  async openConfig(configId: number): Promise<Config> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<Config>>(`${this.baseUrl}/configurations/details`, {
        data: configId,
      })
    );
    return this.unwrap(res);
  }

  async saveConfig(config: Config): Promise<Config> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<Config>>(`${this.baseUrl}/configurations/save`, config)
    );
    return this.unwrap(res);
  }

  // ==================== GROUP ENDPOINTS ====================

  async deleteGroup(groupId: number): Promise<Group> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<Group>>(`${this.baseUrl}/groups/delete`, {
        data: groupId,
      })
    );
    return this.unwrap(res);
  }
}
