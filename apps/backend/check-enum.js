const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query("SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'role_type')").then(r => {
  console.log('role_type enum values:');
  r.rows.forEach(row => console.log(' -', row.enumlabel));
  pool.end();
}).catch(e => console.error(e));