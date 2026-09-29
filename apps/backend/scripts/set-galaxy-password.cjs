/** Set a new password for the Galaxy Sofas login. Usage: node scripts/set-galaxy-password.cjs "<password>" */
const path = require('node:path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

const backend = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(backend, '.env.local') });
dotenv.config({ path: path.join(backend, '../../.env.local') });
const email = 'galaxysofas1717@gmail.com';
const password = process.argv[2];
const db = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });

async function main() {
  if (!password || password.length < 8) throw new Error('Pass a password of at least 8 characters');
  await db.connect();
  const hash = await bcrypt.hash(password, 12);
  const result = await db.query(
    `update users set password_hash=$1, updated_at=now()
    where lower(email)=lower($2) and is_deleted=false returning password_hash`,
    [hash, email]
  );
  if (result.rowCount !== 1) throw new Error(`No active account found for ${email}`);
  if (!(await bcrypt.compare(password, result.rows[0].password_hash)))
    throw new Error('Stored hash does not match the new password');
  console.log(`Password updated for ${email}`);
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.end());
