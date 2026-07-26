import { Hono } from 'https://esm.sh/hono@3.11.8';
import { getSupabaseAdmin } from '../_shared/db.ts';
import { AppError, handleError } from '../_shared/errors.ts';
import { jsonResponse, errorResponse, corsResponse } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';

const app = new Hono();

app.options('*', () => corsResponse());

// Helper to define CRUD routes for portfolio components
const registerPortfolioCrud = (resourceName: string, tableName: string) => {
  // GET /portfolio/[resource]
  app.get(`/${resourceName}`, async (c) => {
    try {
      const userId = c.req.query('userId');
      if (!userId) {
        throw new AppError('userId is required', 400, 'MISSING_USER_ID');
      }
      const db = getSupabaseAdmin();
      const { data, error } = await db
        .from(tableName)
        .select('*')
        .eq('user_id', userId)
        .order('order_index');

      if (error) throw error;
      return jsonResponse(data || []);
    } catch (e) {
      const err = handleError(e);
      return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
    }
  });

  // POST /portfolio/[resource]
  app.post(`/${resourceName}`, async (c) => {
    try {
      const claims = await authenticate(c.req.raw);
      const body = await c.req.json();
      const db = getSupabaseAdmin();
      const { data, error } = await db
        .from(tableName)
        .insert({
          user_id: claims.sub,
          ...body,
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

  // PUT /portfolio/[resource]/:id
  app.put(`/${resourceName}/:id`, async (c) => {
    try {
      const id = c.req.param('id');
      const claims = await authenticate(c.req.raw);
      const body = await c.req.json();
      const db = getSupabaseAdmin();
      const { data, error } = await db
        .from(tableName)
        .update(body)
        .eq('id', id)
        .eq('user_id', claims.sub)
        .select()
        .single();

      if (error) throw error;
      return jsonResponse(data);
    } catch (e) {
      const err = handleError(e);
      return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
    }
  });

  // DELETE /portfolio/[resource]/:id
  app.delete(`/${resourceName}/:id`, async (c) => {
    try {
      const id = c.req.param('id');
      const claims = await authenticate(c.req.raw);
      const db = getSupabaseAdmin();
      const { error } = await db
        .from(tableName)
        .delete()
        .eq('id', id)
        .eq('user_id', claims.sub);

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
};

// GET /portfolio/profile
app.get('/profile', async (c) => {
  try {
    const userId = c.req.query('userId');
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');
    }
    return jsonResponse(data);
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

// PUT /portfolio/profile
app.put('/profile', async (c) => {
  try {
    const claims = await authenticate(c.req.raw);
    const body = await c.req.json();
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('profiles')
      .update(body)
      .eq('user_id', claims.sub)
      .select()
      .single();

    if (error) throw error;
    return jsonResponse(data);
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

// Register CRUD endpoints for each sub-resource
registerPortfolioCrud('skills', 'skills');
registerPortfolioCrud('experience', 'experience');
registerPortfolioCrud('education', 'education');
registerPortfolioCrud('services', 'services');
registerPortfolioCrud('testimonials', 'testimonials');

Deno.serve(app.fetch);
