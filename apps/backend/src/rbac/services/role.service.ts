/**
 * Role service — business logic for role CRUD, permission assignment,
 * inheritance, and cloning. Wraps the Supabase client and emits audit
 * events for every mutation.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuditService } from './audit.service';
import type { PermissionEngine } from '../engine/permission-engine';
import { wouldCreateCycle } from '../engine/inheritance';

export interface CreateRoleInput {
  key: string;
  label: string;
  description?: string;
  level?: number;
  color?: string;
  inheritsFrom?: string[];
  permissions?: Array<{ key: string; effect: 'allow' | 'deny' }>;
}

export class RoleService {
  constructor(
    private db: SupabaseClient,
    private audit: AuditService,
    private engine: PermissionEngine
  ) {}

  // ---------- Read ----------

  async listPermissionGroups() {
    const { data } = await this.db
      .from('permission_groups')
      .select('*')
      .order('sort_order', { ascending: true });
    return data ?? [];
  }

  async listPermissions(filter: { type?: string; groupId?: string } = {}) {
    let q = this.db.from('permissions').select('*, group:permission_groups(*)');
    if (filter.type) q = q.eq('type', filter.type);
    if (filter.groupId) q = q.eq('group_id', filter.groupId);
    const { data } = await q.order('label', { ascending: true });
    return data ?? [];
  }

  async list(orgId: string) {
    const { data } = await this.db
      .from('roles')
      .select('*')
      .or(`organization_id.is.null,organization_id.eq.${orgId}`)
      .order('level', { ascending: false });
    return data ?? [];
  }

  async getDetail(roleId: string) {
    const { data: role, error } = await this.db.from('roles').select('*').eq('id', roleId).single();
    if (error || !role) throw Object.assign(new Error('Role not found'), { status: 404 });

    const [{ data: perms }, { data: parents }, { data: children }] = await Promise.all([
      this.db
        .from('role_permissions')
        .select('effect, permissions!inner(key, label, type)')
        .eq('role_id', roleId),
      this.db
        .from('role_inheritance')
        .select('parent_role_id, roles!role_inheritance_parent_role_id_fkey(id, key, label, level)')
        .eq('role_id', roleId),
      this.db
        .from('role_inheritance')
        .select('role_id, roles!role_inheritance_role_id_fkey(id, key, label, level)')
        .eq('parent_role_id', roleId),
    ]);

    return {
      ...role,
      permissions: (perms ?? []).map((p) => ({
        key: (p as any).permissions.key,
        label: (p as any).permissions.label,
        type: (p as any).permissions.type,
        effect: p.effect,
      })),
      inheritsFrom: (parents ?? []).map((p) => (p as any).roles),
      inheritedBy: (children ?? []).map((c) => (c as any).roles),
    };
  }

  // ---------- Create ----------

  async create(orgId: string, input: CreateRoleInput, actorId: string) {
    // 1. Insert role
    const { data: role, error } = await this.db
      .from('roles')
      .insert({
        organization_id: orgId,
        key: input.key,
        label: input.label,
        description: input.description,
        level: input.level ?? 0,
        color: input.color,
        is_system: false,
      })
      .select()
      .single();
    if (error || !role) throw new Error(`Create role failed: ${error?.message}`);

    // 2. Permissions
    if (input.permissions && input.permissions.length > 0) {
      await this.setPermissionsInternal(role.id, input.permissions, actorId);
    }

    // 3. Inheritance
    if (input.inheritsFrom && input.inheritsFrom.length > 0) {
      await this.setInheritanceInternal(role.id, input.inheritsFrom, actorId);
    }

    await this.audit.log({
      organizationId: orgId,
      actorId,
      action: 'role.create',
      resourceType: 'role',
      resourceId: role.id,
      newValues: role,
      description: `Created role ${role.key}`,
    });

    await this.engine.invalidateOrg(orgId);
    return this.getDetail(role.id);
  }

  // ---------- Update ----------

  async update(roleId: string, patch: Partial<CreateRoleInput>, actorId: string) {
    const { data: before } = await this.db.from('roles').select('*').eq('id', roleId).single();

    const { data: role, error } = await this.db
      .from('roles')
      .update({
        key: patch.key,
        label: patch.label,
        description: patch.description,
        level: patch.level,
        color: patch.color,
      })
      .eq('id', roleId)
      .select()
      .single();
    if (error || !role) throw new Error(`Update role failed: ${error?.message}`);

    if (patch.inheritsFrom) {
      await this.setInheritanceInternal(roleId, patch.inheritsFrom, actorId);
    }
    if (patch.permissions) {
      await this.setPermissionsInternal(roleId, patch.permissions, actorId);
    }

    await this.audit.log({
      organizationId: before?.organization_id,
      actorId,
      action: 'role.update',
      resourceType: 'role',
      resourceId: roleId,
      oldValues: before,
      newValues: role,
    });

    await this.engine.invalidateOrg(before?.organization_id);
    return this.getDetail(roleId);
  }

  // ---------- Delete ----------

  async delete(roleId: string, actorId: string) {
    const { data: before } = await this.db.from('roles').select('*').eq('id', roleId).single();
    if (!before) throw Object.assign(new Error('Not found'), { status: 404 });
    if (before.is_system) {
      throw Object.assign(new Error('System roles cannot be deleted'), { status: 400 });
    }

    // Reject if any user is currently assigned
    const { count } = await this.db
      .from('user_roles')
      .select('id', { count: 'exact', head: true })
      .eq('role_id', roleId)
      .eq('status', 'active');
    if (count && count > 0) {
      throw Object.assign(new Error(`Role is assigned to ${count} user(s); revoke first`), {
        status: 409,
      });
    }

    const { error } = await this.db.from('roles').delete().eq('id', roleId);
    if (error) throw new Error(`Delete failed: ${error.message}`);

    await this.audit.log({
      organizationId: before.organization_id,
      actorId,
      action: 'role.delete',
      resourceType: 'role',
      resourceId: roleId,
      oldValues: before,
    });

    await this.engine.invalidateOrg(before.organization_id);
  }

  // ---------- Permissions ----------

  async setPermissions(
    roleId: string,
    perms: Array<{ key: string; effect: 'allow' | 'deny' }>,
    actorId: string
  ) {
    const { data: role } = await this.db
      .from('roles')
      .select('organization_id')
      .eq('id', roleId)
      .single();
    if (!role) throw Object.assign(new Error('Not found'), { status: 404 });

    await this.setPermissionsInternal(roleId, perms, actorId);

    await this.audit.log({
      organizationId: role.organization_id,
      actorId,
      action: 'role.permission.set',
      resourceType: 'role',
      resourceId: roleId,
      newValues: { permissions: perms },
    });

    await this.engine.invalidateOrg(role.organization_id);
  }

  private async setPermissionsInternal(
    roleId: string,
    perms: Array<{ key: string; effect: 'allow' | 'deny' }>,
    actorId: string
  ) {
    // Map keys to permission IDs
    const { data: permRows } = await this.db
      .from('permissions')
      .select('id, key')
      .in(
        'key',
        perms.map((p) => p.key)
      );
    const byKey = new Map((permRows ?? []).map((p) => [p.key, p.id]));
    const missing = perms.filter((p) => !byKey.has(p.key)).map((p) => p.key);
    if (missing.length > 0) {
      throw Object.assign(new Error(`Unknown permissions: ${missing.join(', ')}`), { status: 400 });
    }

    // Replace strategy: delete then insert (simple, correct)
    await this.db.from('role_permissions').delete().eq('role_id', roleId);
    if (perms.length > 0) {
      await this.db.from('role_permissions').insert(
        perms.map((p) => ({
          role_id: roleId,
          permission_id: byKey.get(p.key)!,
          effect: p.effect,
          granted_by: actorId,
        }))
      );
    }
  }

  // ---------- Inheritance ----------

  async setInheritance(roleId: string, parentIds: string[], actorId: string) {
    const { data: role } = await this.db
      .from('roles')
      .select('organization_id')
      .eq('id', roleId)
      .single();
    if (!role) throw Object.assign(new Error('Not found'), { status: 404 });

    // Cycle pre-check (faster than the trigger error path)
    for (const parent of parentIds) {
      if (await wouldCreateCycle(this.db, roleId, parent)) {
        throw Object.assign(new Error(`Inheritance from ${parent} would create a cycle`), {
          status: 400,
        });
      }
    }

    await this.setInheritanceInternal(roleId, parentIds, actorId);

    await this.audit.log({
      organizationId: role.organization_id,
      actorId,
      action: 'role.inheritance.set',
      resourceType: 'role',
      resourceId: roleId,
      newValues: { parents: parentIds },
    });

    await this.engine.invalidateOrg(role.organization_id);
  }

  private async setInheritanceInternal(roleId: string, parentIds: string[], actorId: string) {
    await this.db.from('role_inheritance').delete().eq('role_id', roleId);
    if (parentIds.length > 0) {
      await this.db
        .from('role_inheritance')
        .insert(parentIds.map((pid) => ({ role_id: roleId, parent_role_id: pid })));
    }
  }

  // ---------- Clone ----------

  async clone(sourceId: string, newKey: string, newLabel: string, orgId: string, actorId: string) {
    const src = await this.getDetail(sourceId);

    // Create the new role
    const { data: role } = await this.db
      .from('roles')
      .insert({
        organization_id: orgId,
        key: newKey,
        label: newLabel,
        description: src.description,
        level: src.level,
        color: src.color,
        is_system: false,
      })
      .select()
      .single();
    if (!role) throw new Error('Clone: create failed');

    // Copy permissions
    if (src.permissions.length > 0) {
      await this.setPermissionsInternal(
        role.id,
        src.permissions.map((p) => ({ key: p.key, effect: p.effect as any })),
        actorId
      );
    }

    // Copy inheritance (point to same parents)
    if (src.inheritsFrom.length > 0) {
      await this.setInheritanceInternal(
        role.id,
        src.inheritsFrom.map((p: any) => p.id),
        actorId
      );
    }

    await this.audit.log({
      organizationId: orgId,
      actorId,
      action: 'role.clone',
      resourceType: 'role',
      resourceId: role.id,
      newValues: { source: sourceId, key: newKey, label: newLabel },
    });

    await this.engine.invalidateOrg(orgId);
    return this.getDetail(role.id);
  }
}
