import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcrypt';

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
  const password = 'AdminPassword123!'; // Meets validation policy (> 12 chars, uppercase, lowercase, digit, symbol)
  const clientCode = 'DEMO';

  console.log(`Querying organization ID for client code: ${clientCode}...`);
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('id')
    .eq('client_code', clientCode)
    .single();

  if (orgErr || !org) {
    console.error('Could not find DEMO organization:', orgErr);
    process.exit(1);
  }

  const orgId = org.id;
  console.log(`Found organization ID: ${orgId}`);

  console.log('Generating bcrypt hash for password...');
  const passwordHash = await bcrypt.hash(password, 12);

  console.log(`Updating user: ${email}...`);
  const { error: userUpdateErr } = await supabase
    .from('users')
    .update({
      tenant_id: orgId,
      password_hash: passwordHash,
      is_active: true,
      full_name: 'Administrator',
      role: 'admin',
    })
    .eq('email', email);

  if (userUpdateErr) {
    console.error('Error updating admin user:', userUpdateErr);
    process.exit(1);
  }

  console.log('\n--- SUCCESS ---');
  console.log('Admin user updated and linked to DEMO organization!');
  console.log(`Client Code: demo`);
  console.log(`Email:       ${email}`);
  console.log(`Password:    ${password}`);
  console.log('---------------\n');
}

main().catch(err => {
  console.error('Unexpected error:', err);
});
