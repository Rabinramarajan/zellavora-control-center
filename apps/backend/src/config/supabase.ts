import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from './env';

/**
 * Service-role client (bypasses RLS — server-side only, never exposed to clients).
 * Aliased as `supabase` for legacy imports and as `supabaseAdmin` for clarity in
 * the new auth services.
 */
export const supabase: SupabaseClient = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey
);
export const supabaseAdmin = supabase;

/** Anon client — used for actions that should respect RLS as the end user. */
export const supabaseAnon: SupabaseClient = createClient(
  config.supabaseUrl,
  config.supabaseAnonKey
);

export type Database = any;
