/**
 * User-role assignment service.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuditService } from './audit.service';
import type { PermissionEngine } from '../engine/permission-engine';

export interface AssignRoleInput {
  roleId: string;
  resourceType?: string;
  resourceId?: string;
  validUntil?: string;
}

export class UserRoleService {
  constructor(
    private db: SupabaseClient,
    private audit: AuditService,
    private engine: PermissionEngine
  ) {}

  async listForUser(userId: string, orgId: string) {
    const { data } = await this.db
      .from('user_roles')
      .select(`
        id, role_id, organization_id, resource_type, resource_id,
        status, valid_from, valid_until, assigned_at, assigned_by
      `)
      .eq('user_id', userId)
      .eq('organization_id', orgId)
      .order('assigned_at', { ascending: false });
    return data ?? [];
  }

  async assign(userId: string, input: AssignRoleInput, orgId: string, actorId: string) {
    // Verify the role exists and belongs to this org (or is system)
    const { data: role } = await this.db
      .from('roles')
      .select('id, organization_id, is_system')
      .eq('id', input.roleId)
      .single();
    if (!role) {
      throw Object.assign(new Error('Role not found'), { status: 404 });
    }
    if (role.organization_id && role.organization_id !== orgId) {
      throw Object.assign(
        new Error('Role does not belong to this organization'),
        { status: 400 }
      );
    }

    // Detect duplicate active assignment
    const { data: existing } = await this.db
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role_id', input.roleId)
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .maybeSingle();
    if (existing) {
      throw Object.assign(
        new Error('User already has this role active'),
        { status: 409 }
      );
    }

    const { data, error } = await this.db
      .from('user_roles')
      .insert({
        user_id: userId,
        role_id: input.roleId,
        organization_id: orgId,
        resource_type: input.resourceType,
        resource_id: input.resourceId,
        status: 'active',
        valid_from: new Date().toISOString(),
        valid_until: input.validUntil,
        assigned_by: actorId
      })
      .select()
      .single();
    if (error || !data) throw new Error(`Assign failed: ${error?.message}`);

    await this.audit.log({
      organizationId: orgId,
      actorId,
      action: 'user_role.assign',
      resourceType: 'user_role',
      resourceId: data.id,
      newValues: data,
      description: `Assigned role ${input.roleId} to user ${userId}`
    });

    // Invalidate the affected user's policy
    await this.engine.invalidate(userId, orgId);
    return data;
  }

  async revoke(assignmentId: string, actorId: string, reason?: string) {
    const { data: before } = await this.db
      .from('user_roles').select('*').eq('id', assignmentId).single();
    if (!before) throw Object.assign(new Error('Not found'), { status: 404 });

    const { error } = await this.db
      .from('user_roles')
      .update({
        status: 'suspended',
        revoked_at: new Date().toISOString(),
        revoked_by: actorId,
        revoke_reason: reason
      })
      .eq('id', assignmentId);
    if (error) throw new Error(`Revoke failed: ${error.message}`);

    await this.audit.log({
      organizationId: before.organization_id,
      actorId,
      action: 'user_role.revoke',
      resourceType: 'user_role',
      resourceId: assignmentId,
      oldValues: before,
      newValues: { status: 'suspended', reason }
    });

    await this.engine.invalidate(before.user_id, before.organization_id);
  }

  /**
   * Bulk assign a role to many users. Useful when creating departments
   * or onboarding cohorts.
   */
  async bulkAssign(
    userIds: string[],
    roleId: string,
    orgId: string,
    actorId: string
  ): Promise<{ inserted: number; skipped: number; errors: number }> {
    let inserted = 0, skipped = 0, errors = 0;
    for (const userId of userIds) {
      try {
        await this.assign(userId, { roleId }, orgId, actorId);
        inserted++;
      } catch (e: any) {
        if (e.status === 409) skipped++;
        else errors++;
      }
    }
    await this.audit.log({
      organizationId: orgId,
      actorId,
      action: 'user_role.bulk_assign',
      description: `Bulk-assigned role ${roleId} to ${userIds.length} users`,
      newValues: { roleId, requested: userIds.length, inserted, skipped, errors }
    });
    return { inserted, skipped, errors };
  }
}
