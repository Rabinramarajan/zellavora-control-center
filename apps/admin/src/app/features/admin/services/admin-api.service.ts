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

  // ==================== USER ENDPOINTS ====================

  async getUserInitialData(): Promise<any> {
    return lastValueFrom(this.http.get(`${this.baseUrl}/user/initialize`));
  }

  async getUserSearchTemplate(): Promise<UserSearchCriteria> {
    return lastValueFrom(this.http.get<UserSearchCriteria>(`${this.baseUrl}/user/search`));
  }

  async searchUsers(criteria: UserSearchCriteria): Promise<UserSearchResult> {
    return lastValueFrom(
      this.http.post<UserSearchResult>(`${this.baseUrl}/user/search`, criteria)
    );
  }

  async createNewUser(): Promise<User> {
    return lastValueFrom(this.http.get<User>(`${this.baseUrl}/user/new`));
  }

  async openUser(userSerialId: number): Promise<User> {
    return lastValueFrom(
      this.http.post<User>(`${this.baseUrl}/user/open`, { data: userSerialId })
    );
  }

  async saveUser(user: User): Promise<User> {
    return lastValueFrom(this.http.post<User>(`${this.baseUrl}/user/save`, user));
  }

  async getUserRoles(): Promise<any> {
    return lastValueFrom(this.http.get(`${this.baseUrl}/user/role/get`));
  }

  async getUsersByTeam(teamId: string): Promise<any> {
    return lastValueFrom(
      this.http.post(`${this.baseUrl}/user/team/user/get`, { data: teamId })
    );
  }

  async getUsersByBranch(branchId: number): Promise<any> {
    return lastValueFrom(
      this.http.post(`${this.baseUrl}/user/LoadBranchDDLByUserLoginId`, {
        longData1: branchId,
      })
    );
  }

  // ==================== ROLE ENDPOINTS ====================

  async getRoleInitialData(): Promise<any> {
    return lastValueFrom(this.http.get(`${this.baseUrl}/role/initialize`));
  }

  async getRoleSearchTemplate(): Promise<RoleSearchCriteria> {
    return lastValueFrom(
      this.http.get<RoleSearchCriteria>(`${this.baseUrl}/role/search`)
    );
  }

  async searchRoles(criteria: RoleSearchCriteria): Promise<RoleSearchResult> {
    return lastValueFrom(
      this.http.post<RoleSearchResult>(`${this.baseUrl}/role/search`, criteria)
    );
  }

  async createNewRole(): Promise<Role> {
    return lastValueFrom(this.http.get<Role>(`${this.baseUrl}/role/new`));
  }

  async openRole(roleId: number): Promise<Role> {
    return lastValueFrom(
      this.http.post<Role>(`${this.baseUrl}/role/open`, { data: roleId })
    );
  }

  async saveRole(role: Role): Promise<Role> {
    return lastValueFrom(this.http.post<Role>(`${this.baseUrl}/role/save`, role));
  }

  async deleteRole(roleId: number): Promise<Role> {
    return lastValueFrom(
      this.http.post<Role>(`${this.baseUrl}/role/delete`, { data: roleId })
    );
  }

  async loadRoleResources(roleId: number): Promise<any> {
    return lastValueFrom(
      this.http.post(`${this.baseUrl}/role/role-resource/load`, {
        stringparam: '',
        longparam: roleId,
      })
    );
  }

  async saveRoleResources(roleData: any): Promise<any> {
    return lastValueFrom(
      this.http.post(`${this.baseUrl}/role/role-resource/save`, roleData)
    );
  }

  // ==================== RESOURCE ENDPOINTS ====================

  async getResourceInitialData(): Promise<any> {
    return lastValueFrom(this.http.get(`${this.baseUrl}/resource/initialize`));
  }

  async getResourceSearchTemplate(): Promise<ResourceSearchCriteria> {
    return lastValueFrom(
      this.http.get<ResourceSearchCriteria>(`${this.baseUrl}/resource/search`)
    );
  }

  async searchResources(
    criteria: ResourceSearchCriteria
  ): Promise<ResourceSearchResult> {
    return lastValueFrom(
      this.http.post<ResourceSearchResult>(
        `${this.baseUrl}/resource/search`,
        criteria
      )
    );
  }

  async createNewResource(): Promise<Resource> {
    return lastValueFrom(this.http.get<Resource>(`${this.baseUrl}/resource/new`));
  }

  async openResource(resourceId: number): Promise<Resource> {
    return lastValueFrom(
      this.http.post<Resource>(`${this.baseUrl}/resource/open`, {
        data: resourceId,
      })
    );
  }

  async saveResource(resource: Resource): Promise<Resource> {
    return lastValueFrom(
      this.http.post<Resource>(`${this.baseUrl}/resource/save`, resource)
    );
  }

  async deleteResource(resourceId: number): Promise<Resource> {
    return lastValueFrom(
      this.http.post<Resource>(`${this.baseUrl}/resource/delete`, {
        data: resourceId,
      })
    );
  }

  async saveResourceList(resources: Resource[]): Promise<any> {
    return lastValueFrom(
      this.http.post(`${this.baseUrl}/resource/SaveListResource`, {
        lstentResource: resources,
      })
    );
  }

  // ==================== BRANCH ENDPOINTS ====================

  async getBranchInitialData(): Promise<any> {
    return lastValueFrom(
      this.http.get(
        `${this.baseUrl}/MAsterConfig/Region/GetMaasterConfigInitialData`
      )
    );
  }

  async getBranchSearchTemplate(): Promise<BranchSearchCriteria> {
    return lastValueFrom(
      this.http.get<BranchSearchCriteria>(`${this.baseUrl}/Branch/Branch/search`)
    );
  }

  async searchBranches(criteria: BranchSearchCriteria): Promise<BranchSearchResult> {
    return lastValueFrom(
      this.http.post<BranchSearchResult>(
        `${this.baseUrl}/Branch/Branch/Search`,
        criteria
      )
    );
  }

  async createNewBranch(): Promise<Branch> {
    return lastValueFrom(this.http.get<Branch>(`${this.baseUrl}/Branch/Branch/new`));
  }

  async openBranch(branchId: number): Promise<Branch> {
    return lastValueFrom(
      this.http.post<Branch>(`${this.baseUrl}/Branch/Branch/open`, {
        data: branchId,
      })
    );
  }

  async saveBranch(branch: Branch): Promise<Branch> {
    return lastValueFrom(
      this.http.post<Branch>(`${this.baseUrl}/Branch/Branch/save`, branch)
    );
  }

  async deleteBranch(branchId: number): Promise<Branch> {
    return lastValueFrom(
      this.http.post<Branch>(`${this.baseUrl}/Branch/Branch/delete`, {
        admBranchId: branchId,
      })
    );
  }

  // ==================== AUDIT LOG ENDPOINTS ====================

  async getAuditLogSearchTemplate(): Promise<AuditLogSearchCriteria> {
    return lastValueFrom(
      this.http.get<AuditLogSearchCriteria>(`${this.baseUrl}/auditlog/search`)
    );
  }

  async searchAuditLogs(criteria: AuditLogSearchCriteria): Promise<AuditLogSearchResult> {
    return lastValueFrom(
      this.http.post<AuditLogSearchResult>(`${this.baseUrl}/auditlog/search`, criteria)
    );
  }

  async loadAuditLogDetails(auditLogId: number): Promise<AuditLog> {
    return lastValueFrom(
      this.http.post<AuditLog>(`${this.baseUrl}/auditlog/LoadAuditLogDetails`, {
        data: auditLogId,
      })
    );
  }

  // ==================== CONFIG ENDPOINTS ====================

  async getConfigSearchTemplate(): Promise<ConfigSearchCriteria> {
    return lastValueFrom(
      this.http.get<ConfigSearchCriteria>(`${this.baseUrl}/config/search`)
    );
  }

  async searchConfigs(criteria: ConfigSearchCriteria): Promise<ConfigSearchResult> {
    return lastValueFrom(
      this.http.post<ConfigSearchResult>(`${this.baseUrl}/config/search`, criteria)
    );
  }

  async openConfig(configId: number): Promise<Config> {
    return lastValueFrom(
      this.http.post<Config>(`${this.baseUrl}/config/open`, { data: configId })
    );
  }

  async saveConfig(config: Config): Promise<Config> {
    return lastValueFrom(this.http.post<Config>(`${this.baseUrl}/config/save`, config));
  }

  async loadConfigValuesByIds(configIds: string): Promise<any> {
    return lastValueFrom(
      this.http.post(`${this.baseUrl}/config/Load`, { data: configIds })
    );
  }

  async deleteConfig(configId: number): Promise<Config> {
    return lastValueFrom(
      this.http.post<Config>(`${this.baseUrl}/config/delete`, {
        data: configId,
      })
    );
  }

  // ==================== GROUP ENDPOINTS ====================

  async getGroupSearchTemplate(): Promise<GroupSearchCriteria> {
    return lastValueFrom(
      this.http.get<GroupSearchCriteria>(`${this.baseUrl}/group/search`)
    );
  }

  async searchGroups(criteria: GroupSearchCriteria): Promise<GroupSearchResult> {
    return lastValueFrom(
      this.http.post<GroupSearchResult>(`${this.baseUrl}/group/search`, criteria)
    );
  }

  async openGroup(groupId: number): Promise<Group> {
    return lastValueFrom(
      this.http.post<Group>(`${this.baseUrl}/group/open`, { data: groupId })
    );
  }

  async saveGroup(group: Group): Promise<Group> {
    return lastValueFrom(this.http.post<Group>(`${this.baseUrl}/group/save`, group));
  }

  async deleteGroup(groupId: number): Promise<Group> {
    return lastValueFrom(
      this.http.post<Group>(`${this.baseUrl}/group/delete`, { data: groupId })
    );
  }
}
