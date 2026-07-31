const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query("SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'organization_role') ORDER BY enumsortorder").then(r => {
  console.log('organization_role enum values:');
  r.rows.forEach(row => console.log(' -', row.enumlabel));
  pool.end();
}).catch(e => console.error(e));