import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiDataService } from '../http/api-data.service';
import {
  ApiEnvelope,
  CopyRoleRequest,
  GroupDetail,
  GroupStats,
  SaveGroupRequest,
  GroupListItem,
  GroupTreeNode,
  IamUserDetail,
  IamUserListItem,
  PaginatedList,
  ResourceDetail,
  ResourceListItem,
  RoleDetail,
  RoleListItem,
  SetGroupRolesRequest,
  SetRolePermissionsRequest,
  SetUserGroupsRequest,
  SetUserRolesRequest,
  EntityStatus,
  ResourceType,
  RoleScope,
} from '../../shared/models/iam.model';

export interface IamListQuery {
  q?: string;
  page: number;
  pageSize: number;
  status?: string[];
  type?: string[];
  scope?: string[];
  roleId?: string;
  groupId?: string;
  department?: string;
  [key: string]: unknown;
}

export interface CreateResourceRequest {
  name: string;
  key: string;
  type?: ResourceType;
  category?: string | null;
  description?: string | null;
  parentId?: string | null;
  ownerId?: string | null;
  metadata?: Record<string, unknown> | null;
  actions?: Array<{ action: string }>;
}

export interface CreateRoleRequest {
  name: string;
  description?: string | null;
  scope?: RoleScope;
  status?: EntityStatus;
  isSystem?: boolean;
  organizationId?: string;
}

export interface PermissionListItem {
  id: string;
  name: string;
  key: string;
  resource: string | null;
  action: string | null;
  description: string | null;
}

/** Unwrap helper so stores only deal with the inner payload. */
export const unwrap = <T>(envelope: ApiEnvelope<T>): T => envelope.data;

@Injectable({ providedIn: 'root' })
export class IamApiService {
  private readonly apiData = inject(ApiDataService);

  // ---------------------------------------------------------------------------
  // Resources
  // ---------------------------------------------------------------------------

  listResources(query: IamListQuery): Observable<ApiEnvelope<PaginatedList<ResourceListItem>>> {
    return this.apiData.getData<ApiEnvelope<PaginatedList<ResourceListItem>>>(
      '/iam/resources',
      this.toParams(query)
    );
  }

  getResource(id: string): Observable<ApiEnvelope<ResourceDetail>> {
    return this.apiData.getData<ApiEnvelope<ResourceDetail>>(`/iam/resources/${id}`);
  }

  createResource(body: CreateResourceRequest): Observable<ApiEnvelope<ResourceDetail>> {
    return this.apiData.postData<ApiEnvelope<ResourceDetail>>('/iam/resources', body);
  }

  addResourceAction(id: string, body: { action: string }): Observable<ApiEnvelope<unknown>> {
    return this.apiData.postData<ApiEnvelope<unknown>>(`/iam/resources/${id}/actions`, body);
  }

  removeResourceAction(id: string, actionId: string): Observable<ApiEnvelope<unknown>> {
    return this.apiData.deleteData<ApiEnvelope<unknown>>(
      `/iam/resources/${id}/actions/${actionId}`
    );
  }

  deleteResource(id: string): Observable<ApiEnvelope<{ success: boolean }>> {
    return this.apiData.deleteData<ApiEnvelope<{ success: boolean }>>(`/iam/resources/${id}`);
  }

  // ---------------------------------------------------------------------------
  // Roles
  // ---------------------------------------------------------------------------

  listRoles(query: IamListQuery): Observable<ApiEnvelope<PaginatedList<RoleListItem>>> {
    return this.apiData.getData<ApiEnvelope<PaginatedList<RoleListItem>>>(
      '/iam/roles',
      this.toParams(query)
    );
  }

  /** Every permission key in the system (for the role permission matrix). */
  /** Every role, unpaginated (for pickers). */
  listAllRoles(): Observable<ApiEnvelope<RoleListItem[]>> {
    return this.apiData.getData<ApiEnvelope<RoleListItem[]>>('/iam/roles/all');
  }

  /** Every group as a nested tree (for pickers). */
  getGroupTree(): Observable<ApiEnvelope<GroupTreeNode[]>> {
    return this.apiData.getData<ApiEnvelope<GroupTreeNode[]>>('/iam/groups/tree');
  }

  listAllPermissions(): Observable<ApiEnvelope<PermissionListItem[]>> {
    return this.apiData.getData<ApiEnvelope<PermissionListItem[]>>('/permissions');
  }

  getRole(id: string): Observable<ApiEnvelope<RoleDetail>> {
    return this.apiData.getData<ApiEnvelope<RoleDetail>>(`/iam/roles/${id}`);
  }

  createRole(body: CreateRoleRequest): Observable<ApiEnvelope<RoleDetail>> {
    return this.apiData.postData<ApiEnvelope<RoleDetail>>('/iam/roles', body);
  }

  setRolePermissions(
    id: string,
    body: SetRolePermissionsRequest
  ): Observable<ApiEnvelope<unknown>> {
    return this.apiData.putData<ApiEnvelope<unknown>>(`/iam/roles/${id}/permissions`, body);
  }

  copyRole(id: string, body: CopyRoleRequest): Observable<ApiEnvelope<RoleDetail>> {
    return this.apiData.postData<ApiEnvelope<RoleDetail>>(`/iam/roles/${id}/copy`, body);
  }

