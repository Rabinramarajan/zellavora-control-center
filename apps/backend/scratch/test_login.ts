import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';

// Load env
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase URL or service role key in env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  const email = 'admin@zellavora.com';
  const password = 'AdminPassword123!';
  const clientCode = 'demo';

  console.log(`1. Resolving tenant by client code: ${clientCode}...`);
  const { data: tenant, error: tenantErr } = await supabase
    .from('organizations')
    .select('*')
    .ilike('client_code', clientCode)
    .maybeSingle();

  if (tenantErr || !tenant) {
    console.error('Tenant not found or error:', tenantErr);
    return;
  }
  console.log('Tenant resolved successfully:', { id: tenant.id, name: tenant.name, status: tenant.status });

  console.log(`\n2. Querying user by email ${email} in tenant ${tenant.id}...`);
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .eq('tenant_id', tenant.id)
    .maybeSingle();

  if (userErr || !user) {
    console.error('User not found or error:', userErr);
    return;
  }
  console.log('User found:', {
    id: user.id,
    email: user.email,
    role: user.role,
    is_active: user.is_active,
    has_hash: !!user.password_hash,
  });

  console.log('\n3. Verifying password against stored hash...');
  const ok = await bcrypt.compare(password, user.password_hash || '');
  console.log(`Password match result: ${ok}`);
}

main().catch(err => {
  console.error('Unexpected error:', err);
});
