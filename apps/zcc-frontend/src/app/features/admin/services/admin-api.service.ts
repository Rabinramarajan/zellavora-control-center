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

  // ==================== USER ENDPOINTS ====================

  async searchUsers(criteria: UserSearchCriteria): Promise<UserSearchResult> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<UserSearchResult>>(
        `${this.baseUrl}/users/search`,
        criteria
      )
    );
    return this.unwrap(res);
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

  async searchRoles(criteria: RoleSearchCriteria): Promise<RoleSearchResult> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<RoleSearchResult>>(
        `${this.baseUrl}/roles/search`,
        criteria
      )
    );
    return this.unwrap(res);
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
    criteria: ResourceSearchCriteria
  ): Promise<ResourceSearchResult> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<ResourceSearchResult>>(
        `${this.baseUrl}/resources/search`,
        criteria
      )
    );
    return this.unwrap(res);
  }

  async createNewResource(): Promise<Resource> {
    const res = await lastValueFrom(
      this.http.get<ApiResponse<Resource>>(`${this.baseUrl}/resources/template`)
    );
    return this.unwrap(res);
  }

  async saveResource(resource: Resource): Promise<Resource> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<Resource>>(
        `${this.baseUrl}/resources/save`,
        resource
      )
    );
    return this.unwrap(res);
  }

  async deleteResource(resourceId: number): Promise<Resource> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<Resource>>(
        `${this.baseUrl}/resources/delete`,
        {
          data: resourceId,
        }
      )
    );
    return this.unwrap(res);
  }

  // ==================== BRANCH ENDPOINTS ====================

  async searchBranches(criteria: BranchSearchCriteria): Promise<BranchSearchResult> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<BranchSearchResult>>(
        `${this.baseUrl}/branches/search`,
        criteria
      )
    );
    return this.unwrap(res);
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
      this.http.post<ApiResponse<Branch>>(
        `${this.baseUrl}/branches/save`,
        branch
      )
    );
    return this.unwrap(res);
  }

  async deleteBranch(branchId: number): Promise<Branch> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<Branch>>(
        `${this.baseUrl}/branches/delete`,
        {
          admBranchId: branchId,
        }
      )
    );
    return this.unwrap(res);
  }

  // ==================== AUDIT LOG ENDPOINTS ====================

  async searchAuditLogs(criteria: AuditLogSearchCriteria): Promise<AuditLogSearchResult> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<AuditLogSearchResult>>(
        `${this.baseUrl}/audit-logs/search`,
        criteria
      )
    );
    return this.unwrap(res);
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
