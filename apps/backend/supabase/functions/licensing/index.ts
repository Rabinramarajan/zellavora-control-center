import { Hono } from 'https://esm.sh/hono@3.11.8';
import { z } from 'npm:zod@3.22.4';
import { getSupabaseAdmin } from '../_shared/db.ts';
import { AppError, handleError } from '../_shared/errors.ts';
import { jsonResponse, errorResponse, corsResponse } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';

const app = new Hono();

app.options('*', () => corsResponse());

// GET /licensing/plans (List available plans)
app.get('/plans', async (c) => {
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db.from('license_plans').select('*').eq('active', true).order('price');
    if (error) throw error;
    return jsonResponse(data || []);
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

// GET /licensing/plans/:planId
app.get('/plans/:planId', async (c) => {
  try {
    const planId = c.req.param('planId');
    const db = getSupabaseAdmin();
    const { data, error } = await db.from('license_plans').select('*').eq('id', planId).single();
    if (error || !data) throw new AppError('Plan not found', 404, 'PLAN_NOT_FOUND');
    return jsonResponse(data);
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

// GET /licensing/:orgId/license
app.get('/:orgId/license', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('organization_licenses')
      .select('*, license_plans(*)')
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .maybeSingle();

    if (error || !data) throw new AppError('License not found', 404, 'LICENSE_NOT_FOUND');
    return jsonResponse(data);
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

// POST /licensing/:orgId/license/activate-trial
app.post('/:orgId/license/activate-trial', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const claims = await authenticate(c.req.raw);
    const body = await c.req.json();
    const { planId, trialDays } = z.object({
      planId: z.string().uuid(),
      trialDays: z.number().int().min(1).max(365).optional().default(14),
    }).parse(body);

    const db = getSupabaseAdmin();
    // Check if already has license
    const { data: existing } = await db.from('organization_licenses').select('id').eq('organization_id', orgId).maybeSingle();
    if (existing) throw new AppError('Organization already has an active or past license', 400, 'LICENSE_ALREADY_EXISTS');

    const expiresAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await db
      .from('organization_licenses')
      .insert({
        organization_id: orgId,
        license_plan_id: planId,
        status: 'active',
        is_trial: true,
        trial_ends_at: expiresAt,
        expires_at: expiresAt,
        activated_by: claims.sub,
      })
      .select()
      .single();

    if (error) throw error;
    return jsonResponse(data);
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

// POST /licensing/:orgId/license/change-plan
app.post('/:orgId/license/change-plan', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const claims = await authenticate(c.req.raw);
    const body = await c.req.json();
    const { newPlanId, billingCycle } = z.object({
      newPlanId: z.string().uuid(),
      billingCycle: z.enum(['monthly', 'quarterly', 'annual']).optional().default('monthly'),
    }).parse(body);

    const db = getSupabaseAdmin();
    // Deactivate current active licenses
    await db.from('organization_licenses').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('organization_id', orgId).eq('status', 'active');

    // Create new license
    const expiresAt = new Date(Date.now() + (billingCycle === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await db
      .from('organization_licenses')
      .insert({
        organization_id: orgId,
        license_plan_id: newPlanId,
        status: 'active',
        is_trial: false,
        expires_at: expiresAt,
        activated_by: claims.sub,
      })
      .select()
      .single();

    if (error) throw error;
    return jsonResponse(data);
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

// GET /licensing/:orgId/license/usage
app.get('/:orgId/license/usage', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('license_usage')
      .select('*')
      .eq('organization_id', orgId);

    if (error) throw error;
    return jsonResponse(data || []);
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

// POST /licensing/:orgId/license/usage/track
app.post('/:orgId/license/usage/track', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const claims = await authenticate(c.req.raw);
    const body = await c.req.json();
    const { eventType, quantity, resourceType, resourceId } = z.object({
      eventType: z.string(),
      quantity: z.number().int().positive().default(1),
      resourceType: z.string().optional(),
      resourceId: z.string().optional(),
    }).parse(body);

    const db = getSupabaseAdmin();
    const { error } = await db.from('license_usage_events').insert({
      organization_id: orgId,
      user_id: claims.sub,
      event_type: eventType,
      quantity,
      resource_type: resourceType || null,
      resource_id: resourceId || null,
    });

    if (error) throw error;
    return jsonResponse({ success: true });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

// GET /licensing/:orgId/license/check-limits
app.get('/:orgId/license/check-limits', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const db = getSupabaseAdmin();
    const { data: license } = await db
      .from('organization_licenses')
      .select('*, license_plans(*)')
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .maybeSingle();

    if (!license) throw new AppError('No active license found', 404, 'LICENSE_NOT_FOUND');

    return jsonResponse({
      limits: license.license_plans.features || {},
      status: 'ok',
    });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

// GET /licensing/:orgId/license/features
app.get('/:orgId/license/features', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const db = getSupabaseAdmin();
    const { data: license } = await db
      .from('organization_licenses')
      .select('*, license_plans(*)')
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .maybeSingle();

    if (!license) return jsonResponse({});
    return jsonResponse(license.license_plans.features || {});
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

// GET /licensing/:orgId/license/modules
app.get('/:orgId/license/modules', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const db = getSupabaseAdmin();
    const { data: license } = await db
      .from('organization_licenses')
      .select('*, license_plans(*)')
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .maybeSingle();

    if (!license) return jsonResponse({});
    return jsonResponse(license.license_plans.features?.modules || {});
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

Deno.serve(app.fetch);
