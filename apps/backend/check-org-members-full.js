const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query("SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'organization_members'").then(r => {
  pool.end();
