/** Create the requested company login without modifying any existing account. */
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, randomBytes } = require('node:crypto');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

const backend = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(backend, '.env.local') });
dotenv.config({ path: path.join(backend, '../../.env.local') });
const db = new Client({
  // Advisory locks and transactions need a session connection, not the transaction pooler.
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
});
const email = 'galaxysofas1717@gmail.com';
const menuKeys = ['dashboard', 'media', 'cms-builder', 'settings'];
const permissionKeys = [
  'navigation:restricted',
  ...menuKeys.map((key) => `navigation:${key}`),
  'dashboard:read',
  'media:read',
  'media:delete',
  'cms:read',
  'cms:write',
  'settings:manage',
  'settings:write',
];

async function main() {
  await db.connect();
  await db.query('BEGIN');
  let credentialFile;
  try {
    await db.query("select pg_advisory_xact_lock(hashtext('create:galaxy-login'))");
    const tenant = (
      await db.query(
        "select id from organizations where client_code='galaxy-sofas' and is_deleted=false"
      )
    ).rows[0];
    if (!tenant) throw new Error('Import the Galaxy Sofas tenant first');
    const existing = (await db.query('select id from users where lower(email)=lower($1)', [email]))
      .rows[0];
    if (existing)
      throw new Error('This email already has an account. No password or access was changed.');
    const roleKey = `${tenant.id}_galaxy_website_manager`;
    if ((await db.query('select id from roles where key=$1', [roleKey])).rowCount) {
      throw new Error('The website manager role already exists; review it before assigning access');
    }
    const userId = randomUUID();
    const roleId = randomUUID();
    const password = `Gs!7${randomBytes(18).toString('base64url')}`;
    const hash = await bcrypt.hash(password, 12);
    await db.query(
      `insert into users
      (id,email,email_id,full_name,password_hash,role,tenant_id,default_landing_page,updated_at)
      values ($1,$2,$2,'Galaxy Sofas',$3,'member',$4,'/dashboard',now())`,
      [userId, email, hash, tenant.id]
    );
    await db.query(
      `insert into organization_members (user_id,organization_id,role,is_default)
      values ($1,$2,'member',true)`,
      [userId, tenant.id]
    );
    await db.query(
      `insert into roles (id,name,key,organization_id,description,updated_at)
      values ($1,'Galaxy Website Manager',$2,$3,'Dashboard, Media, CMS Builder and Settings only',now())`,
      [roleId, roleKey, tenant.id]
    );
    for (const key of permissionKeys) {
      await db.query(
        `insert into permissions (id,name,key,resource,action)
        values ($1,$2,$2,$3,$4) on conflict (key) do nothing`,
        [randomUUID(), key, key.split(':')[0], key.split(':')[1]]
      );
      const permission = (await db.query('select id from permissions where key=$1', [key])).rows[0];
      await db.query(
        `insert into role_permissions (id,organization_id,role_id,permission_id,effect)
        values ($1,$2,$3,$4,'allow')`,
        [randomUUID(), tenant.id, roleId, permission.id]
      );
    }
    await db.query(
      `insert into user_role_assignments
      (id,user_id,role_id,organization_id,resource_type,resource_id)
      values ($1,$2,$3,$4::uuid,'tenant',$4::text)`,
      [randomUUID(), userId, roleId, tenant.id]
    );
    const folder = path.join(backend, '../../tmp/galaxy-sofas');
    fs.mkdirSync(folder, { recursive: true });
    credentialFile = path.join(folder, `login-${userId}.txt`);
    fs.writeFileSync(
      credentialFile,
      `Client code: galaxy-sofas\nEmail: ${email}\nPassword: ${password}\nMenus: Dashboard, Media, CMS Builder, Settings\n`,
      { flag: 'wx', mode: 0o600 }
    );
    await db.query('COMMIT');
    console.log(
      JSON.stringify(
        { userId, email, tenantId: tenant.id, menus: menuKeys, credentialFile },
        null,
        2
      )
    );
  } catch (error) {
    await db.query('ROLLBACK');
    if (credentialFile && fs.existsSync(credentialFile)) fs.unlinkSync(credentialFile);
    throw error;
  }
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.end());
