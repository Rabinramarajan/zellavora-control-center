import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from './env';

/**
 * Supabase clients are created lazily.
 *
 * `createClient()` throws synchronously when the URL or key is empty. Building
 * the clients at module scope therefore turns a missing environment variable
 * into a cold-start crash (FUNCTION_INVOCATION_FAILED) with no usable stack.
 * Deferring construction to first use means a misconfigured deployment returns
 * a readable 500 from the error handler, and `/health` still responds.
 */
function lazyClient(factory: () => SupabaseClient): SupabaseClient {
  let instance: SupabaseClient | null = null;

  const resolve = (): SupabaseClient => {
    if (!instance) instance = factory();
    return instance;
  };

  return new Proxy({} as SupabaseClient, {
    get: (_target, prop, receiver) => Reflect.get(resolve(), prop, receiver),
    has: (_target, prop) => prop in (resolve() as object),
    getPrototypeOf: () => Object.getPrototypeOf(resolve()),
  });
}

function requireEnv(value: string, name: string): string {
  if (!value) {
    throw new Error(
      `Supabase is not configured: ${name} is missing. ` +
        `Set it in Vercel → Project Settings → Environment Variables and redeploy.`
    );
  }
  return value;
}

/**
 * Service-role client (bypasses RLS — server-side only, never exposed to clients).
 * Aliased as `supabase` for legacy imports and as `supabaseAdmin` for clarity in
 * the new auth services.
 */
export const supabase: SupabaseClient = lazyClient(() =>
  createClient(
    requireEnv(config.supabaseUrl, 'VITE_SUPABASE_URL'),
    requireEnv(config.supabaseServiceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
);

export const supabaseAdmin = supabase;

/** Anon client — used for actions that should respect RLS as the end user. */
export const supabaseAnon: SupabaseClient = lazyClient(() =>
  createClient(
    requireEnv(config.supabaseUrl, 'VITE_SUPABASE_URL'),
    requireEnv(config.supabaseAnonKey, 'VITE_SUPABASE_ANON_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
);

export type Database = any;
