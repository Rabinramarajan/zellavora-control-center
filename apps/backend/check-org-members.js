const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'organization_members' ORDER BY ordinal_position").then(r => {
  console.log('organization_members columns:');
  r.rows.forEach(row => console.log(' -', row.column_name, ':', row.data_type));
  pool.end();
}).catch(e => console.error(e));