/**
 * RbacService — facade for the admin UI to call role/permission/assignment
 * management endpoints. All mutations go through this and trigger policy
 * re-resolution on the server (the next call from the client gets the
 * updated policy via /me/policy or the policy-version interceptor).
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import type { Permission, PermissionGroup } from '../models/permission.model';
import type { Role, RoleAssignment, RolePermission } from '../models/role.model';
import { PermissionService } from './permission.service';

@Injectable({ providedIn: 'root' })
export class RbacService {
  private http = inject(HttpClient);
  private perms = inject(PermissionService);

  // ---------- Permissions ----------

  listPermissions(filter?: { type?: string; groupId?: string }): Promise<Permission[]> {
    return firstValueFrom(
      this.http.get<{ data: Permission[] }>('/api/v1/rbac/permissions', { params: filter as any })
    ).then(r => r.data);
  }

  listPermissionGroups(): Promise<PermissionGroup[]> {
    return firstValueFrom(
      this.http.get<{ data: PermissionGroup[] }>('/api/v1/rbac/permissions/groups')
    ).then(r => r.data);
  }

  // ---------- Roles ----------

  listRoles(): Promise<Role[]> {
    return firstValueFrom(
      this.http.get<{ data: Role[] }>('/api/v1/rbac/roles')
    ).then(r => r.data);
  }

  getRole(id: string): Promise<Role> {
    return firstValueFrom(
      this.http.get<{ data: Role }>(`/api/v1/rbac/roles/${id}`)
    ).then(r => r.data);
  }

  createRole(input: {
    key: string;
    label: string;
    description?: string;
    level?: number;
    color?: string;
    inheritsFrom?: string[];
    permissions?: RolePermission[];
  }): Promise<Role> {
    return firstValueFrom(
      this.http.post<{ data: Role }>('/api/v1/rbac/roles', input)
    ).then(r => r.data);
  }

  updateRole(id: string, patch: Partial<Role>): Promise<Role> {
    return firstValueFrom(
      this.http.patch<{ data: Role }>(`/api/v1/rbac/roles/${id}`, patch)
    ).then(r => r.data);
  }

  deleteRole(id: string): Promise<void> {
    return firstValueFrom(this.http.delete(`/api/v1/rbac/roles/${id}`)).then(() => undefined);
  }

  setRolePermissions(id: string, permissions: RolePermission[]): Promise<void> {
    return firstValueFrom(
      this.http.put(`/api/v1/rbac/roles/${id}/permissions`, { permissions })
    ).then(() => undefined);
  }

  setRoleInheritance(id: string, parentIds: string[]): Promise<void> {
    return firstValueFrom(
      this.http.put(`/api/v1/rbac/roles/${id}/inheritance`, { parents: parentIds })
    ).then(() => undefined);
  }

  cloneRole(id: string, key: string, label: string): Promise<Role> {
    return firstValueFrom(
      this.http.post<{ data: Role }>(`/api/v1/rbac/roles/${id}/clone`, { key, label })
    ).then(r => r.data);
  }

  // ---------- User assignments ----------

  listUserRoles(userId: string): Promise<RoleAssignment[]> {
    return firstValueFrom(
      this.http.get<{ data: RoleAssignment[] }>(`/api/v1/rbac/users/${userId}/roles`)
    ).then(r => r.data);
  }

  assignRole(
    userId: string,
    roleId: string,
    options?: { resourceType?: string; resourceId?: string; validUntil?: string }
  ): Promise<RoleAssignment> {
    return firstValueFrom(
      this.http.post<{ data: RoleAssignment }>(`/api/v1/rbac/users/${userId}/roles`, {
        roleId,
        ...options
      })
    ).then(r => r.data);
  }

  revokeRole(userId: string, assignmentId: string, reason?: string): Promise<void> {
    return firstValueFrom(
      this.http.delete(`/api/v1/rbac/users/${userId}/roles/${assignmentId}`, {
        body: { reason }
      })
    ).then(() => undefined);
  }

  // ---------- Re-exports for convenience ----------

  can = (perm: string) => this.perms.can(perm);
  canSync = (perm: string) => this.perms.canSync(perm);
  hasRole = (roleKey: string) => this.perms.hasRole(roleKey);
  hasFeature = (feature: string) => this.perms.hasFeature(feature);
}
