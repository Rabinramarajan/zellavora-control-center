import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DIRECT_URL or DATABASE_URL environment variable is required');
  process.exit(1);
}

// Clean connection string from double quotes if present
const cleanConnectionString = connectionString.replace(/"/g, '');

const client = new Client({
  connectionString: cleanConnectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function main() {
  console.log('Connecting to database...');
  await client.connect();
  console.log('Connected.');

  const migrationsDir = path.join(__dirname, '../../supabase/migrations');
  const files = fs.readdirSync(migrationsDir).sort();

  console.log(`Found ${files.length} migration files.`);

  for (const file of files) {
    if (!file.endsWith('.sql')) continue;
    console.log(`Applying migration: ${file}...`);
    const filepath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filepath, 'utf8');

    try {
      await client.query(sql);
      console.log(`✅ ${file} applied successfully.`);
    } catch (err: any) {
      console.error(`❌ Error applying ${file}:`);
      console.error(`Statement failed: ${err.position ? sql.substring(Math.max(0, err.position - 50), err.position + 150) : 'unknown'}`);
      console.error(err.stack || err.message || err);
      process.exit(1);
    }
  }

  // Notify PostgREST to reload its schema cache
  try {
    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log('📡 PostgREST schema cache reload notified.');
  } catch {
    console.log('⚠️  Could not notify PostgREST (non-fatal).');
  }

  console.log('🎉 All migrations applied successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
