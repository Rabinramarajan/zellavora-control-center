import { Group } from '@prisma/client';

const groupTypeLabels: Record<string, string> = {
  SECURITY: 'Security',
  ORG: 'Organization',
  DISTRIBUTION: 'Distribution',
  PROJECT: 'Project',
  DYNAMIC: 'Dynamic',
};

export interface GroupListItemDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: string;
  typeLabel: string;
  status: string;
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

export interface GroupMemberDto {
  id: string;
  userId: string;
  email: string | null;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  status: string;
  joinedAt: string;
}

export interface GroupRoleDto {
  id: string;
  roleId: string;
  roleName: string;
  roleKey: string;
  assignedAt: string;
}

export interface GroupDetailDto extends GroupListItemDto {
  children: Array<{ id: string; name: string; type: string }>;
  members: GroupMemberDto[];
  roles: GroupRoleDto[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GroupRow = Group & {
  parent?: { id: string; name: string } | null;
  children?: Array<{ id: string; name: string; type: string }>;
  members?: Array<{
    id: string;
    userId: string;
    createdAt: Date;
    user: {
      id: string;
      email: string;
      username: string | null;
      status: string;
      avatarUrl: string | null;
      firstName: string | null;
      lastName: string | null;
      fullName: string;
    };
  }>;
  groupRoles?: Array<{
    id: string;
    roleId: string;
    createdAt: Date;
    role: { id: string; name: string; key: string };
  }>;
  _count?: { children?: number; members?: number; groupRoles?: number };
};

export class GroupMapper {
  static toListItem(row: GroupRow): GroupListItemDto {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description ?? null,
      type: row.type,
      typeLabel: groupTypeLabels[row.type] ?? row.type,
      status: row.status,
      parentId: row.parentId ?? null,
      parentName: row.parent?.name ?? null,
      ownerId: row.ownerId ?? null,
      isSystem: row.isSystem,
      memberCount: row._count?.members ?? row.members?.length ?? 0,
      roleCount: row._count?.groupRoles ?? row.groupRoles?.length ?? 0,
      childCount: row._count?.children ?? row.children?.length ?? 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  static toDetail(row: GroupRow): GroupDetailDto {
    return {
      ...this.toListItem(row),
      children: row.children ?? [],
      members: (row.members ?? []).map((m) => ({
        id: m.id,
        userId: m.userId,
        email: m.user.email ?? null,
        username: m.user.username ?? null,
        fullName: m.user.fullName ?? null,
        avatarUrl: m.user.avatarUrl ?? null,
        status: m.user.status,
        joinedAt: m.createdAt.toISOString(),
      })),
      roles: (row.groupRoles ?? []).map((gr) => ({
        id: gr.id,
        roleId: gr.roleId,
        roleName: gr.role.name,
        roleKey: gr.role.key,
        assignedAt: gr.createdAt.toISOString(),
      })),
    };
  }
}
