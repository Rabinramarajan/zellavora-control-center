import { Hono } from 'https://esm.sh/hono@3.11.8';
import { z } from 'npm:zod@3.22.4';
import { getSupabaseAdmin } from '../_shared/db.ts';
import { AppError, handleError } from '../_shared/errors.ts';
import { jsonResponse, errorResponse, corsResponse } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';
import { MenuService } from '../_shared/menus.ts';

const app = new Hono();

app.options('*', () => corsResponse());

// GET /menus (Load complete menu tree)
app.get('/', async (c) => {
  try {
    const claims = await authenticate(c.req.raw);
    const roots = await MenuService.loadForUser(claims.sub, claims.tid);
    
    // Also fetch categories
    const db = getSupabaseAdmin();
    const { data: categories } = await db
      .from('menu_categories')
      .select('*')
      .eq('organization_id', claims.tid)
      .order('order_index');

    return jsonResponse({
      items: roots,
      categories: categories || [],
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

// POST /menus (Create menu node)
app.post('/', async (c) => {
  try {
    const claims = await authenticate(c.req.raw);
    const body = await c.req.json();
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('menus')
      .insert({
        organization_id: claims.tid,
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

// PUT /menus/:menuId
app.put('/:menuId', async (c) => {
  try {
    const menuId = c.req.param('menuId');
    const claims = await authenticate(c.req.raw);
    const body = await c.req.json();

    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('menus')
      .update(body)
      .eq('id', menuId)
      .eq('organization_id', claims.tid)
      .select()
      .single();

    if (error) throw error;
    return jsonResponse(data);
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

// DELETE /menus/:menuId
app.delete('/:menuId', async (c) => {
  try {
    const menuId = c.req.param('menuId');
    const claims = await authenticate(c.req.raw);

    const db = getSupabaseAdmin();
    const { error } = await db
      .from('menus')
      .delete()
      .eq('id', menuId)
      .eq('organization_id', claims.tid);

    if (error) throw error;
    return jsonResponse({ success: true });
  } catch (e) {
    const err = handleError(e);
    return errorResponse({ message: err.error.message, code: err.error.code, statusCode: err.status });
  }
});

Deno.serve(app.fetch);
