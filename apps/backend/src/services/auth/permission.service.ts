/**
 * PermissionService — load the effective permission set for a (user, org) pair
 * and provide an in-memory has() check.
 *
 * The DB view v_user_effective_permissions already does the join. We just
 * project it into a Set<string> on the server.
 *
 * The full permission set is shipped in /auth/me so the client can hide menu
 * items, disable buttons, etc. — without an extra round-trip.
 */
import { supabaseAdmin } from '../../config/supabase';
import { AppError } from '../../middleware/error';

export class PermissionService {
  /** Load the user's permission codes within an organization. */
  static async loadForUser(userId: string, orgId: string): Promise<Set<string>> {
    const { data, error } = await supabaseAdmin
      .from('v_user_effective_permissions')
      .select('permission_code')
      .eq('user_id', userId)
      .eq('organization_id', orgId);

    if (error) throw new AppError('Failed to load permissions', 500, 'PERM_LOAD_FAILED');
    return new Set((data ?? []).map((r: { permission_code: string }) => r.permission_code));
  }

  /** Pure check: does a permission set include a code (or any code with the action wildcard)? */
  static has(set: Set<string>, code: string): boolean {
    if (set.has(code)) return true;
    // Wildcard: 'projects:*' matches 'projects:read'
    const action = code.split(':')[1];
    return !!action && set.has(`*:${action}`);
  }
}
