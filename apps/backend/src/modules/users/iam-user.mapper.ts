import { User } from '@prisma/client';

const statusLabels: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  LOCKED: 'Locked',
  PENDING: 'Pending',
  SUSPENDED: 'Suspended',
};

export interface IamUserListItemDto {
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
  status: string;
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

export interface IamUserRoleDto {
  id: string;
  roleId: string;
  roleName: string;
  roleKey: string;
  organizationId: string;
  assignedAt: string;
}

export interface IamUserGroupDto {
  id: string;
  groupId: string;
  groupName: string;
  groupSlug: string;
  groupType: string;
  joinedAt: string;
}

export interface IamUserDetailDto extends IamUserListItemDto {
  roles: IamUserRoleDto[];
  groups: IamUserGroupDto[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UserRow = User & {
  _count?: { roleAssignments?: number; userGroups?: number };
  roleAssignments?: Array<{
    id: string;
    roleId: string;
    organizationId: string;
    role: { id: string; name: string; key: string };
  }>;
  userGroups?: Array<{
    id: string;
    groupId: string;
    createdAt: Date;
    group: { id: string; name: string; slug: string; type: string };
  }>;
};

export class IamUserMapper {
  static toListItem(row: UserRow): IamUserListItemDto {
    return {
      id: row.id,
      email: row.email,
      username: row.username ?? null,
      fullName: row.fullName,
      firstName: row.firstName ?? null,
      lastName: row.lastName ?? null,
      avatarUrl: row.avatarUrl ?? null,
      mobile: row.mobile ?? null,
      department: row.department ?? null,
      jobTitle: row.jobTitle ?? null,
      status: row.status,
      statusLabel: statusLabels[row.status] ?? row.status,
      timezone: row.timezone ?? null,
      language: row.language,
      isAccountLocked: row.isAccountLocked,
      lastLoginDatetime: row.lastLoginDatetime?.toISOString() ?? null,
      emailVerified: row.emailVerified,
      roleCount: row._count?.roleAssignments ?? row.roleAssignments?.length ?? 0,
      groupCount: row._count?.userGroups ?? row.userGroups?.length ?? 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  static toDetail(row: UserRow): IamUserDetailDto {
    return {
      ...this.toListItem(row),
      roles: (row.roleAssignments ?? []).map((r) => ({
        id: r.id,
        roleId: r.roleId,
        roleName: r.role.name,
        roleKey: r.role.key,
        organizationId: r.organizationId,
        assignedAt: '',
      })),
      groups: (row.userGroups ?? []).map((g) => ({
        id: g.id,
        groupId: g.groupId,
        groupName: g.group.name,
        groupSlug: g.group.slug,
        groupType: g.group.type,
        joinedAt: g.createdAt.toISOString(),
      })),
    };
  }
}
