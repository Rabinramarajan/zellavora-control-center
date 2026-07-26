import { Hono } from 'https://esm.sh/hono@3.11.8';
import { z } from 'npm:zod@3.22.4';
import { getSupabaseAdmin } from '../_shared/db.ts';
import { AppError, handleError } from '../_shared/errors.ts';
import { jsonResponse, errorResponse, corsResponse } from '../_shared/response.ts';
import { authenticate, requirePermission } from '../_shared/auth.ts';

const app = new Hono();

app.options('*', () => corsResponse());

// ----------------------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------------------
const CreateRole = z.object({
  key: z.string().regex(/^[a-z0-9_]{3,50}$/, 'lowercase, 3-50 chars'),
  label: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  level: z.number().int().min(0).max(100).default(0),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  inheritsFrom: z.array(z.string().uuid()).default([]),
  permissions: z.array(z.object({
    key: z.string().min(3).max(200),
    effect: z.enum(['allow', 'deny']).default('allow')
  })).default([])
});

const UpdateRole = CreateRole.partial();

const PermissionsSet = z.array(z.object({
  key: z.string(),
  effect: z.enum(['allow', 'deny'])
}));

const InheritanceSet = z.array(z.string().uuid());

const AssignRole = z.object({
  roleId: z.string().uuid(),
  resourceType: z.string().max(50).optional(),
  resourceId: z.string().uuid().optional(),
  validUntil: z.string().datetime().optional()
});

const CheckBody = z.object({
  checks: z.array(z.string()).min(1).max(100)
});

// Helper for DAG graph role expansion
async function expandRoleGraph(db: any, seedRoleIds: string[]) {
  if (seedRoleIds.length === 0) return [];
  const visited = new Set<string>(seedRoleIds);
  const queue = seedRoleIds.map(id => ({ id, depth: 0 }));
  const collected = [];

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (depth > 8) throw new Error('Role inheritance depth exceeds 8');

    const { data: role } = await db.from('roles').select('id, key, label, organization_id, level').eq('id', id).single();
    if (!role) continue;
    collected.push(role);

    const { data: parents } = await db.from('role_inheritance').select('parent_role_id').eq('role_id', id);
    for (const p of parents ?? []) {
      if (!visited.has(p.parent_role_id)) {
        visited.add(p.parent_role_id);
        queue.push({ id: p.parent_role_id, depth: depth + 1 });
      }
    }
  }
  return collected;
}

// ----------------------------------------------------------------------------
// Endpoints
// ----------------------------------------------------------------------------

