const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query("SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'organization_members'").then(r => {
  console.log('organization_members columns:');
  r.rows.forEach(row => console.log(' -', row.column_name, 'nullable:', row.is_nullable, 'default:', row.column_default));
  pool.end();
}).catch(e => console.error(e));