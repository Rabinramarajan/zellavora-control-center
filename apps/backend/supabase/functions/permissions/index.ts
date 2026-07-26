import { Hono } from 'https://esm.sh/hono@3.11.8';
import { z } from 'npm:zod@3.22.4';
import { getSupabaseAdmin } from '../_shared/db.ts';
import { AppError, handleError } from '../_shared/errors.ts';
import { jsonResponse, errorResponse, corsResponse } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';

const app = new Hono();

app.options('*', () => corsResponse());

// POST /permissions/check
app.post('/check', async (c) => {
  try {
    const claims = await authenticate(c.req.raw);
    const body = await c.req.json();
    const { permissions, mode } = z.object({
      permissions: z.union([z.string(), z.array(z.string())]),
      mode: z.enum(['any', 'all']).optional().default('any'),
    }).parse(body);

    const checks = Array.isArray(permissions) ? permissions : [permissions];

    // Load effective permissions for the user
    const db = getSupabaseAdmin();
    const { data } = await db
      .from('v_user_effective_permissions')
      .select('permission_code')
      .eq('user_id', claims.sub)
      .eq('organization_id', claims.tid);

    const userPermSet = new Set((data ?? []).map((r: any) => r.permission_code));
    
    // Helper check
    const has = (code: string) => {
      if (userPermSet.has(code)) return true;
      const action = code.split(':')[1];
      return !!action && userPermSet.has(`*:${action}`);
    };

    let allowed = false;
    if (mode === 'all') {
      allowed = checks.every(p => has(p));
    } else {
      allowed = checks.some(p => has(p));
    }

    return jsonResponse({
      allowed,
      permissions: checks,
    });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

// POST /permissions/grant (Overrides: grant custom user permission)
app.post('/grant', async (c) => {
  try {
    const claims = await authenticate(c.req.raw);
    const body = await c.req.json();
    const { userId, permissionId, reason, expiresAt } = z.object({
      userId: z.string().uuid(),
      permissionId: z.string().uuid(),
      reason: z.string().optional(),
      expiresAt: z.string().datetime().optional(),
    }).parse(body);

    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('user_permissions')
      .insert({
        user_id: userId,
        permission_id: permissionId,
        organization_id: claims.tid,
        effect: 'allow',
        reason: reason || null,
        valid_until: expiresAt || null,
      })
      .select()
      .single();

    if (error) throw error;
    return jsonResponse(data, 201);
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

// POST /permissions/deny (Overrides: deny custom user permission)
app.post('/deny', async (c) => {
  try {
    const claims = await authenticate(c.req.raw);
    const body = await c.req.json();
    const { userId, permissionId, reason } = z.object({
      userId: z.string().uuid(),
      permissionId: z.string().uuid(),
      reason: z.string().optional(),
    }).parse(body);

    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('user_permissions')
      .insert({
        user_id: userId,
        permission_id: permissionId,
        organization_id: claims.tid,
        effect: 'deny',
        reason: reason || null,
      })
      .select()
      .single();

    if (error) throw error;
    return jsonResponse(data, 201);
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

Deno.serve(app.fetch);
