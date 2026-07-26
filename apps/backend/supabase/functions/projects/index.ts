import { Hono } from 'https://esm.sh/hono@3.11.8';
import { z } from 'npm:zod@3.22.4';
import { getSupabaseAdmin, getSupabaseClient } from '../_shared/db.ts';
import { AppError, handleError } from '../_shared/errors.ts';
import { jsonResponse, errorResponse, corsResponse } from '../_shared/response.ts';
import { authenticate, requireRole } from '../_shared/auth.ts';

const app = new Hono();

app.options('*', () => corsResponse());

const CreateProjectSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  category: z.string().optional(),
  githubUrl: z.string().optional(),
  liveDemoUrl: z.string().optional(),
  websiteUrl: z.string().optional(),
});

// GET /projects (List projects)
app.get('/', async (c) => {
  try {
    const page = c.req.query('page') ?? '1';
    const pageSize = c.req.query('pageSize') ?? '20';
    const status = c.req.query('status') ?? 'published';
    const featured = c.req.query('featured');

    const db = getSupabaseAdmin();
    let query = db.from('projects').select('*', { count: 'exact' });

    if (featured === 'true') {
      // Filter for featured if requested
      query = query.eq('featured', true);
    }
    
    query = query.eq('status', status);

    const pageNum = parseInt(page) || 1;
    const pageSizeNum = parseInt(pageSize) || 20;

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range((pageNum - 1) * pageSizeNum, pageNum * pageSizeNum - 1);

    if (error) throw error;

    return jsonResponse({
      data: data || [],
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        total: count || 0,
      },
    });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

// GET /projects/search
app.get('/search', async (c) => {
  try {
    const q = c.req.query('q') ?? '';
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('projects')
      .select('*')
      .ilike('title', `%${q}%`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return jsonResponse(data || []);
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

// GET /projects/slug/:slug (Get project by slug)
app.get('/slug/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('projects')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error || !data) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    return jsonResponse(data);
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

// GET /projects/:id (Get project by ID)
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    return jsonResponse(data);
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

// POST /projects (Create project)
app.post('/', async (c) => {
  try {
    const claims = await authenticate(c.req.raw);
    requireRole(claims, 'admin', 'editor');

    const body = await c.req.json();
    const parsed = CreateProjectSchema.parse(body);

    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('projects')
      .insert({ user_id: claims.sub, ...parsed, status: 'draft' })
      .select()
      .single();

    if (error) throw error;

    return jsonResponse(data, 201);
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

// PUT /projects/:id (Update project)
app.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const claims = await authenticate(c.req.raw);
    requireRole(claims, 'admin', 'editor');

    const db = getSupabaseAdmin();
    const { data: project, error: fetchError } = await db
      .from('projects')
      .select('user_id')
      .eq('id', id)
      .single();

    if (fetchError || !project) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    if (project.user_id !== claims.sub) {
      throw new AppError('Unauthorized', 403, 'FORBIDDEN');
    }

    const body = await c.req.json();
    const { data: updated, error } = await db
      .from('projects')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return jsonResponse(updated);
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

// DELETE /projects/:id (Delete project)
app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const claims = await authenticate(c.req.raw);
    requireRole(claims, 'admin', 'editor');

    const db = getSupabaseAdmin();
    const { data: project, error: fetchError } = await db
      .from('projects')
      .select('user_id')
      .eq('id', id)
      .single();

    if (fetchError || !project) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    if (project.user_id !== claims.sub) {
      throw new AppError('Unauthorized', 403, 'FORBIDDEN');
    }

    const { error } = await db.from('projects').delete().eq('id', id);
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

// POST /projects/:id/publish
app.post('/:id/publish', async (c) => {
  try {
    const id = c.req.param('id');
    const claims = await authenticate(c.req.raw);
    requireRole(claims, 'admin', 'editor');

    const db = getSupabaseAdmin();
    const { error } = await db
      .from('projects')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    const { data: project } = await db.from('projects').select().eq('id', id).single();
    return jsonResponse(project);
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

// POST /projects/:id/archive
app.post('/:id/archive', async (c) => {
  try {
    const id = c.req.param('id');
    const claims = await authenticate(c.req.raw);
    requireRole(claims, 'admin', 'editor');

    const db = getSupabaseAdmin();
    const { error } = await db.from('projects').update({ status: 'archived' }).eq('id', id);

    if (error) throw error;

    const { data: project } = await db.from('projects').select().eq('id', id).single();
    return jsonResponse(project);
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

Deno.serve(app.fetch);
