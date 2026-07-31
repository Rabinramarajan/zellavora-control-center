const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const fs = require('fs');
const sql = fs.readFileSync('fix-branches.sql', 'utf8');
pool.query(sql).then(() => {
  console.log('Branches table fixed!');
  pool.end();
}).catch(e => console.error(e));