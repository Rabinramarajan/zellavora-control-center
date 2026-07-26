import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

export const getSupabaseClient = (authHeader?: string) => {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  
  const options = authHeader ? {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
    auth: {
      persistSession: false,
    },
  } : {
    auth: {
      persistSession: false,
    },
  };

  return createClient(url, anonKey, options);
};

export const getSupabaseAdmin = () => {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
};
