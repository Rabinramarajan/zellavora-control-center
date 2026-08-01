// ============================================================================
// ZCC IAM Admin Console — Domain Models
// Covers Resources, Roles, Groups, Users (RBAC core).
// ============================================================================

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedList<T> {
  data: T[];
  meta: PaginationMeta;
}

// ============================================================================
// SHARED ENUMS
// ============================================================================

export type EntityStatus = 'ACTIVE' | 'INACTIVE';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'PENDING' | 'SUSPENDED';
export type GroupType = 'SECURITY' | 'ORG' | 'DISTRIBUTION' | 'PROJECT' | 'DYNAMIC';
export type ResourceType = 'API' | 'FEATURE' | 'DATA' | 'MENU' | 'REPORT' | 'INTEGRATION';
export type RoleScope = 'GLOBAL' | 'ORG' | 'RESOURCE';
export type PermissionEffect = 'allow' | 'deny';

// ============================================================================
// RESOURCES
// ============================================================================

export interface ResourceListItem {
  id: string;
  name: string;
  key: string;
  type: ResourceType;
  typeLabel: string;
  category: string | null;
  description: string | null;
  status: EntityStatus;
  parentId: string | null;
  ownerId: string | null;
  isSystem: boolean;
  actionCount: number;
  childCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceTreeNode extends ResourceListItem {
  children: ResourceTreeNode[];
}

export interface ResourceAction {
  id: string;
  action: string;
  permissionId: string | null;
  permissionKey: string | null;
}

export interface ResourceDetail extends ResourceListItem {
  metadata: Record<string, unknown> | null;
  actions: ResourceAction[];
  children: Array<{ id: string; name: string }>;
  parents: Array<{ id: string; name: string }>;
}

// ============================================================================
// ROLES
// ============================================================================

export interface RoleListItem {
  id: string;
  name: string;
  key: string;
  description: string | null;
  scope: RoleScope;
  status: EntityStatus;
  isSystem: boolean;
  organizationId: string | null;
  userCount: number;
  permissionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RolePermission {
  id: string;
  permissionId: string;
  permissionKey: string;
  permissionName: string;
  resource: string | null;
  action: string | null;
  effect: PermissionEffect;
}

export interface RoleDetail extends RoleListItem {
  permissions: RolePermission[];
}

export interface SetRolePermissionsRequest {
  permissions: Array<{ permissionId: string; effect: PermissionEffect }>;
  mode?: 'replace' | 'merge';
}

export interface CopyRoleRequest {
  name: string;
  description?: string | null;
  includePermissions?: boolean;
}

// ============================================================================
// GROUPS
// ============================================================================

export interface GroupListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: GroupType;
  typeLabel: string;
  status: EntityStatus;
  parentId: string | null;
  parentName: string | null;
  ownerId: string | null;
  isSystem: boolean;
  memberCount: number;
  roleCount: number;
  childCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GroupTreeNode extends GroupListItem {
  children: GroupTreeNode[];
}

export interface GroupMember {
  id: string;
  userId: string;
  email: string | null;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  status: string;
  joinedAt: string;
}

export interface GroupRole {
  id: string;
  roleId: string;
  roleName: string;
  roleKey: string;
  assignedAt: string;
}

export interface GroupDetail extends GroupListItem {
  children: Array<{ id: string; name: string; type: string }>;
  members: GroupMember[];
  roles: GroupRole[];
}

export interface AddGroupMembersRequest {
  userIds: string[];
}

export interface SetGroupRolesRequest {
  roleIds: string[];
  mode?: 'replace' | 'merge';
}

// ============================================================================
// USERS
// ============================================================================

export interface IamUserListItem {
  id: string;
  email: string;
  username: string | null;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  mobile: string | null;
  department: string | null;
  jobTitle: string | null;
  status: UserStatus;
  statusLabel: string;
  timezone: string | null;
  language: string;
  isAccountLocked: boolean;
  lastLoginDatetime: string | null;
  emailVerified: boolean;
  roleCount: number;
  groupCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface IamUserRole {
  id: string;
  roleId: string;
  roleName: string;
  roleKey: string;
  organizationId: string;
  assignedAt: string;
}

export interface IamUserGroup {
  id: string;
  groupId: string;
  groupName: string;
  groupSlug: string;
  groupType: string;
  joinedAt: string;
}

export interface IamUserDetail extends IamUserListItem {
  roles: IamUserRole[];
  groups: IamUserGroup[];
}

export interface CreateIamUserRequest {
  email: string;
  username?: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  mobile?: string;
  department?: string | null;
  jobTitle?: string | null;
  timezone?: string;
  language?: string;
  sendInvite?: boolean;
  roleIds?: string[];
  groupIds?: string[];
}

export interface UpdateIamUserRequest {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  mobile?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  timezone?: string | null;
  language?: string;
  status?: UserStatus;
}

export interface SetUserRolesRequest {
  roleIds: string[];
  mode?: 'replace' | 'merge';
  organizationId?: string;
}

export interface SetUserGroupsRequest {
  groupIds: string[];
  mode?: 'replace' | 'merge';
}

export interface SetUserStatusRequest {
  status: UserStatus;
  reason?: string | null;
}
