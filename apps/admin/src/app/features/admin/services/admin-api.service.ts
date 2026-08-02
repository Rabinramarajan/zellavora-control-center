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
  AuditLog,
  AuditLogSearchCriteria,
  AuditLogSearchResult,
  Config,
  ConfigSearchCriteria,
  ConfigSearchResult,
  Group,
  GroupSearchCriteria,
  GroupSearchResult,
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

  async getUserInitialData(): Promise<any> {
    const res = await lastValueFrom(
      this.http.get<ApiResponse<any>>(`${this.baseUrl}/user/initialize`)
    );
    return this.unwrap(res);
  }

  async getUserSearchTemplate(): Promise<UserSearchCriteria> {
    const res = await lastValueFrom(
      this.http.get<ApiResponse<UserSearchCriteria>>(`${this.baseUrl}/user/search`)
    );
    return this.unwrap(res);
  }

  async searchUsers(criteria: UserSearchCriteria): Promise<UserSearchResult> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<UserSearchResult>>(
        `${this.baseUrl}/user/search`,
        criteria
      )
    );
    return this.unwrap(res);
  }

  async createNewUser(): Promise<User> {
    const res = await lastValueFrom(
      this.http.get<ApiResponse<User>>(`${this.baseUrl}/user/new`)
    );
    return this.unwrap(res);
  }

  async openUser(userSerialId: number): Promise<User> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<User>>(`${this.baseUrl}/user/open`, {
        data: userSerialId,
      })
    );
    return this.unwrap(res);
  }

  async saveUser(user: User): Promise<User> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<User>>(`${this.baseUrl}/user/save`, user)
    );
    return this.unwrap(res);
  }

  async getUserRoles(): Promise<any> {
    const res = await lastValueFrom(
      this.http.get<ApiResponse<any>>(`${this.baseUrl}/user/role/get`)
    );
    return this.unwrap(res);
  }

  async getUsersByTeam(teamId: string): Promise<any> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<any>>(`${this.baseUrl}/user/team/user/get`, {
        data: teamId,
      })
    );
    return this.unwrap(res);
  }

  async getUsersByBranch(branchId: number): Promise<any> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<any>>(
        `${this.baseUrl}/user/LoadBranchDDLByUserLoginId`,
        {
          longData1: branchId,
        }
      )
    );
    return this.unwrap(res);
  }

  // ==================== ROLE ENDPOINTS ====================

  async getRoleInitialData(): Promise<any> {
    const res = await lastValueFrom(
      this.http.get<ApiResponse<any>>(`${this.baseUrl}/role/initialize`)
    );
    return this.unwrap(res);
  }

  async getRoleSearchTemplate(): Promise<RoleSearchCriteria> {
    const res = await lastValueFrom(
      this.http.get<ApiResponse<RoleSearchCriteria>>(
        `${this.baseUrl}/role/search`
      )
    );
    return this.unwrap(res);
  }

  async searchRoles(criteria: RoleSearchCriteria): Promise<RoleSearchResult> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<RoleSearchResult>>(
        `${this.baseUrl}/role/search`,
        criteria
      )
    );
    return this.unwrap(res);
  }

  async createNewRole(): Promise<Role> {
    const res = await lastValueFrom(
      this.http.get<ApiResponse<Role>>(`${this.baseUrl}/role/new`)
    );
    return this.unwrap(res);
  }

  async openRole(roleId: number): Promise<Role> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<Role>>(`${this.baseUrl}/role/open`, {
        data: roleId,
      })
    );
    return this.unwrap(res);
  }

  async saveRole(role: Role): Promise<Role> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<Role>>(`${this.baseUrl}/role/save`, role)
    );
    return this.unwrap(res);
  }

  async deleteRole(roleId: number): Promise<Role> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<Role>>(`${this.baseUrl}/role/delete`, {
        data: roleId,
      })
    );
    return this.unwrap(res);
  }

  async loadRoleResources(roleId: number): Promise<any> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<any>>(
        `${this.baseUrl}/role/role-resource/load`,
        {
          stringparam: '',
          longparam: roleId,
        }
      )
    );
    return this.unwrap(res);
  }

  async saveRoleResources(roleData: any): Promise<any> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<any>>(
        `${this.baseUrl}/role/role-resource/save`,
        roleData
      )
    );
    return this.unwrap(res);
  }

  // ==================== RESOURCE ENDPOINTS ====================

  async getResourceInitialData(): Promise<any> {
    const res = await lastValueFrom(
      this.http.get<ApiResponse<any>>(`${this.baseUrl}/resource/initialize`)
    );
    return this.unwrap(res);
  }

  async getResourceSearchTemplate(): Promise<ResourceSearchCriteria> {
    const res = await lastValueFrom(
      this.http.get<ApiResponse<ResourceSearchCriteria>>(
        `${this.baseUrl}/resource/search`
      )
    );
    return this.unwrap(res);
  }

  async searchResources(
    criteria: ResourceSearchCriteria
  ): Promise<ResourceSearchResult> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<ResourceSearchResult>>(
        `${this.baseUrl}/resource/search`,
        criteria
      )
    );
    return this.unwrap(res);
  }

  async createNewResource(): Promise<Resource> {
    const res = await lastValueFrom(
      this.http.get<ApiResponse<Resource>>(`${this.baseUrl}/resource/new`)
    );
    return this.unwrap(res);
  }

  async openResource(resourceId: number): Promise<Resource> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<Resource>>(`${this.baseUrl}/resource/open`, {
        data: resourceId,
      })
    );
    return this.unwrap(res);
  }

  async saveResource(resource: Resource): Promise<Resource> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<Resource>>(
        `${this.baseUrl}/resource/save`,
        resource
      )
    );
    return this.unwrap(res);
  }

  async deleteResource(resourceId: number): Promise<Resource> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<Resource>>(
        `${this.baseUrl}/resource/delete`,
        {
          data: resourceId,
        }
      )
    );
    return this.unwrap(res);
  }

  async saveResourceList(resources: Resource[]): Promise<any> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<any>>(
        `${this.baseUrl}/resource/SaveListResource`,
        {
          lstentResource: resources,
        }
      )
    );
    return this.unwrap(res);
  }

  // ==================== BRANCH ENDPOINTS ====================

  async getBranchInitialData(): Promise<any> {
    const res = await lastValueFrom(
      this.http.get<ApiResponse<any>>(
        `${this.baseUrl}/MAsterConfig/Region/GetMaasterConfigInitialData`
      )
    );
    return this.unwrap(res);
  }

  async getBranchSearchTemplate(): Promise<BranchSearchCriteria> {
    const res = await lastValueFrom(
      this.http.get<ApiResponse<BranchSearchCriteria>>(
        `${this.baseUrl}/Branch/Branch/search`
      )
    );
    return this.unwrap(res);
  }

  async searchBranches(criteria: BranchSearchCriteria): Promise<BranchSearchResult> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<BranchSearchResult>>(
        `${this.baseUrl}/Branch/Branch/Search`,
        criteria
      )
    );
    return this.unwrap(res);
  }

  async createNewBranch(): Promise<Branch> {
    const res = await lastValueFrom(
      this.http.get<ApiResponse<Branch>>(`${this.baseUrl}/Branch/Branch/new`)
    );
    return this.unwrap(res);
  }

  async openBranch(branchId: number): Promise<Branch> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<Branch>>(`${this.baseUrl}/Branch/Branch/open`, {
        data: branchId,
      })
    );
    return this.unwrap(res);
  }

  async saveBranch(branch: Branch): Promise<Branch> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<Branch>>(
        `${this.baseUrl}/Branch/Branch/save`,
        branch
      )
    );
    return this.unwrap(res);
  }

  async deleteBranch(branchId: number): Promise<Branch> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<Branch>>(
        `${this.baseUrl}/Branch/Branch/delete`,
        {
          admBranchId: branchId,
        }
      )
    );
    return this.unwrap(res);
  }

  // ==================== AUDIT LOG ENDPOINTS ====================

  async getAuditLogSearchTemplate(): Promise<AuditLogSearchCriteria> {
    const res = await lastValueFrom(
      this.http.get<ApiResponse<AuditLogSearchCriteria>>(
        `${this.baseUrl}/auditlog/search`
      )
    );
    return this.unwrap(res);
  }

  async searchAuditLogs(criteria: AuditLogSearchCriteria): Promise<AuditLogSearchResult> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<AuditLogSearchResult>>(
        `${this.baseUrl}/auditlog/search`,
        criteria
      )
    );
    return this.unwrap(res);
  }

  async loadAuditLogDetails(auditLogId: number): Promise<AuditLog> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<AuditLog>>(
        `${this.baseUrl}/auditlog/LoadAuditLogDetails`,
        {
          data: auditLogId,
        }
      )
    );
    return this.unwrap(res);
  }

  // ==================== CONFIG ENDPOINTS ====================

  async getConfigSearchTemplate(): Promise<ConfigSearchCriteria> {
    const res = await lastValueFrom(
      this.http.get<ApiResponse<ConfigSearchCriteria>>(
        `${this.baseUrl}/config/search`
      )
    );
    return this.unwrap(res);
  }

  async searchConfigs(criteria: ConfigSearchCriteria): Promise<ConfigSearchResult> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<ConfigSearchResult>>(
        `${this.baseUrl}/config/search`,
        criteria
      )
    );
    return this.unwrap(res);
  }

  async openConfig(configId: number): Promise<Config> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<Config>>(`${this.baseUrl}/config/open`, {
        data: configId,
      })
    );
    return this.unwrap(res);
  }

  async saveConfig(config: Config): Promise<Config> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<Config>>(`${this.baseUrl}/config/save`, config)
    );
    return this.unwrap(res);
  }

  async loadConfigValuesByIds(configIds: string): Promise<any> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<any>>(`${this.baseUrl}/config/Load`, {
        data: configIds,
      })
    );
    return this.unwrap(res);
  }

  async deleteConfig(configId: number): Promise<Config> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<Config>>(`${this.baseUrl}/config/delete`, {
        data: configId,
      })
    );
    return this.unwrap(res);
  }

  // ==================== GROUP ENDPOINTS ====================

  async getGroupSearchTemplate(): Promise<GroupSearchCriteria> {
    const res = await lastValueFrom(
      this.http.get<ApiResponse<GroupSearchCriteria>>(
        `${this.baseUrl}/group/search`
      )
    );
    return this.unwrap(res);
  }

  async searchGroups(criteria: GroupSearchCriteria): Promise<GroupSearchResult> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<GroupSearchResult>>(
        `${this.baseUrl}/group/search`,
        criteria
      )
    );
    return this.unwrap(res);
  }

  async openGroup(groupId: number): Promise<Group> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<Group>>(`${this.baseUrl}/group/open`, {
        data: groupId,
      })
    );
    return this.unwrap(res);
  }

  async saveGroup(group: Group): Promise<Group> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<Group>>(`${this.baseUrl}/group/save`, group)
    );
    return this.unwrap(res);
  }

  async deleteGroup(groupId: number): Promise<Group> {
    const res = await lastValueFrom(
      this.http.post<ApiResponse<Group>>(`${this.baseUrl}/group/delete`, {
        data: groupId,
      })
    );
    return this.unwrap(res);
  }
}
