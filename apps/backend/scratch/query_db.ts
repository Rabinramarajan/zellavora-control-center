import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

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
  console.log('Querying organizations...');
  const { data: orgs, error: orgsErr } = await supabase.from('organizations').select('*');
  if (orgsErr) {
    console.error('Error fetching organizations:', orgsErr);
  } else {
    console.log('Organizations:', orgs);
  }

  console.log('\nQuerying users...');
  const { data: users, error: usersErr } = await supabase.from('users').select('id, email, role, tenant_id');
  if (usersErr) {
    console.error('Error fetching users:', usersErr);
  } else {
    console.log('Users:', users);
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
});