  deleteRole(id: string): Observable<ApiEnvelope<{ success: boolean }>> {
    return this.apiData.deleteData<ApiEnvelope<{ success: boolean }>>(`/iam/roles/${id}`);
  }

  // ---------------------------------------------------------------------------
  // Groups
  // ---------------------------------------------------------------------------

  listGroups(query: IamListQuery): Observable<ApiEnvelope<PaginatedList<GroupListItem>>> {
    return this.apiData.getData<ApiEnvelope<PaginatedList<GroupListItem>>>(
      '/iam/groups',
      this.toParams(query)
    );
  }

  groupStats(): Observable<ApiEnvelope<GroupStats>> {
    return this.apiData.getData<ApiEnvelope<GroupStats>>('/iam/groups/stats');
  }

  createGroup(body: SaveGroupRequest): Observable<ApiEnvelope<GroupDetail>> {
    return this.apiData.postData<ApiEnvelope<GroupDetail>>('/iam/groups', body);
  }

  updateGroup(id: string, body: SaveGroupRequest): Observable<ApiEnvelope<GroupDetail>> {
    return this.apiData.patchData<ApiEnvelope<GroupDetail>>(`/iam/groups/${id}`, body);
  }

  getGroup(id: string): Observable<ApiEnvelope<GroupDetail>> {
    return this.apiData.getData<ApiEnvelope<GroupDetail>>(`/iam/groups/${id}`);
  }

  addGroupMembers(id: string, userIds: string[]): Observable<ApiEnvelope<GroupDetail>> {
    return this.apiData.postData<ApiEnvelope<GroupDetail>>(`/iam/groups/${id}/members`, {
      userIds,
    });
  }

  removeGroupMember(id: string, userId: string): Observable<ApiEnvelope<GroupDetail>> {
    return this.apiData.deleteData<ApiEnvelope<GroupDetail>>(`/iam/groups/${id}/members/${userId}`);
  }

  setGroupRoles(id: string, body: SetGroupRolesRequest): Observable<ApiEnvelope<GroupDetail>> {
    return this.apiData.putData<ApiEnvelope<GroupDetail>>(`/iam/groups/${id}/roles`, body);
  }

  deleteGroup(id: string): Observable<ApiEnvelope<{ success: boolean }>> {
    return this.apiData.deleteData<ApiEnvelope<{ success: boolean }>>(`/iam/groups/${id}`);
  }

  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------

  listIamUsers(query: IamListQuery): Observable<ApiEnvelope<PaginatedList<IamUserListItem>>> {
    return this.apiData.getData<ApiEnvelope<PaginatedList<IamUserListItem>>>(
      '/iam/users',
      this.toParams(query)
    );
  }

  getIamUser(id: string): Observable<ApiEnvelope<IamUserDetail>> {
    return this.apiData.getData<ApiEnvelope<IamUserDetail>>(`/iam/users/${id}`);
  }

  lockIamUser(id: string, reason?: string | null): Observable<ApiEnvelope<IamUserDetail>> {
    return this.apiData.postData<ApiEnvelope<IamUserDetail>>(`/iam/users/${id}/lock`, { reason });
  }

  unlockIamUser(id: string): Observable<ApiEnvelope<IamUserDetail>> {
    return this.apiData.postData<ApiEnvelope<IamUserDetail>>(`/iam/users/${id}/unlock`, {});
  }

  setIamUserRoles(id: string, body: SetUserRolesRequest): Observable<ApiEnvelope<IamUserDetail>> {
    return this.apiData.putData<ApiEnvelope<IamUserDetail>>(`/iam/users/${id}/roles`, body);
  }

  setIamUserGroups(id: string, body: SetUserGroupsRequest): Observable<ApiEnvelope<IamUserDetail>> {
    return this.apiData.putData<ApiEnvelope<IamUserDetail>>(`/iam/users/${id}/groups`, body);
  }

  getIamUserStats(): Observable<ApiEnvelope<{ total: number; byStatus: Record<string, number> }>> {
    return this.apiData.getData<ApiEnvelope<{ total: number; byStatus: Record<string, number> }>>(
      '/iam/users/stats'
    );
  }

  deleteIamUser(id: string): Observable<ApiEnvelope<{ success: boolean }>> {
    return this.apiData.deleteData<ApiEnvelope<{ success: boolean }>>(`/iam/users/${id}`);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private toParams(query: IamListQuery): Record<string, unknown> {
    const params: Record<string, unknown> = {
      page: query.page,
      pageSize: query.pageSize,
    };
    if (query.q) params['q'] = query.q;
    for (const key of [
      'status',
      'type',
      'scope',
      'resource',
      'permission',
      'roleId',
      'groupId',
      'parentId',
      'createdBy',
      'department',
      'name',
      'email',
      'mobile',
      'createdFrom',
      'createdTo',
      'updatedFrom',
      'updatedTo',
      'lastLoginFrom',
      'lastLoginTo',
      'sort',
      'order',
    ]) {
      const value = query[key];
      if (value !== undefined && value !== null && value !== '') {
        params[key] = value;
      }
    }
    return params;
  }
}
