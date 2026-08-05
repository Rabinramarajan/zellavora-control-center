const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'organizations' AND column_name IN ('legal_name', 'industry', 'gst_number') ORDER BY ordinal_position").then(r => {
  pool.end();
