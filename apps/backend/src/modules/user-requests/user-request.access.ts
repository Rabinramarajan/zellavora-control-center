import { RequestPayload } from './user-request.dto';
import {
  RequestType,
  PRIVILEGED_PERMISSION_KEYS,
  PRIVILEGED_ROLE_KEYS,
} from './user-request.types';
import { UserRequestRepository } from './user-request.repository';

export interface AccessState {
  branchId: string | null;
  departmentId: string | null;
  teamIds: string[];
  groupIds: string[];
  roleIds: string[];
  accessScope: string | null;
}

export const EMPTY_ACCESS: AccessState = {
  branchId: null,
  departmentId: null,
  teamIds: [],
  groupIds: [],
  roleIds: [],
  accessScope: null,
};

const unique = (ids: string[]) => [...new Set(ids)];
const minus = (ids: string[], remove: string[]) => ids.filter((id) => !remove.includes(id));

/** Pure: the access a user will hold once the request is provisioned. */
export function applyRequest(
  current: AccessState,
  type: RequestType,
  payload: RequestPayload
): AccessState {
  const org = payload.organization;
  const access = payload.access;
  const next: AccessState = {
    ...current,
    teamIds: [...current.teamIds],
    groupIds: [...current.groupIds],
    roleIds: [...current.roleIds],
  };

  const changesOrganization = type === 'NEW_USER' || type === 'TRANSFER' || type === 'UPDATE_USER';
  if (changesOrganization) {
    if (org.branchId) next.branchId = org.branchId;
    if (org.departmentId) next.departmentId = org.departmentId;
    if (org.teamId) next.teamIds = [org.teamId];
    if (org.accessScope) next.accessScope = org.accessScope;
  }

  const allowsAdd = (kind: 'role' | 'group') =>
    type === 'NEW_USER' ||
    type === 'ACCESS_CHANGE' ||
    type === 'TRANSFER' ||
    type === (kind === 'role' ? 'ADD_ROLE' : 'ADD_GROUP');
  const allowsRemove = (kind: 'role' | 'group') =>
    type === 'ACCESS_CHANGE' ||
    type === 'TRANSFER' ||
    type === (kind === 'role' ? 'REMOVE_ROLE' : 'REMOVE_GROUP');

  if (allowsRemove('group')) next.groupIds = minus(next.groupIds, access.removeGroupIds);
  if (allowsAdd('group')) next.groupIds = unique([...next.groupIds, ...access.addGroupIds]);
  if (allowsRemove('role')) next.roleIds = minus(next.roleIds, access.removeRoleIds);
  if (allowsAdd('role')) next.roleIds = unique([...next.roleIds, ...access.addRoleIds]);
  return next;
}

export interface AccessCompareRow {
  key: string;
  label: string;
  current: string;
  requested: string;
  changed: boolean;
}

export interface PermissionPreviewRow {
  key: string;
  resource: string;
  permission: string;
  source: string;
  scope: string;
  current: boolean;
  requested: boolean;
  changed: boolean;
}

export interface AccessPreview {
  comparison: AccessCompareRow[];
  permissions: PermissionPreviewRow[];
  privileged: boolean;
}

const SCOPE_LABELS: Record<string, string> = {
  GLOBAL: 'Global',
  BRANCH: 'Branch',
  DEPARTMENT: 'Department',
  TEAM: 'Team',
  OWN: 'Own Records',
  ORG: 'Organization',
  RESOURCE: 'Resource',
};

export class AccessCalculator {
  constructor(private readonly repo: UserRequestRepository) {}

  async currentAccess(userId: string | null, organizationId: string): Promise<AccessState> {
    if (!userId) return { ...EMPTY_ACCESS };
    const user = await this.repo.findUserForRequest(userId, organizationId);
    if (!user) return { ...EMPTY_ACCESS };
    return {
      branchId: user.branchId,
      departmentId: user.userTenants[0]?.departmentId ?? null,
      teamIds: user.teams.map((t) => t.id),
      groupIds: user.userGroups.map((g) => g.groupId),
      roleIds: unique(user.roleAssignments.map((r) => r.roleId)),
      accessScope: null,
    };
  }

