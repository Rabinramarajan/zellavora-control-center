import { Hono } from 'https://esm.sh/hono@3.11.8';
import { getSupabaseAdmin } from '../_shared/db.ts';
import { AppError, handleError } from '../_shared/errors.ts';
import { jsonResponse, errorResponse, corsResponse } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';

const app = new Hono();

app.options('*', () => corsResponse());

// GET /gallery/projects/:projectId
app.get('/projects/:projectId', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('project_gallery')
      .select('*')
      .eq('project_id', projectId)
      .order('order_index');

    if (error) throw error;
    return jsonResponse(data || []);
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

// POST /gallery/projects/:projectId
app.post('/projects/:projectId', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const claims = await authenticate(c.req.raw);
    const body = await c.req.json();
    const { mediaUrl, caption } = body;

    if (!mediaUrl) {
      throw new AppError('mediaUrl is required', 400, 'MISSING_MEDIA_URL');
    }

    const db = getSupabaseAdmin();
    const { data: project, error: projError } = await db
      .from('projects')
      .select('user_id')
      .eq('id', projectId)
      .single();

    if (projError || !project) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    if (project.user_id !== claims.sub) {
      throw new AppError('Unauthorized', 403, 'FORBIDDEN');
    }

    const { data: lastItem } = await db
      .from('project_gallery')
      .select('order_index')
      .eq('project_id', projectId)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextIndex = (lastItem?.order_index || -1) + 1;

    const { data, error } = await db
      .from('project_gallery')
      .insert({
        project_id: projectId,
        media_url: mediaUrl,
        caption: caption || null,
        order_index: nextIndex,
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

// PUT /gallery/projects/:projectId/:imageId
app.put('/projects/:projectId/:imageId', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const imageId = c.req.param('imageId');
    const claims = await authenticate(c.req.raw);

    const db = getSupabaseAdmin();
    const { data: project, error: projError } = await db
      .from('projects')
      .select('user_id')
      .eq('id', projectId)
      .single();

    if (projError || !project) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    if (project.user_id !== claims.sub) {
      throw new AppError('Unauthorized', 403, 'FORBIDDEN');
    }

    const body = await c.req.json();
    const { data, error } = await db
      .from('project_gallery')
      .update(body)
      .eq('id', imageId)
      .eq('project_id', projectId)
      .select()
      .single();

    if (error) throw error;
    return jsonResponse(data);
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

// DELETE /gallery/projects/:projectId/:imageId
app.delete('/projects/:projectId/:imageId', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const imageId = c.req.param('imageId');
    const claims = await authenticate(c.req.raw);

    const db = getSupabaseAdmin();
    const { data: project, error: projError } = await db
      .from('projects')
      .select('user_id')
      .eq('id', projectId)
      .single();

    if (projError || !project) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    if (project.user_id !== claims.sub) {
      throw new AppError('Unauthorized', 403, 'FORBIDDEN');
    }

    const { error } = await db
      .from('project_gallery')
      .delete()
      .eq('id', imageId)
      .eq('project_id', projectId);

    if (error) throw error;

    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant-id',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
      },
    });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

Deno.serve(app.fetch);
