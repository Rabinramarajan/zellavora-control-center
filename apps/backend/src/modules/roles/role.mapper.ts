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

export interface RoleDetailDto extends RoleListItemDto {
  permissions: RolePermissionDto[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RoleRow = Role & {
  _count?: { userAssignments?: number; rolePermissions?: number };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RoleRowWithPermissions = Role & {
  rolePermissions?: Array<RolePermission & { permission: Permission }>;
  _count?: { userAssignments?: number };
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
    };
  }
}
