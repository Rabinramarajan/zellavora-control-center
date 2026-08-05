require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false, require: true }
});

const fs = require('fs');
const path = require('path');

async function runMigration() {
  const sqlFile = path.join(__dirname, 'prisma/migrations/20260731000001_add_missing_org_columns/migration.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');
  
  // Split by semicolon but be careful with function definitions
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
  
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