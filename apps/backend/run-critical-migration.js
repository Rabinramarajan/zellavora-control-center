require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false }
});

const fs = require('fs');
const path = require('path');

async function runMigration() {
  const sqlFile = path.join(__dirname, 'critical_migration.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');
  
  // Split by semicolon
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
  
  const client = await pool.connect();
  try {
    for (const stmt of statements) {
      if (stmt.trim()) {
        await client.query(stmt);
      }
    }
  } catch (err) {
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();