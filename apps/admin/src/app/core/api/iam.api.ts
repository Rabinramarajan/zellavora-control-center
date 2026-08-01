import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiDataService } from '@core/http/api-data.service';
import {
  ApiEnvelope,
  CopyRoleRequest,
  CreateIamUserRequest,
  GroupDetail,
  GroupListItem,
  GroupTreeNode,
  IamUserDetail,
  IamUserListItem,
  PaginatedList,
  ResourceDetail,
  ResourceListItem,
  ResourceTreeNode,
  RoleDetail,
  RoleListItem,
  SetGroupRolesRequest,
  SetRolePermissionsRequest,
  SetUserGroupsRequest,
  SetUserRolesRequest,
  SetUserStatusRequest,
  UpdateIamUserRequest,
  AddGroupMembersRequest,
  UserStatus,
  EntityStatus,
  GroupType,
  ResourceType,
  RoleScope,
  PermissionEffect,
} from '@shared/models/iam.model';

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

export interface UpdateResourceRequest {
  name?: string;
  category?: string | null;
  description?: string | null;
  parentId?: string | null;
  ownerId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CreateRoleRequest {
  name: string;
  description?: string | null;
  scope?: RoleScope;
  status?: EntityStatus;
  isSystem?: boolean;
  organizationId?: string;
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string | null;
  status?: EntityStatus;
}

export interface CreateGroupRequest {
  name: string;
  description?: string | null;
  type?: GroupType;
  status?: EntityStatus;
  parentId?: string | null;
  ownerId?: string | null;
  memberIds?: string[];
  roleIds?: string[];
}

export interface UpdateGroupRequest {
  name?: string;
  description?: string | null;
  status?: EntityStatus;
  parentId?: string | null;
  ownerId?: string | null;
}

export interface SetStatusRequest {
  status: UserStatus;
  reason?: string | null;
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
    return this.apiData.getData<ApiEnvelope<PaginatedList<ResourceListItem>>>('/iam/resources', this.toParams(query));
  }

  getResourceTree(): Observable<ApiEnvelope<ResourceTreeNode[]>> {
    return this.apiData.getData<ApiEnvelope<ResourceTreeNode[]>>('/iam/resources/tree');
  }

  getResource(id: string): Observable<ApiEnvelope<ResourceDetail>> {
    return this.apiData.getData<ApiEnvelope<ResourceDetail>>(`/iam/resources/${id}`);
  }

  createResource(body: CreateResourceRequest): Observable<ApiEnvelope<ResourceDetail>> {
    return this.apiData.postData<ApiEnvelope<ResourceDetail>>('/iam/resources', body);
  }

  updateResource(id: string, body: UpdateResourceRequest): Observable<ApiEnvelope<ResourceDetail>> {
    return this.apiData.putData<ApiEnvelope<ResourceDetail>>(`/iam/resources/${id}`, body);
  }

  addResourceAction(id: string, body: { action: string }): Observable<ApiEnvelope<unknown>> {
    return this.apiData.postData<ApiEnvelope<unknown>>(`/iam/resources/${id}/actions`, body);
  }

  removeResourceAction(id: string, actionId: string): Observable<ApiEnvelope<unknown>> {
    return this.apiData.deleteData<ApiEnvelope<unknown>>(`/iam/resources/${id}/actions/${actionId}`);
  }

  deleteResource(id: string): Observable<ApiEnvelope<{ success: boolean }>> {
    return this.apiData.deleteData<ApiEnvelope<{ success: boolean }>>(`/iam/resources/${id}`);
  }

  // ---------------------------------------------------------------------------
  // Roles
  // ---------------------------------------------------------------------------

  listRoles(query: IamListQuery): Observable<ApiEnvelope<PaginatedList<RoleListItem>>> {
    return this.apiData.getData<ApiEnvelope<PaginatedList<RoleListItem>>>('/iam/roles', this.toParams(query));
  }

  listAllRoles(): Observable<ApiEnvelope<RoleListItem[]>> {
    return this.apiData.getData<ApiEnvelope<RoleListItem[]>>('/iam/roles/all');
  }

  /** Every permission key in the system (for the role permission matrix). */
  listAllPermissions(): Observable<ApiEnvelope<PermissionListItem[]>> {
    return this.apiData.getData<ApiEnvelope<PermissionListItem[]>>('/clean/permissions');
  }

  getRole(id: string): Observable<ApiEnvelope<RoleDetail>> {
    return this.apiData.getData<ApiEnvelope<RoleDetail>>(`/iam/roles/${id}`);
  }

  createRole(body: CreateRoleRequest): Observable<ApiEnvelope<RoleDetail>> {
    return this.apiData.postData<ApiEnvelope<RoleDetail>>('/iam/roles', body);
  }

  updateRole(id: string, body: UpdateRoleRequest): Observable<ApiEnvelope<RoleDetail>> {
    return this.apiData.putData<ApiEnvelope<RoleDetail>>(`/iam/roles/${id}`, body);
  }

  setRolePermissions(id: string, body: SetRolePermissionsRequest): Observable<ApiEnvelope<unknown>> {
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
    return this.apiData.getData<ApiEnvelope<PaginatedList<GroupListItem>>>('/iam/groups', this.toParams(query));
  }

  getGroupTree(): Observable<ApiEnvelope<GroupTreeNode[]>> {
    return this.apiData.getData<ApiEnvelope<GroupTreeNode[]>>('/iam/groups/tree');
  }

  getGroup(id: string): Observable<ApiEnvelope<GroupDetail>> {
    return this.apiData.getData<ApiEnvelope<GroupDetail>>(`/iam/groups/${id}`);
  }

  createGroup(body: CreateGroupRequest): Observable<ApiEnvelope<GroupDetail>> {
    return this.apiData.postData<ApiEnvelope<GroupDetail>>('/iam/groups', body);
  }

  updateGroup(id: string, body: UpdateGroupRequest): Observable<ApiEnvelope<GroupDetail>> {
    return this.apiData.putData<ApiEnvelope<GroupDetail>>(`/iam/groups/${id}`, body);
  }

  addGroupMembers(id: string, body: AddGroupMembersRequest): Observable<ApiEnvelope<GroupDetail>> {
    return this.apiData.postData<ApiEnvelope<GroupDetail>>(`/iam/groups/${id}/members`, body);
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
    return this.apiData.getData<ApiEnvelope<PaginatedList<IamUserListItem>>>('/iam/users', this.toParams(query));
  }

  getIamUser(id: string): Observable<ApiEnvelope<IamUserDetail>> {
    return this.apiData.getData<ApiEnvelope<IamUserDetail>>(`/iam/users/${id}`);
  }

  createIamUser(body: CreateIamUserRequest): Observable<ApiEnvelope<IamUserDetail>> {
    return this.apiData.postData<ApiEnvelope<IamUserDetail>>('/iam/users', body);
  }

  updateIamUser(id: string, body: UpdateIamUserRequest): Observable<ApiEnvelope<IamUserDetail>> {
    return this.apiData.putData<ApiEnvelope<IamUserDetail>>(`/iam/users/${id}`, body);
  }

  setIamUserStatus(id: string, body: SetStatusRequest): Observable<ApiEnvelope<IamUserDetail>> {
    return this.apiData.putData<ApiEnvelope<IamUserDetail>>(`/iam/users/${id}/status`, body);
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
      'roleId',
      'groupId',
      'department',
    ]) {
      const value = query[key];
      if (value !== undefined && value !== null && value !== '') {
        params[key] = value;
      }
    }
    return params;
  }
}