  async preview(current: AccessState, requested: AccessState): Promise<AccessPreview> {
    const groupIds = unique([...current.groupIds, ...requested.groupIds]);
    const groups = await this.repo.groupsWithRoles(groupIds);
    const groupRoleIds = groups.flatMap((g) => g.groupRoles.map((r) => r.roleId));
    const roles = await this.repo.rolesWithPermissions(
      unique([...current.roleIds, ...requested.roleIds, ...groupRoleIds])
    );
    const [branches, departments, teams] = await this.repo.namesFor({
      branchIds: [current.branchId, requested.branchId].filter((v): v is string => !!v),
      departmentIds: [current.departmentId, requested.departmentId].filter((v): v is string => !!v),
      teamIds: unique([...current.teamIds, ...requested.teamIds]),
    });

    const nameOf = (list: Array<{ id: string; name: string }>) => (id: string | null) =>
      (id && list.find((x) => x.id === id)?.name) || '—';
    const namesOf = (list: Array<{ id: string; name: string }>, ids: string[]) =>
      ids.length
        ? ids
            .map((id) => list.find((x) => x.id === id)?.name ?? id)
            .sort()
            .join(', ')
        : '—';
    const row = (key: string, label: string, cur: string, req: string): AccessCompareRow => ({
      key,
      label,
      current: cur,
      requested: req,
      changed: cur !== req,
    });

    const comparison: AccessCompareRow[] = [
      row(
        'branch',
        'Branch',
        nameOf(branches)(current.branchId),
        nameOf(branches)(requested.branchId)
      ),
      row(
        'department',
        'Department',
        nameOf(departments)(current.departmentId),
        nameOf(departments)(requested.departmentId)
      ),
      row('team', 'Team', namesOf(teams, current.teamIds), namesOf(teams, requested.teamIds)),
      row(
        'groups',
        'Groups',
        namesOf(groups, current.groupIds),
        namesOf(groups, requested.groupIds)
      ),
      row('roles', 'Roles', namesOf(roles, current.roleIds), namesOf(roles, requested.roleIds)),
    ];
    if (requested.accessScope || current.accessScope) {
      comparison.push(
        row(
          'scope',
          'Access Scope',
          SCOPE_LABELS[current.accessScope ?? ''] ?? '—',
          SCOPE_LABELS[requested.accessScope ?? ''] ?? '—'
        )
      );
    }

    const permissionsFor = (state: AccessState) => {
      const sources = new Map<
        string,
        { resource: string; action: string; sources: Set<string>; scopes: Set<string> }
      >();
      const grant = (roleId: string, via?: string) => {
        const role = roles.find((r) => r.id === roleId);
        if (!role) return;
        const label = via ? `${role.name} (via ${via})` : role.name;
        const scope =
          SCOPE_LABELS[state.accessScope ?? ''] ?? SCOPE_LABELS[role.scope] ?? role.scope;
        for (const { permission } of role.rolePermissions) {
          const [resource, ...rest] = permission.key.split(':');
          const entry = sources.get(permission.key) ?? {
            resource: permission.resource ?? resource,
            action: permission.action ?? rest.join(':'),
            sources: new Set<string>(),
            scopes: new Set<string>(),
          };
          entry.sources.add(label);
          entry.scopes.add(scope);
          sources.set(permission.key, entry);
        }
      };
      state.roleIds.forEach((id) => grant(id));
      for (const group of groups.filter((g) => state.groupIds.includes(g.id))) {
        group.groupRoles.forEach((gr) => grant(gr.roleId, group.name));
      }
      return sources;
    };

    const before = permissionsFor(current);
    const after = permissionsFor(requested);
    const keys = [...new Set([...before.keys(), ...after.keys()])].sort();
    const permissions = keys.map((key) => {
      const entry = after.get(key) ?? before.get(key)!;
      const inCurrent = before.has(key);
      const inRequested = after.has(key);
      return {
        key,
        resource: entry.resource,
        permission: entry.action,
        source: [...entry.sources].join(', '),
        scope: [...entry.scopes].join(', '),
        current: inCurrent,
        requested: inRequested,
        changed: inCurrent !== inRequested,
      };
    });

    const addedRoleIds = unique([
      ...requested.roleIds.filter((id) => !current.roleIds.includes(id)),
      ...groups
        .filter((g) => requested.groupIds.includes(g.id) && !current.groupIds.includes(g.id))
        .flatMap((g) => g.groupRoles.map((r) => r.roleId)),
    ]);
    const privileged = roles
      .filter((r) => addedRoleIds.includes(r.id))
      .some(
        (r) =>
          PRIVILEGED_ROLE_KEYS.has(r.key) ||
          r.rolePermissions.some(({ permission }) => PRIVILEGED_PERMISSION_KEYS.has(permission.key))
      );

    return { comparison, permissions, privileged };
  }
}
