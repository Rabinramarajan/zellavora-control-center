const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query("SELECT udt_name, data_type FROM information_schema.columns WHERE table_name = 'organization_members' AND column_name = 'role'").then(r => {
  console.log('role column type:', r.rows);
  pool.end();
}).catch(e => console.error(e));