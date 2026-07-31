const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'invitations' ORDER BY ordinal_position").then(r => {
  console.log('invitations columns:');
  r.rows.forEach(row => console.log(' -', row.column_name));
  pool.end();
}).catch(e => console.error(e));