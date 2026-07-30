import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

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
  const email = 'superadmin@zellavora.com';
  const password = 'SuperAdmin123!'; // Meets the policy (> 12 chars, uppercase, lowercase, digit, symbol)
  const clientCode = 'demo';
  const orgSlug = 'zellavora';
  const orgName = 'Zellavora Corp';

  console.log('Generating bcrypt hash for password...');
  const passwordHash = await bcrypt.hash(password, 12);
  console.log('Hash generated successfully.');

  // Clean up any existing data for clean idempotency
  console.log('Cleaning up existing organizations/users for demo/superadmin...');
  await supabase.from('users').delete().eq('email', email);
  await supabase.from('organizations').delete().eq('client_code', clientCode);
  await supabase.from('organizations').delete().eq('slug', orgSlug);

  const userId = uuidv4();
  const orgId = uuidv4();

  console.log(`Inserting user: ${email} with ID ${userId}...`);
  const { error: userInsertErr } = await supabase.from('users').insert({
    id: userId,
    email: email,
    full_name: 'Super Admin',
    role: 'admin',
    password_hash: passwordHash,
    is_active: true,
  });

  if (userInsertErr) {
    console.error('Error inserting user:', userInsertErr);
    process.exit(1);
  }

  console.log(`Inserting organization: ${orgName} with ID ${orgId} and client_code ${clientCode}...`);
  const { error: orgInsertErr } = await supabase.from('organizations').insert({
    id: orgId,
    name: orgName,
    slug: orgSlug,
    client_code: clientCode.toUpperCase(),
    owner_id: userId,
    status: 'active',
  });

  if (orgInsertErr) {
    console.error('Error inserting organization:', orgInsertErr);
    // Rollback user
    await supabase.from('users').delete().eq('id', userId);
    process.exit(1);
  }

  console.log(`Updating user ${userId} with tenant_id ${orgId}...`);
  const { error: userUpdateErr } = await supabase.from('users').update({
    tenant_id: orgId,
  }).eq('id', userId);

  if (userUpdateErr) {
    console.error('Error updating user tenant association:', userUpdateErr);
    // Rollback
    await supabase.from('organizations').delete().eq('id', orgId);
    await supabase.from('users').delete().eq('id', userId);
    process.exit(1);
  }

  console.log('\n--- SUCCESS ---');
  console.log('Super Admin user created successfully!');
  console.log(`Client Code: ${clientCode}`);
  console.log(`Email:       ${email}`);
  console.log(`Password:    ${password}`);
  console.log('---------------\n');
}

main().catch(err => {
  console.error('Unexpected error:', err);
});