app.get('/permissions', async (c) => {
  try {
    const claims = await authenticate(c.req.raw);
    await requirePermission(claims, 'system:rbac:read');

    const type = c.req.query('type');
    const groupId = c.req.query('groupId');

    const db = getSupabaseAdmin();
    let q = db.from('permissions').select('*, group:permission_groups(*)');
    if (type) q = q.eq('type', type);
    if (groupId) q = q.eq('group_id', groupId);

    const { data, error } = await q.order('label', { ascending: true });
    if (error) throw error;

    return jsonResponse({ data: data || [] });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.get('/permissions/groups', async (c) => {
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db.from('permission_groups').select('*').order('sort_order');
    if (error) throw error;
    return jsonResponse({ data: data || [] });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.get('/roles', async (c) => {
  try {
    const claims = await authenticate(c.req.raw);
    await requirePermission(claims, 'system:rbac:read');

    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('roles')
      .select('*')
      .or(`organization_id.is.null,organization_id.eq.${claims.tid}`)
      .order('level', { ascending: false });

    if (error) throw error;
    return jsonResponse({ data: data || [] });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.get('/roles/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const claims = await authenticate(c.req.raw);
    await requirePermission(claims, 'system:rbac:read');

    const db = getSupabaseAdmin();
    const { data: role, error } = await db.from('roles').select('*').eq('id', id).single();
    if (error || !role) throw new AppError('Role not found', 404, 'ROLE_NOT_FOUND');

    const [{ data: perms }, { data: parents }, { data: children }] = await Promise.all([
      db.from('role_permissions').select('effect, permissions!inner(key, label, type)').eq('role_id', id),
      db.from('role_inheritance').select('parent_role_id, roles!role_inheritance_parent_role_id_fkey(id, key, label, level)').eq('role_id', id),
      db.from('role_inheritance').select('role_id, roles!role_inheritance_role_id_fkey(id, key, label, level)').eq('parent_role_id', id)
    ]);

    return jsonResponse({
      data: {
        ...role,
        permissions: (perms ?? []).map((p: any) => ({
          key: p.permissions.key,
          label: p.permissions.label,
          type: p.permissions.type,
          effect: p.effect
        })),
        inheritsFrom: (parents ?? []).map((p: any) => p.roles),
        inheritedBy: (children ?? []).map((c: any) => c.roles)
      }
    });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.post('/roles', async (c) => {
  try {
    const claims = await authenticate(c.req.raw);
    await requirePermission(claims, 'system:rbac:write');

    const body = await c.req.json();
    const input = CreateRole.parse(body);

    const db = getSupabaseAdmin();
    const { data: role, error } = await db
      .from('roles')
      .insert({
        organization_id: claims.tid,
        key: input.key,
        label: input.label,
        description: input.description,
        level: input.level,
        color: input.color,
        is_system: false
      })
      .select()
      .single();

    if (error || !role) throw error;

    // Insert permissions
    if (input.permissions.length > 0) {
      // Find permission IDs by keys
      const { data: pRows } = await db.from('permissions').select('id, key').in('key', input.permissions.map(p => p.key));
      const keyToId = new Map((pRows ?? []).map((r: any) => [r.key, r.id]));
      const permInserts = input.permissions
        .filter(p => keyToId.has(p.key))
        .map(p => ({
          role_id: role.id,
          permission_id: keyToId.get(p.key),
          effect: p.effect
        }));
      if (permInserts.length > 0) {
        await db.from('role_permissions').insert(permInserts);
      }
    }

    // Insert inheritance
    if (input.inheritsFrom.length > 0) {
      const inhInserts = input.inheritsFrom.map(pId => ({
        role_id: role.id,
        parent_role_id: pId
      }));
      await db.from('role_inheritance').insert(inhInserts);
    }

    return jsonResponse({ data: role }, 201);
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.patch('/roles/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const claims = await authenticate(c.req.raw);
    await requirePermission(claims, 'system:rbac:write');

    const body = await c.req.json();
    const patch = UpdateRole.parse(body);

    const db = getSupabaseAdmin();
    const { data: role, error } = await db
      .from('roles')
      .update({
        key: patch.key,
        label: patch.label,
        description: patch.description,
        level: patch.level,
        color: patch.color
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !role) throw error;
    return jsonResponse({ data: role });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.delete('/roles/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const claims = await authenticate(c.req.raw);
    await requirePermission(claims, 'system:rbac:write');

    const db = getSupabaseAdmin();
    const { error } = await db.from('roles').delete().eq('id', id);
    if (error) throw error;

    return jsonResponse({ data: { ok: true } });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.put('/roles/:id/permissions', async (c) => {
  try {
    const id = c.req.param('id');
    const claims = await authenticate(c.req.raw);
    await requirePermission(claims, 'system:rbac:write');

    const body = await c.req.json();
    const perms = PermissionsSet.parse(body.permissions);

    const db = getSupabaseAdmin();
    await db.from('role_permissions').delete().eq('role_id', id);

    if (perms.length > 0) {
      const { data: pRows } = await db.from('permissions').select('id, key').in('key', perms.map(p => p.key));
      const keyToId = new Map((pRows ?? []).map((r: any) => [r.key, r.id]));
      const inserts = perms
        .filter(p => keyToId.has(p.key))
        .map(p => ({
          role_id: id,
          permission_id: keyToId.get(p.key),
          effect: p.effect
        }));
      if (inserts.length > 0) {
        await db.from('role_permissions').insert(inserts);
      }
    }

    return jsonResponse({ data: { ok: true } });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.put('/roles/:id/inheritance', async (c) => {
  try {
    const id = c.req.param('id');
    const claims = await authenticate(c.req.raw);
    await requirePermission(claims, 'system:rbac:write');

    const body = await c.req.json();
    const parents = InheritanceSet.parse(body.parents);

    const db = getSupabaseAdmin();
    await db.from('role_inheritance').delete().eq('role_id', id);

    if (parents.length > 0) {
      const inserts = parents.map(pId => ({
        role_id: id,
        parent_role_id: pId
      }));
      await db.from('role_inheritance').insert(inserts);
    }

    return jsonResponse({ data: { ok: true } });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.get('/users/:userId/roles', async (c) => {
  try {
    const userId = c.req.param('userId');
    const claims = await authenticate(c.req.raw);
    await requirePermission(claims, 'system:rbac:read');

    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', claims.tid);

    if (error) throw error;
    return jsonResponse({ data: data || [] });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.post('/users/:userId/roles', async (c) => {
  try {
    const userId = c.req.param('userId');
    const claims = await authenticate(c.req.raw);
    await requirePermission(claims, 'users:role:assign');

    const body = await c.req.json();
    const input = AssignRole.parse(body);

    const db = getSupabaseAdmin();
    // Validate role
    const { data: role } = await db.from('roles').select('id, organization_id').eq('id', input.roleId).single();
    if (!role) throw new AppError('Role not found', 404, 'ROLE_NOT_FOUND');
    if (role.organization_id && role.organization_id !== claims.tid) {
      throw new AppError('Role does not belong to this organization', 400, 'ROLE_ORG_MISMATCH');
    }

    const { data, error } = await db
      .from('user_roles')
      .insert({
        user_id: userId,
        role_id: input.roleId,
        organization_id: claims.tid,
        resource_type: input.resourceType,
        resource_id: input.resourceId,
        status: 'active',
        valid_from: new Date().toISOString(),
        valid_until: input.validUntil,
        assigned_by: claims.sub
      })
      .select()
      .single();

    if (error) throw error;
    return jsonResponse({ data }, 201);
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.delete('/users/:userId/roles/:assignmentId', async (c) => {
  try {
    const assignmentId = c.req.param('assignmentId');
    const claims = await authenticate(c.req.raw);
    await requirePermission(claims, 'users:role:assign');

    const db = getSupabaseAdmin();
    const { error } = await db
      .from('user_roles')
      .update({
        status: 'suspended',
        revoked_at: new Date().toISOString(),
        revoked_by: claims.sub
      })
      .eq('id', assignmentId);

    if (error) throw error;
    return jsonResponse({ data: { ok: true } });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.get('/me/policy', async (c) => {
  try {
    const claims = await authenticate(c.req.raw);
    const db = getSupabaseAdmin();

    // 1. Resolve roles
    const { data: assignments } = await db
      .from('user_roles')
      .select('role_id')
      .eq('user_id', claims.sub)
      .eq('organization_id', claims.tid)
      .eq('status', 'active');

    const seedRoles = (assignments ?? []).map((a: any) => a.role_id);
    const effectiveRoles = seedRoles.length > 0 ? await expandRoleGraph(db, seedRoles) : [];

    // 2. Resolve permissions
    const { data: rolePerms } = effectiveRoles.length > 0 ? await db
      .from('role_permissions')
      .select('effect, permissions!inner(key)')
      .in('role_id', effectiveRoles.map(r => r.id)) : { data: [] };

    const { data: userOverrides } = await db
      .from('user_permissions')
      .select('effect, permissions!inner(key)')
      .eq('user_id', claims.sub)
      .eq('organization_id', claims.tid);

    const allowed = new Set<string>();
    const denied = new Set<string>();

    for (const rp of rolePerms ?? []) {
      const key = (rp as any).permissions?.key;
      if (key) (rp.effect === 'deny' ? denied : allowed).add(key);
    }
    for (const u of userOverrides ?? []) {
      const key = (u as any).permissions?.key;
      if (key) (u.effect === 'deny' ? denied : allowed).add(key);
    }
    for (const k of denied) allowed.delete(k);

    const policy = {
      userId: claims.sub,
      orgId: claims.tid,
      version: 1,
      allowed: Array.from(allowed),
      denied: Array.from(denied),
      roles: effectiveRoles.map(r => ({ id: r.id, key: r.key, label: r.label, level: r.level })),
      resolvedAt: Date.now()
    };

    return jsonResponse({ data: policy });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.post('/check', async (c) => {
  try {
    const claims = await authenticate(c.req.raw);
    const body = await c.req.json();
    const { checks } = CheckBody.parse(body);

    const db = getSupabaseAdmin();
    // Resolve policy
    const { data: assignments } = await db
      .from('user_roles')
      .select('role_id')
      .eq('user_id', claims.sub)
      .eq('organization_id', claims.tid)
      .eq('status', 'active');

    const seedRoles = (assignments ?? []).map((a: any) => a.role_id);
    const effectiveRoles = seedRoles.length > 0 ? await expandRoleGraph(db, seedRoles) : [];

    const { data: rolePerms } = effectiveRoles.length > 0 ? await db
      .from('role_permissions')
      .select('effect, permissions!inner(key)')
      .in('role_id', effectiveRoles.map(r => r.id)) : { data: [] };

    const { data: userOverrides } = await db
      .from('user_permissions')
      .select('effect, permissions!inner(key)')
      .eq('user_id', claims.sub)
      .eq('organization_id', claims.tid);

    const allowed = new Set<string>();
    const denied = new Set<string>();

    for (const rp of rolePerms ?? []) {
      const key = (rp as any).permissions?.key;
      if (key) (rp.effect === 'deny' ? denied : allowed).add(key);
    }
    for (const u of userOverrides ?? []) {
      const key = (u as any).permissions?.key;
      if (key) (u.effect === 'deny' ? denied : allowed).add(key);
    }
    for (const k of denied) allowed.delete(k);

    const results = checks.reduce((acc: Record<string, boolean>, perm: string) => {
      acc[perm] = !denied.has(perm) && allowed.has(perm);
      return acc;
    }, {});

    return jsonResponse({ data: { results, version: 1 } });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

Deno.serve(app.fetch);
