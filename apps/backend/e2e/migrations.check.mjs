import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../prisma/migrations', import.meta.url));
const all = fs.readdirSync(dir).filter((d) => fs.statSync(path.join(dir, d)).isDirectory()).sort();
const mine = ['20261016000000_p0_security_permissions', '20261016010000_notification_created_at'];
const before = all.filter((m) => !mine.includes(m));
const read = (m) => fs.readFileSync(path.join(dir, m, 'migration.sql'), 'utf8');

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
};

const fresh = async () => {
  const db = new PGlite();
  for (const m of before) await db.exec(read(m));
  return db;
};
const q = async (db, sql, params) => (await db.query(sql, params)).rows;

// ------------------------------------------------------------------ 1. empty database
{
  const db = await fresh();
  let error = null;
  try {
    for (const m of mine) await db.exec(read(m));
  } catch (e) {
    error = e.message;
  }
  check('applies to an empty database', !error, error ?? '');
  const keys = (await q(db, "select key from permissions where key in ('organizations:read','organizations:update') order by key")).map((r) => r.key);
  check('creates the two permission codes', keys.length === 2, keys.join(','));
  check('adds notifications.created_at', (await q(db, "select 1 from information_schema.columns where table_name='notifications' and column_name='created_at'")).length === 1);
  check('creates the recipient/created_at index', (await q(db, "select 1 from pg_indexes where indexname='notifications_recipient_id_created_at_idx'")).length === 1);
}

// ------------------------------------------------------------------ 2. populated database
{
  const db = await fresh();
  const ORG = '00000000-0000-4000-8000-0000000000a1';
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  await db.exec(`
    insert into organizations (id, name, client_code, updated_at) values ('${ORG}', 'Acme', 'acme', now());
    insert into users (id, email, full_name, role, updated_at) values
      ('${id(1)}', 'owner@x.com',   'Owner',    'owner',   now()),
      ('${id(2)}', 'admin@x.com',   'Admin',    'admin',   now()),
      ('${id(3)}', 'viewer@x.com',  'Viewer',   'viewer',  now()),
      ('${id(4)}', 'manager@x.com', 'Manager',  'manager', now()),
      ('${id(5)}', 'gone@x.com',    'Gone',     'owner',   now());
    update users set is_deleted = true where id = '${id(5)}';
    insert into organization_members (user_id, organization_id) values
      ('${id(1)}', '${ORG}'), ('${id(2)}', '${ORG}'), ('${id(3)}', '${ORG}'),
      ('${id(4)}', '${ORG}'), ('${id(5)}', '${ORG}');
    insert into roles (id, name, key, organization_id, updated_at) values
      ('${id(10)}', 'Owner', 'acme_owner', '${ORG}', now()),
      ('${id(11)}', 'Admin', 'acme_admin', '${ORG}', now());
    insert into roles (id, name, key, organization_id, status, updated_at) values
      ('${id(12)}', 'Manager', 'acme_manager', '${ORG}', 'INACTIVE', now());
    insert into permissions (id, name, key) values
      ('${id(20)}', 'all:all', '*:*'),
      ('${id(21)}', 'manage:settings', 'settings:manage');
    insert into role_permissions (id, organization_id, role_id, permission_id) values
      ('${id(30)}', '${ORG}', '${id(10)}', '${id(20)}'),
      ('${id(31)}', '${ORG}', '${id(11)}', '${id(21)}');
    insert into user_role_assignments (id, user_id, role_id, organization_id) values
      ('${id(40)}', '${id(2)}', '${id(11)}', '${ORG}');
    insert into notifications (id, organization_id, body, sent_at) values
      ('${id(50)}', '${ORG}', 'sent one', '2026-01-02T03:04:05Z'),
      ('${id(51)}', '${ORG}', 'never sent', null);
  `);

  let error = null;
  try {
    for (const m of mine) await db.exec(read(m));
  } catch (e) {
    error = e.message;
  }
  check('applies to a populated database', !error, error ?? '');

  const grants = async (roleId) =>
    (await q(db, "select p.key from role_permissions rp join permissions p on p.id=rp.permission_id where rp.role_id=$1 and rp.effect='allow' order by p.key", [roleId])).map((r) => r.key);
  const admin = await grants(id(11));
  check('Admin (holds settings:manage) gains organizations:read and organizations:update',
    ['organizations:read', 'organizations:update'].every((k) => admin.includes(k)), admin.join(','));
  const owner = await grants(id(10));
  check('Owner gains organizations:read only (its *:* already covers the rest)',
    owner.includes('organizations:read') && !owner.includes('organizations:update'), owner.join(','));
  check('an INACTIVE role with no grants gets nothing', (await grants(id(12))).length === 0);

  const assigned = async (userId) =>
    (await q(db, 'select role_id from user_role_assignments where user_id=$1', [userId])).map((r) => r.role_id);
  check('owner with no assignment gets an explicit Owner assignment', JSON.stringify(await assigned(id(1))) === JSON.stringify([id(10)]));
  check('admin already assigned keeps exactly one assignment', (await assigned(id(2))).length === 1);
  check('viewer with no matching role stays unassigned', (await assigned(id(3))).length === 0);
  check('user whose only matching role is INACTIVE stays unassigned', (await assigned(id(4))).length === 0);
  check('deleted user is not given an assignment', (await assigned(id(5))).length === 0);

  const n = await q(db, 'select id, created_at, sent_at from notifications order by id');
  check('notification created_at is backfilled from sent_at',
    new Date(n[0].created_at).toISOString() === '2026-01-02T03:04:05.000Z');
  check('notification never sent still gets a created_at', n[1].created_at !== null);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall migration checks passed');
process.exit(failures ? 1 : 0);
