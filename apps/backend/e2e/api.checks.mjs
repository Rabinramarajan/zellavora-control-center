const BASE = `http://127.0.0.1:${process.env.E2E_API_PORT ?? 3055}`;
const PASSWORD = 'E2e-Passw0rd!x';
let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  [' + detail + ']' : ''}`);
  if (!ok) failures++;
};

const call = async (method, path, { token, body, raw } = {}) => {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* not json */
  }
  return { status: res.status, json, headers: res.headers };
};

const login = async (email, password, clientCode) => {
  const r = await call('POST', '/api/v1/auth/login', { body: { email, password, ...(clientCode ? { clientCode } : {}) } });
  if (!r.json?.accessToken) throw new Error(`login failed for ${email}: ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  return { token: r.json.accessToken, tenant: r.json.tenant.id, user: r.json.user };
};

const admin = await login('admin@zellavora.com', 'AdminPassword123!');
const bob = await login('bob@beta.test', PASSWORD, 'beta-co');
const carol = await login('carol@acme.test', PASSWORD);
const dave = await login('dave@beta.test', PASSWORD, 'beta-co');
const erin = await login('erin@beta.test', PASSWORD, 'beta-co');
const frank = await login('frank@beta.test', PASSWORD, 'beta-co');
const gammaCode = 'g' + Date.now().toString(36);
const orgA = admin.tenant;
const orgB = bob.tenant;

console.log('\n-- /auth/me');
{
  const me = (await call('GET', '/api/v1/auth/me', { token: admin.token })).json;
  check('platform admin sees isPlatformAdmin=true', me.user?.isPlatformAdmin === true);
  check('/auth/me carries deniedPermissions', Array.isArray(me.deniedPermissions));
  check('owner holds organizations:read via role rows', me.permissions.includes('organizations:read'));
  const b = (await call('GET', '/api/v1/auth/me', { token: bob.token })).json;
  check('tenant owner is not a platform admin', b.user?.isPlatformAdmin === false);
  const d = (await call('GET', '/api/v1/auth/me', { token: dave.token })).json;
  check('deny shows up in deniedPermissions', d.deniedPermissions?.includes('users:read'), JSON.stringify(d.deniedPermissions));
  check('deny removes the exact code from permissions', !d.permissions.includes('users:read'));
}

console.log('\n-- anonymous');
for (const [m, p] of [
  ['GET', `/api/v1/organizations/${orgA}`],
  ['POST', '/api/v1/organizations'],
  ['GET', '/api/v1/notifications'],
  ['GET', '/api/v1/lookups'],
  ['GET', '/api/v1/iam/users'],
  ['GET', '/api/v1/settings/email'],
  ['GET', '/api/v1/health'],
]) {
  const r = await call(m, p);
  check(`${m} ${p.replace(orgA, ':id')} -> 401`, r.status === 401, String(r.status));
}
for (const [m, p] of [
  ['POST', '/api/v1/storage/upload'],
  ['POST', '/api/v1/audit-logs/log'],
  ['POST', '/api/v1/notifications/send'],
  ['GET', '/api/v1/rbac/roles'],
  ['GET', `/api/v1/clean/organizations/${orgA}`],
  ['GET', '/api/v1/Authentication/gettoken'],
]) {
  const r = await call(m, p, { token: admin.token, body: m === 'POST' ? {} : undefined });
  check(`${m} ${p.replace(orgA, ':id')} is gone -> 404`, r.status === 404, String(r.status));
}
check('/health exposes no environment or config detail', !('environment' in ((await call('GET', '/health')).json ?? {})));

console.log('\n-- organizations (C1)');
{
  check('platform admin reads org A', (await call('GET', `/api/v1/organizations/${orgA}`, { token: admin.token })).status === 200);
  check('platform admin reads org B', (await call('GET', `/api/v1/organizations/${orgB}`, { token: admin.token })).status === 200);
  check('tenant owner reads own org', (await call('GET', `/api/v1/organizations/${orgB}`, { token: bob.token })).status === 200);
  const other = await call('GET', `/api/v1/organizations/${orgA}`, { token: bob.token });
  check('tenant owner reading another tenant -> 404 (not 403)', other.status === 404, String(other.status));
  const rename = await call('PUT', `/api/v1/organizations/${orgA}`, { token: bob.token, body: { name: 'Hijacked' } });
  check('tenant owner renaming another tenant -> 404', rename.status === 404, String(rename.status));
  const tighten = await call('PUT', `/api/v1/organizations/${orgB}`, { token: bob.token, body: { enforce2fa: true } });
  check('tenant owner can tighten 2FA', tighten.status === 200, String(tighten.status));
  const loosen = await call('PUT', `/api/v1/organizations/${orgB}`, { token: bob.token, body: { enforce2fa: false } });
  check('tenant owner cannot switch 2FA off -> 403', loosen.status === 403, String(loosen.status));
  const extra = await call('PUT', `/api/v1/organizations/${orgB}`, { token: bob.token, body: { name: 'Beta Co', plan: 'free' } });
  check('unknown field in body -> 400', extra.status === 400, String(extra.status));
  const create = await call('POST', '/api/v1/organizations', { token: bob.token, body: { name: 'Rogue', clientCode: 'rogue' } });
  check('tenant owner creating an organization -> 403', create.status === 403, String(create.status));
  const created = await call('POST', '/api/v1/organizations', { token: admin.token, body: { name: 'Gamma', clientCode: gammaCode } });
  check('platform admin creates an organization', created.status === 200 && created.json?.data?.clientCode === gammaCode, String(created.status));
  const relax = await call('PUT', `/api/v1/organizations/${orgB}`, { token: admin.token, body: { enforce2fa: false } });
  check('platform admin can switch 2FA off', relax.status === 200, String(relax.status));
}

console.log('\n-- admin tree and platform-only routes');
{
  const memberAdmin = await call('GET', '/api/admin/iam/users', { token: carol.token });
  check('plain member on /api/admin/iam/users -> 403 (route permission)', memberAdmin.status === 403 && memberAdmin.json?.error?.code === 'FORBIDDEN_PERMISSION', memberAdmin.json?.error?.code);
  const memberEvents = await call('POST', '/api/admin/analytics/events', { token: carol.token, body: {} });
  check('plain member is let through the admin tree (Nexus relies on it)', memberEvents.json?.error?.code !== 'FORBIDDEN_NO_ACCESS', String(memberEvents.status));
  const noAccess = await call('POST', '/api/admin/analytics/events', { token: erin.token, body: {} });
  check('account with no effective permission -> 403 FORBIDDEN_NO_ACCESS', noAccess.status === 403 && noAccess.json?.error?.code === 'FORBIDDEN_NO_ACCESS', noAccess.json?.error?.code);
  const ownerAdmin = await call('GET', '/api/admin/iam/users', { token: bob.token });
  check('owner on /api/admin -> 200', ownerAdmin.status === 200, String(ownerAdmin.status));
  check('platform admin reads email settings', (await call('GET', '/api/v1/settings/email', { token: admin.token })).status === 200);
  const mail = await call('GET', '/api/v1/settings/email', { token: bob.token });
  check('tenant owner (settings:manage via *:*) cannot read platform SMTP -> 403', mail.status === 403, String(mail.status));
  check('/api/v1/health: platform admin -> 200', (await call('GET', '/api/v1/health', { token: admin.token })).status === 200);
  check('/api/v1/health: plain member -> 403', (await call('GET', '/api/v1/health', { token: carol.token })).status === 403);
  check('/lookups with a token -> 200', (await call('GET', '/api/v1/lookups', { token: carol.token })).status === 200);
}

console.log('\n-- IAM directory is tenant-scoped (H5)');
{
  const list = await call('GET', '/api/v1/iam/users?pageSize=100', { token: bob.token });
  const rows = list.json?.data?.data ?? [];
  const emails = rows.map((u) => u.email);
  check('org B owner lists only org B users', list.status === 200 && emails.length > 0 && emails.every((e) => e.endsWith('@beta.test')), emails.join(','));
  const stats = await call('GET', '/api/v1/iam/users/stats', { token: bob.token });
  check('stats count only org B users (equal to the list, 3 approved)', stats.json?.data?.total === 3 && stats.json.data.total === rows.length, JSON.stringify(stats.json?.data?.total));
  const adminRow = ((await call('GET', '/api/v1/iam/users?pageSize=100', { token: admin.token })).json?.data?.data ?? []).find((u) => u.email === 'carol@acme.test');
  check('org A admin sees org A user', !!adminRow);
  const detail = await call('GET', `/api/v1/iam/users/${adminRow?.id}`, { token: bob.token });
  check('org B owner reading an org A user -> 404', detail.status === 404, String(detail.status));
  const lock = await call('POST', `/api/v1/iam/users/${adminRow?.id}/lock`, { token: bob.token, body: { reason: 'x' } });
  check('org B owner locking an org A user -> 404', lock.status === 404, String(lock.status));
  for (const section of ['profile', 'access', 'sessions', 'notes', 'status-history', 'emails', 'audit']) {
    const r = await call('GET', `/api/v1/iam/users/${adminRow?.id}/${section}`, { token: bob.token });
    check(`org B owner reading org A user /${section} -> 404`, r.status === 404, String(r.status));
  }
  const own = await call('GET', `/api/v1/iam/users/${bob.user.id}/profile`, { token: bob.token });
  check('org B owner reading own profile -> 200', own.status === 200, String(own.status));
}

console.log('\n-- permission resolution (H6)');
{
  const d = await call('GET', '/api/v1/iam/users', { token: dave.token });
  check('deny on users:read beats the Owner wildcard -> 403', d.status === 403, String(d.status));
  const e = await call('GET', '/api/v1/iam/users', { token: erin.token });
  check('a user whose only role is INACTIVE gets nothing -> 403', e.status === 403, String(e.status));
  const f = await call('GET', '/api/v1/iam/users', { token: frank.token });
  check('access granted through an active group works -> 200', f.status === 200, String(f.status));
}

console.log('\n-- notifications (C3)');
{
  const page1 = await call('GET', '/api/v1/notifications?page=1&pageSize=10', { token: carol.token });
  const d1 = page1.json?.data ?? [];
  check('returns own notifications, paged', page1.status === 200 && d1.length === 10 && page1.json.meta.total === 30, JSON.stringify(page1.json?.meta));
  check('newest first (n29 before n28)', d1[0]?.body === 'n29' && d1[1]?.body === 'n28', d1.slice(0, 2).map((x) => x.body).join(','));
  check('rows carry createdAt', typeof d1[0]?.createdAt === 'string');
  const page3 = await call('GET', '/api/v1/notifications?page=3&pageSize=10', { token: carol.token });
  check('last page ends at n0', page3.json?.data?.at(-1)?.body === 'n0');
  const bobs = await call('GET', '/api/v1/notifications', { token: bob.token });
  check('another tenant sees only its own', bobs.json?.data?.length === 1 && bobs.json.data[0].title === 'bob private');
  const spoof = await call('GET', `/api/v1/notifications?organizationId=${orgA}`, { token: bob.token });
  check('organizationId query is rejected -> 400', spoof.status === 400, String(spoof.status));
  check('page size capped -> 400', (await call('GET', '/api/v1/notifications?pageSize=500', { token: carol.token })).status === 400);
}

console.log('\n-- body limits and errors (M4)');
{
  const big = JSON.stringify({ blob: 'x'.repeat(1.3 * 1024 * 1024) });
  const r = await call('POST', '/api/v1/auth/login', { raw: big, body: {} });
  check('JSON body over 1 MB -> 413', r.status === 413, String(r.status));
  const bad = await call('POST', '/api/v1/auth/login', { raw: '{not json', body: {} });
  check('malformed JSON -> 400', bad.status === 400, String(bad.status));
  const bytes = Buffer.alloc(2 * 1024 * 1024, 1).toString('base64');
  const media = await call('POST', '/api/v1/storage/media', { token: admin.token, body: { fileName: 'e2e.txt', folder: '', mimeType: 'text/plain', base64Data: bytes } });
  check('authenticated 2 MB media upload passes the body limit', media.status === 200 || media.status === 201, String(media.status));
  const anon = await call('POST', '/api/v1/storage/media', { raw: JSON.stringify({ base64Data: bytes }), body: {} });
  check('anonymous large upload is refused before parsing -> 401', anon.status === 401, String(anon.status));
}

console.log('\n-- media is tenant-scoped');
{
  const mine = await call('GET', '/api/v1/storage/media', { token: admin.token });
  check('uploader sees the file', JSON.stringify(mine.json).includes('e2e.txt'));
  const theirs = await call('GET', '/api/v1/storage/media', { token: bob.token });
  check('another tenant does not list it', theirs.status === 200 && !JSON.stringify(theirs.json).includes('e2e.txt'));
  const stream = await call('GET', '/api/v1/storage/media/file?pathname=e2e.txt', { token: bob.token });
  check('another tenant cannot stream it -> 404', stream.status === 404, String(stream.status));
  const del = await call('DELETE', '/api/v1/storage/media?pathname=e2e.txt', { token: bob.token });
  check('another tenant cannot delete it -> 404', del.status === 404, String(del.status));
}

console.log('\n-- security headers (M5)');
{
  const api = (await fetch(BASE + '/health')).headers.get('content-security-policy') ?? '';
  const sw = (await fetch(BASE + '/swagger')).headers.get('content-security-policy') ?? '';
  check('API CSP has no unsafe-inline scripts', !/script-src[^;]*unsafe-inline/.test(api));
  check('Swagger CSP allows its inline bootstrap', /script-src[^;]*unsafe-inline/.test(sw));
}

console.log(failures ? `\n${failures} end-to-end check(s) failed` : '\nall end-to-end checks passed');
process.exit(failures ? 1 : 0);
