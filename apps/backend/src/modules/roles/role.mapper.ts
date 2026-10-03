import { Role, RolePermission, Permission } from '@prisma/client';

export interface RoleListItemDto {
  id: string;
  name: string;
  key: string;
  description: string | null;
  scope: string;
  status: string;
  isSystem: boolean;
  organizationId: string | null;
  userCount: number;
  groupCount: number;
  permissionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RolePermissionDto {
  id: string;
  permissionId: string;
  permissionKey: string;
  permissionName: string;
  resource: string | null;
  action: string | null;
  effect: 'allow' | 'deny';
}

export interface RoleGroupDto {
  groupId: string;
  name: string;
  type: string;
  status: string;
  memberCount: number;
  assignedAt: string;
}

export interface RoleUserDto {
  userId: string;
  fullName: string;
  email: string;
  employeeCode: string | null;
  status: string;
  assignedAt: string;
}

export interface RoleDetailDto extends RoleListItemDto {
  permissions: RolePermissionDto[];
  groups: RoleGroupDto[];
  users: RoleUserDto[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RoleRow = Role & {
  _count?: { userAssignments?: number; rolePermissions?: number; groupRoles?: number };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RoleRowWithPermissions = RoleRow & {
  rolePermissions?: Array<RolePermission & { permission: Permission }>;
  groupRoles?: Array<{
    createdAt: Date;
    group: { id: string; name: string; type: string; status: string; _count: { members: number } };
  }>;
  userAssignments?: Array<{
    createdAt: Date;
    user: {
      id: string;
      fullName: string;
      email: string;
      employeeCode: string | null;
      status: string;
    };
  }>;
};

export class RoleMapper {
  static toListItem(row: RoleRow): RoleListItemDto {
    return {
      id: row.id,
      name: row.name,
      key: row.key,
      description: row.description ?? null,
      scope: row.scope,
      status: row.status,
      isSystem: row.isSystem,
      organizationId: row.organizationId ?? null,
      userCount: row._count?.userAssignments ?? 0,
      groupCount: row._count?.groupRoles ?? 0,
      permissionCount: row._count?.rolePermissions ?? 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  static toDetail(row: RoleRowWithPermissions): RoleDetailDto {
    return {
      ...this.toListItem(row),
      permissions: (row.rolePermissions ?? []).map((rp) => ({
        id: rp.id,
        permissionId: rp.permissionId,
        permissionKey: rp.permission.key,
        permissionName: rp.permission.name,
        resource: rp.permission.resource ?? null,
        action: rp.permission.action ?? null,
        effect: rp.effect as 'allow' | 'deny',
      })),
      groups: (row.groupRoles ?? []).map((gr) => ({
        groupId: gr.group.id,
        name: gr.group.name,
        type: gr.group.type,
        status: gr.group.status,
        memberCount: gr.group._count.members,
        assignedAt: gr.createdAt.toISOString(),
      })),
      // A user can hold the role in several organizations; list each person once.
      users: [...new Map((row.userAssignments ?? []).map((ua) => [ua.user.id, ua])).values()].map(
        (ua) => ({
          userId: ua.user.id,
          fullName: ua.user.fullName,
          email: ua.user.email,
          employeeCode: ua.user.employeeCode,
          status: ua.user.status,
          assignedAt: ua.createdAt.toISOString(),
        })
      ),
    };
  }
}
