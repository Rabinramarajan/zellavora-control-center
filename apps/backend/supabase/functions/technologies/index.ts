import { Hono } from 'https://esm.sh/hono@3.11.8';
import { getSupabaseAdmin } from '../_shared/db.ts';
import { AppError, handleError } from '../_shared/errors.ts';
import { jsonResponse, errorResponse, corsResponse } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';

const app = new Hono();

app.options('*', () => corsResponse());

// GET /technologies
app.get('/', async (c) => {
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db.from('technologies').select('*').order('name');
    if (error) throw error;
    return jsonResponse(data || []);
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

// POST /technologies
app.post('/', async (c) => {
  try {
    await authenticate(c.req.raw);
    const body = await c.req.json();
    const db = getSupabaseAdmin();
    const { data, error } = await db.from('technologies').insert(body).select().single();
    if (error) throw error;
    return jsonResponse(data, 201);
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

// GET /technologies/projects/:projectId (or we can define a router that matches /projects/:projectId/technologies)
// Note: To match how the frontend requests, we also mount endpoints that take projectId
app.get('/projects/:projectId', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('project_technologies')
      .select('technology_id, technologies(*)')
      .eq('project_id', projectId);

    if (error) throw error;
    const technologies = (data || []).map((pt: any) => pt.technologies);
    return jsonResponse(technologies);
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.post('/projects/:projectId', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const claims = await authenticate(c.req.raw);
    const body = await c.req.json();
    const { technologyId } = body;

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

    const { data, error } = await db
      .from('project_technologies')
      .insert({ project_id: projectId, technology_id: technologyId })
      .select()
      .single();

    if (error) throw error;
    return jsonResponse(data, 201);
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.put('/projects/:projectId', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const claims = await authenticate(c.req.raw);
    const body = await c.req.json();
    const { technologyIds } = body;

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

    await db.from('project_technologies').delete().eq('project_id', projectId);

    const newAssociations = technologyIds.map((techId: string) => ({
      project_id: projectId,
      technology_id: techId,
    }));

    const { data, error } = await db.from('project_technologies').insert(newAssociations).select();
    if (error) throw error;

    return jsonResponse(data);
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

app.delete('/projects/:projectId/:technologyId', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const technologyId = c.req.param('technologyId');
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
      .from('project_technologies')
      .delete()
      .eq('project_id', projectId)
      .eq('technology_id', technologyId);

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
