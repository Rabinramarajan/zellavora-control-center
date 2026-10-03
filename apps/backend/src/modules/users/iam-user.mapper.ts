import { User } from '@prisma/client';
import { ACCOUNT_STATUS_LABELS, AccountStatus, accountStatusOf } from './account-status';

/** 236 → 'USR000236'. */
export const formatUserCode = (userNo: number | null | undefined): string | null =>
  userNo ? `USR${String(userNo).padStart(6, '0')}` : null;

export interface IamUserListItemDto {
  id: string;
  userCode: string | null;
  email: string;
  username: string | null;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  mobile: string | null;
  department: string | null;
  jobTitle: string | null;
  employeeCode: string | null;
  beginDate: string | null;
  endDate: string | null;
  userType: string | null;
  branchId: string | null;
  branchName: string | null;
  teamName: string | null;
  primaryGroup: string | null;
  status: string;
  accountStatus: AccountStatus;
  statusLabel: string;
  timezone: string | null;
  language: string;
  isAccountLocked: boolean;
  lastLoginDatetime: string | null;
  emailVerified: boolean;
  mfaEnabled: boolean;
  roleCount: number;
  primaryRole: { name: string; key: string } | null;
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

type UserRow = Omit<User, 'passwordHash'> & {
  passwordHash?: string | null;
  _count?: { roleAssignments?: number; userGroups?: number };
  teams?: Array<{ name: string }>;
  roleAssignments?: Array<{
    id?: string;
    roleId?: string;
    organizationId?: string;
    role: { id?: string; name: string; key: string };
  }>;
  userGroups?: Array<{
    id?: string;
    groupId?: string;
    createdAt?: Date;
    group: { id?: string; name: string; slug?: string; type?: string };
  }>;
};

export class IamUserMapper {
  static toListItem(row: UserRow, branchName: string | null = null): IamUserListItemDto {
    const accountStatus = accountStatusOf(row);
    return {
      id: row.id,
      userCode: formatUserCode(row.userNo),
      email: row.email,
      username: row.username ?? null,
      fullName: row.fullName,
      firstName: row.firstName ?? null,
      lastName: row.lastName ?? null,
      avatarUrl: row.avatarUrl ?? null,
      mobile: row.mobile ?? null,
      department: row.department ?? null,
      jobTitle: row.jobTitle ?? null,
      employeeCode: row.employeeCode ?? null,
      beginDate: row.joiningDate?.toISOString().slice(0, 10) ?? null,
      endDate: row.endDate?.toISOString().slice(0, 10) ?? null,
      userType: row.userType ?? null,
      branchId: row.branchId ?? null,
      branchName,
      teamName: row.teams?.[0]?.name ?? null,
      primaryGroup: row.userGroups?.[0]?.group.name ?? null,
      status: row.status,
      accountStatus,
      statusLabel: ACCOUNT_STATUS_LABELS[accountStatus],
      timezone: row.timezone ?? null,
      language: row.language,
      isAccountLocked: row.isAccountLocked,
      lastLoginDatetime: row.lastLoginDatetime?.toISOString() ?? null,
      emailVerified: row.emailVerified,
      mfaEnabled: row.mfaEnabled ?? false,
      roleCount: row._count?.roleAssignments ?? row.roleAssignments?.length ?? 0,
      primaryRole: row.roleAssignments?.[0]?.role
        ? { name: row.roleAssignments[0].role.name, key: row.roleAssignments[0].role.key }
        : null,
      groupCount: row._count?.userGroups ?? row.userGroups?.length ?? 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  static toDetail(row: UserRow, branchName: string | null = null): IamUserDetailDto {
    return {
      ...this.toListItem(row, branchName),
      roles: (row.roleAssignments ?? []).map((r) => ({
        id: r.id ?? '',
        roleId: r.roleId ?? r.role.id ?? '',
        roleName: r.role.name,
        roleKey: r.role.key,
        organizationId: r.organizationId ?? '',
        assignedAt: '',
      })),
      groups: (row.userGroups ?? []).map((g) => ({
        id: g.id ?? '',
        groupId: g.groupId ?? g.group.id ?? '',
        groupName: g.group.name,
        groupSlug: g.group.slug ?? '',
        groupType: g.group.type ?? '',
        joinedAt: g.createdAt?.toISOString() ?? '',
      })),
    };
  }
}
