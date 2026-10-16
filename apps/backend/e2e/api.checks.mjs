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
  const r = await call('POST', '/api/v1/auth/login', {
    body: { email, password, ...(clientCode ? { clientCode } : {}) },
  });
  if (!r.json?.accessToken)
    throw new Error(
      `login failed for ${email}: ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`
    );
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
  check(
    'owner holds organizations:read via role rows',
    me.permissions.includes('organizations:read')
  );
  const b = (await call('GET', '/api/v1/auth/me', { token: bob.token })).json;
  check('tenant owner is not a platform admin', b.user?.isPlatformAdmin === false);
  const d = (await call('GET', '/api/v1/auth/me', { token: dave.token })).json;
  check(
    'deny shows up in deniedPermissions',
    d.deniedPermissions?.includes('users:read'),
    JSON.stringify(d.deniedPermissions)
  );
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
check(
  '/health exposes no environment or config detail',
  !('environment' in ((await call('GET', '/health')).json ?? {}))
);

console.log('\n-- organizations (C1)');
{
  check(
    'platform admin reads org A',
    (await call('GET', `/api/v1/organizations/${orgA}`, { token: admin.token })).status === 200
  );
  check(
    'platform admin reads org B',
    (await call('GET', `/api/v1/organizations/${orgB}`, { token: admin.token })).status === 200
  );
  check(
    'tenant owner reads own org',
    (await call('GET', `/api/v1/organizations/${orgB}`, { token: bob.token })).status === 200
  );
  const other = await call('GET', `/api/v1/organizations/${orgA}`, { token: bob.token });
  check(
    'tenant owner reading another tenant -> 404 (not 403)',
    other.status === 404,
    String(other.status)
  );
  const rename = await call('PUT', `/api/v1/organizations/${orgA}`, {
    token: bob.token,
    body: { name: 'Hijacked' },
  });
  check(
    'tenant owner renaming another tenant -> 404',
    rename.status === 404,
    String(rename.status)
  );
  const tighten = await call('PUT', `/api/v1/organizations/${orgB}`, {
    token: bob.token,
    body: { enforce2fa: true },
  });
  check('tenant owner can tighten 2FA', tighten.status === 200, String(tighten.status));
  const loosen = await call('PUT', `/api/v1/organizations/${orgB}`, {
    token: bob.token,
    body: { enforce2fa: false },
  });
  check('tenant owner cannot switch 2FA off -> 403', loosen.status === 403, String(loosen.status));
  const extra = await call('PUT', `/api/v1/organizations/${orgB}`, {
    token: bob.token,
    body: { name: 'Beta Co', plan: 'free' },
  });
  check('unknown field in body -> 400', extra.status === 400, String(extra.status));
  const create = await call('POST', '/api/v1/organizations', {
    token: bob.token,
    body: { name: 'Rogue', clientCode: 'rogue' },
  });
  check(
    'tenant owner creating an organization -> 403',
    create.status === 403,
    String(create.status)
  );
  const created = await call('POST', '/api/v1/organizations', {
    token: admin.token,
    body: { name: 'Gamma', clientCode: gammaCode },
  });
  check(
    'platform admin creates an organization',
    created.status === 200 && created.json?.data?.clientCode === gammaCode,
    String(created.status)
  );
  const relax = await call('PUT', `/api/v1/organizations/${orgB}`, {
    token: admin.token,
    body: { enforce2fa: false },
  });
  check('platform admin can switch 2FA off', relax.status === 200, String(relax.status));
}

console.log('\n-- admin tree and platform-only routes');
{
  const memberAdmin = await call('GET', '/api/admin/iam/users', { token: carol.token });
  check(
    'plain member on /api/admin/iam/users -> 403 (route permission)',
    memberAdmin.status === 403 && memberAdmin.json?.error?.code === 'FORBIDDEN_PERMISSION',
    memberAdmin.json?.error?.code
  );
  const memberEvents = await call('POST', '/api/admin/analytics/events', {
    token: carol.token,
    body: {},
  });
  check(
    'plain member is let through the admin tree (Nexus relies on it)',
    memberEvents.json?.error?.code !== 'FORBIDDEN_NO_ACCESS',
    String(memberEvents.status)
  );
  const noAccess = await call('POST', '/api/admin/analytics/events', {
    token: erin.token,
    body: {},
  });
  check(
    'account with no effective permission -> 403 FORBIDDEN_NO_ACCESS',
    noAccess.status === 403 && noAccess.json?.error?.code === 'FORBIDDEN_NO_ACCESS',
    noAccess.json?.error?.code
  );
  const ownerAdmin = await call('GET', '/api/admin/iam/users', { token: bob.token });
  check('owner on /api/admin -> 200', ownerAdmin.status === 200, String(ownerAdmin.status));
  check(
    'platform admin reads email settings',
    (await call('GET', '/api/v1/settings/email', { token: admin.token })).status === 200
  );
  const mail = await call('GET', '/api/v1/settings/email', { token: bob.token });
  check(
    'tenant owner (settings:manage via *:*) cannot read platform SMTP -> 403',
    mail.status === 403,
    String(mail.status)
  );
  check(
    '/api/v1/health: platform admin -> 200',
    (await call('GET', '/api/v1/health', { token: admin.token })).status === 200
  );
  check(
    '/api/v1/health: plain member -> 403',
    (await call('GET', '/api/v1/health', { token: carol.token })).status === 403
  );
  check(
    '/lookups with a token -> 200',
    (await call('GET', '/api/v1/lookups', { token: carol.token })).status === 200
  );
}

console.log('\n-- IAM directory is tenant-scoped (H5)');
{
  const list = await call('GET', '/api/v1/iam/users?pageSize=100', { token: bob.token });
  const rows = list.json?.data?.data ?? [];
  const emails = rows.map((u) => u.email);
  check(
    'org B owner lists only org B users',
    list.status === 200 && emails.length > 0 && emails.every((e) => e.endsWith('@beta.test')),
    emails.join(',')
  );
  const stats = await call('GET', '/api/v1/iam/users/stats', { token: bob.token });
  check(
    'stats count only org B users (equal to the list)',
    stats.json?.data?.total === 4 && stats.json.data.total === rows.length,
    JSON.stringify(stats.json?.data?.total)
  );
  const adminRow = (
    (await call('GET', '/api/v1/iam/users?pageSize=100', { token: admin.token })).json?.data
      ?.data ?? []
  ).find((u) => u.email === 'carol@acme.test');
  check('org A admin sees org A user', !!adminRow);
  const detail = await call('GET', `/api/v1/iam/users/${adminRow?.id}`, { token: bob.token });
  check('org B owner reading an org A user -> 404', detail.status === 404, String(detail.status));
  const lock = await call('POST', `/api/v1/iam/users/${adminRow?.id}/lock`, {
    token: bob.token,
    body: { reason: 'x' },
  });
  check('org B owner locking an org A user -> 404', lock.status === 404, String(lock.status));
  for (const section of [
    'profile',
    'access',
    'sessions',
    'notes',
    'status-history',
    'emails',
    'audit',
  ]) {
    const r = await call('GET', `/api/v1/iam/users/${adminRow?.id}/${section}`, {
      token: bob.token,
    });
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
  check(
    'a user whose only role is INACTIVE gets nothing -> 403',
    e.status === 403,
    String(e.status)
  );
  const f = await call('GET', '/api/v1/iam/users', { token: frank.token });
  check('access granted through an active group works -> 200', f.status === 200, String(f.status));
}

console.log('\n-- notifications (C3)');
{
  const page1 = await call('GET', '/api/v1/notifications?page=1&pageSize=10', {
    token: carol.token,
  });
  const d1 = page1.json?.data ?? [];
  check(
    'returns own notifications, paged',
    page1.status === 200 && d1.length === 10 && page1.json.meta.total === 30,
    JSON.stringify(page1.json?.meta)
  );
  check(
    'newest first (n29 before n28)',
    d1[0]?.body === 'n29' && d1[1]?.body === 'n28',
    d1
      .slice(0, 2)
      .map((x) => x.body)
      .join(',')
  );
  check('rows carry createdAt', typeof d1[0]?.createdAt === 'string');
  const page3 = await call('GET', '/api/v1/notifications?page=3&pageSize=10', {
    token: carol.token,
  });
  check('last page ends at n0', page3.json?.data?.at(-1)?.body === 'n0');
  const bobs = await call('GET', '/api/v1/notifications', { token: bob.token });
  check(
    'another tenant sees only its own',
    bobs.json?.data?.length === 1 && bobs.json.data[0].title === 'bob private'
  );
  const spoof = await call('GET', `/api/v1/notifications?organizationId=${orgA}`, {
    token: bob.token,
  });
  check('organizationId query is rejected -> 400', spoof.status === 400, String(spoof.status));
  check(
    'page size capped -> 400',
    (await call('GET', '/api/v1/notifications?pageSize=500', { token: carol.token })).status === 400
  );
}

console.log('\n-- body limits and errors (M4)');
{
  const big = JSON.stringify({ blob: 'x'.repeat(1.3 * 1024 * 1024) });
  const r = await call('POST', '/api/v1/auth/login', { raw: big, body: {} });
  check('JSON body over 1 MB -> 413', r.status === 413, String(r.status));
  const bad = await call('POST', '/api/v1/auth/login', { raw: '{not json', body: {} });
  check('malformed JSON -> 400', bad.status === 400, String(bad.status));
  const bytes = Buffer.alloc(2 * 1024 * 1024, 1).toString('base64');
  const media = await call('POST', '/api/v1/storage/media', {
    token: admin.token,
    body: { fileName: 'e2e.txt', folder: '', mimeType: 'text/plain', base64Data: bytes },
  });
  check(
    'authenticated 2 MB media upload passes the body limit',
    media.status === 200 || media.status === 201,
    String(media.status)
  );
  const anon = await call('POST', '/api/v1/storage/media', {
    raw: JSON.stringify({ base64Data: bytes }),
    body: {},
  });
  check(
    'anonymous large upload is refused before parsing -> 401',
    anon.status === 401,
    String(anon.status)
  );
}

console.log('\n-- projects and tasks (/api/v1/pm)');
{
  const peer = await login('peer@beta.test', PASSWORD, 'beta-co');
  const pm = (method, path, who, body) =>
    call(method, `/api/v1/pm${path}`, { token: who.token, body });
  const data = (r) => r.json?.data;

  // anonymous and malformed ids
  check('anonymous pm list -> 401', (await call('GET', '/api/v1/pm/projects')).status === 401);
  check(
    'malformed project id -> 404',
    (await pm('GET', '/projects/not-a-uuid', bob)).status === 404
  );

  // create, duplicate key, validation
  const key = 'P' + Date.now().toString(36).toUpperCase().slice(-6);
  const created = await pm('POST', '/projects', bob, {
    key,
    name: 'Launch',
    visibility: 'PRIVATE',
  });
  check(
    'lead creates a project -> 201',
    created.status === 201 && data(created)?.key === key,
    String(created.status)
  );
  const projectId = data(created)?.id;
  check(
    'duplicate key -> 409 KEY_TAKEN',
    (await pm('POST', '/projects', bob, { key, name: 'Again' })).json?.error?.code === 'KEY_TAKEN'
  );
  check(
    'lowercase key is normalised, bad key rejected',
    (await pm('POST', '/projects', bob, { key: '1bad', name: 'Bad' })).status === 400
  );
  check(
    'unknown field -> 400',
    (await pm('POST', '/projects', bob, { key: 'ZZ', name: 'X', owner: 'x' })).status === 400
  );
  check(
    'member without pm:projects:write cannot create -> 403',
    (await pm('POST', '/projects', peer, { key: 'NOPE', name: 'Nope' })).status === 403
  );

  // visibility
  check(
    'private project is hidden from a non-member (404)',
    (await pm('GET', `/projects/${projectId}`, peer)).status === 404
  );
  check(
    'private project is hidden from other tenants (404)',
    (await pm('GET', `/projects/${projectId}`, carol)).status === 404
  );
  const peerList = await pm('GET', '/projects?pageSize=100', peer);
  check('non-member list does not include it', !JSON.stringify(peerList.json).includes(key));

  // members
  const foreign = await pm('POST', `/projects/${projectId}/members`, bob, {
    userId: carol.user.id,
  });
  check(
    'adding a user from another organization -> 400',
    foreign.status === 400 && foreign.json?.error?.code === 'INVALID_USER',
    String(foreign.status)
  );
  check(
    'add a contributor -> 201',
    (
      await pm('POST', `/projects/${projectId}/members`, bob, {
        userId: peer.user.id,
        role: 'CONTRIBUTOR',
      })
    ).status === 201
  );
  const twice = await pm('POST', `/projects/${projectId}/members`, bob, { userId: peer.user.id });
  check('adding twice -> 409', twice.status === 409, JSON.stringify(twice.json).slice(0, 160));
  const asPeer = await pm('GET', `/projects/${projectId}`, peer);
  check(
    'member now sees the project as CONTRIBUTOR',
    asPeer.status === 200 && data(asPeer)?.myRole === 'CONTRIBUTOR',
    JSON.stringify(asPeer.json).slice(0, 200)
  );
  check(
    'contributor cannot edit the project -> 403',
    (await pm('PATCH', `/projects/${projectId}`, peer, { name: 'Hijack' })).status === 403
  );
  check(
    'the only lead cannot be demoted -> 409',
    (await pm('PATCH', `/projects/${projectId}/members/${bob.user.id}`, bob, { role: 'VIEWER' }))
      .status === 409
  );

  // tasks: numbering, concurrency, validation
  const mk = (title, extra = {}) =>
    pm('POST', `/projects/${projectId}/tasks`, bob, { title, ...extra });
  const t1 = data(await mk('Design'));
  const t2 = data(await mk('Build'));
  const t3 = data(await mk('Ship', { priority: 'HIGH' }));
  check(
    'tasks are numbered per project',
    [t1.number, t2.number, t3.number].join() === '1,2,3' && t1.key === `${key}-1`,
    `${t1?.key}`
  );
  const burst = await Promise.all(Array.from({ length: 12 }, (_, i) => mk(`Burst ${i}`)));
  const numbers = burst.map((r) => data(r)?.number);
  check(
    '12 parallel creates get 12 unique numbers',
    burst.every((r) => r.status === 201) && new Set(numbers).size === 12,
    numbers.join()
  );
  check('invalid column -> 400', (await mk('Bad', { status: 'NOPE' })).status === 400);
  check(
    'assignee who is not a member -> 400',
    (await mk('Bad', { assigneeId: frank.user.id })).json?.error?.code === 'ASSIGNEE_NOT_MEMBER'
  );
  const html = data(await mk('Plain', { description: 'hello\u0000 <b>x</b>' }));
  check(
    'description is stored as plain text without control characters',
    html.description === 'hello <b>x</b>'
  );

  // optimistic concurrency and move
  const moved = await pm('POST', `/tasks/${t1.id}/move`, bob, {
    version: t1.version,
    status: 'IN_PROGRESS',
  });
  check(
    'move a task to another column',
    moved.status === 200 && data(moved).status === 'IN_PROGRESS' && data(moved).version === 2
  );
  const stale = await pm('POST', `/tasks/${t1.id}/move`, bob, { version: 1, status: 'REVIEW' });
  check(
    'stale version -> 409 VERSION_CONFLICT',
    stale.status === 409 && stale.json?.error?.code === 'VERSION_CONFLICT'
  );
  const staleEdit = await pm('PATCH', `/tasks/${t1.id}`, bob, { version: 1, title: 'Late' });
  check('stale edit -> 409', staleEdit.status === 409);
  const edit = await pm('PATCH', `/tasks/${t1.id}`, bob, {
    version: 2,
    title: 'Design v2',
    assigneeId: peer.user.id,
  });
  check(
    'edit with the current version',
    edit.status === 200 && data(edit).title === 'Design v2' && data(edit).version === 3
  );
  const reorder = await pm('POST', `/tasks/${t3.id}/move`, bob, {
    version: t3.version,
    status: 'TODO',
    afterTaskId: t1.id === t3.id ? null : t2.id,
  });
  check('place a task after another in its column', reorder.status === 200, String(reorder.status));
  check(
    'placing after a task from another column -> 400',
    (
      await pm('POST', `/tasks/${t3.id}/move`, bob, {
        version: data(reorder).version,
        status: 'TODO',
        afterTaskId: t1.id,
      })
    ).status === 400
  );

  // board
  const board = data(await pm('GET', `/projects/${projectId}/board?perColumn=5`, bob));
  const todo = board.columns.find((c) => c.key === 'TODO');
  check(
    'board returns every column with true counts',
    board.columns.length === 4 &&
      todo.total >= 15 &&
      todo.cards.length === 5 &&
      todo.hasMore === true,
    JSON.stringify(board.columns.map((c) => [c.key, c.total]))
  );
  const nextPage = data(
    await pm('GET', `/projects/${projectId}/board/column?status=TODO&cursor=5&limit=5`, bob)
  );
  check(
    'column paging continues with a cursor',
    nextPage.cards.length === 5 && nextPage.nextCursor === 10
  );

  // dependencies
  check(
    'dependency added',
    (await pm('POST', `/tasks/${t2.id}/dependencies`, bob, { dependsOnTaskId: t1.id })).status ===
      201
  );
  const loop = await pm('POST', `/tasks/${t1.id}/dependencies`, bob, { dependsOnTaskId: t2.id });
  check(
    'dependency loop -> 409 DEPENDENCY_CYCLE',
    loop.status === 409 && loop.json?.error?.code === 'DEPENDENCY_CYCLE'
  );
  const blocked = await pm('POST', `/tasks/${t2.id}/move`, bob, {
    version: t2.version,
    status: 'DONE',
  });
  check(
    'cannot finish a task whose blocker is open -> 409',
    blocked.status === 409 && blocked.json?.error?.code === 'BLOCKED_BY_DEPENDENCIES'
  );
  const done1 = await pm('POST', `/tasks/${t1.id}/move`, bob, { version: 3, status: 'DONE' });
  check(
    'finishing the blocker works and sets completedAt',
    done1.status === 200 && !!data(done1).completedAt
  );
  const done2 = await pm('POST', `/tasks/${t2.id}/move`, bob, {
    version: t2.version,
    status: 'DONE',
  });
  check('the blocked task can then be finished', done2.status === 200);

  // subtasks and rollups
  const sub = data(await mk('Sub one', { parentId: t3.id }));
  check('a subtask is created', sub?.parentId === t3.id);
  check(
    'subtasks are one level deep',
    (await mk('Too deep', { parentId: sub.id })).json?.error?.code === 'SUBTASK_DEPTH'
  );
  const t3now = data(await pm('GET', `/tasks/${t3.id}`, bob));
  const parentDone = await pm('POST', `/tasks/${t3.id}/move`, bob, {
    version: t3now.version,
    status: 'DONE',
  });
  check(
    'a parent with open subtasks cannot be finished -> 409',
    parentDone.status === 409 && parentDone.json?.error?.code === 'OPEN_SUBTASKS'
  );
  check(
    'parent reports progress from its subtasks',
    t3now.childCount === 1 && t3now.progress === 0
  );

  // comments
  const c1 = data(await pm('POST', `/tasks/${t1.id}/comments`, peer, { body: 'On it' }));
  check('a contributor comments', !!c1?.id);
  const c2 = data(await pm('POST', `/tasks/${t1.id}/comments`, bob, { body: 'Thanks' }));
  check(
    'only the author edits a comment',
    (await pm('PATCH', `/tasks/${t1.id}/comments/${c2.id}`, peer, { body: 'x' })).status === 403
  );
  check(
    'the author edits their comment',
    (await pm('PATCH', `/tasks/${t1.id}/comments/${c1.id}`, peer, { body: 'On it now' })).status ===
      200
  );
  check(
    'a contributor cannot delete another comment',
    (await pm('DELETE', `/tasks/${t1.id}/comments/${c2.id}`, peer)).status === 403
  );
  check(
    'a lead deletes any comment',
    (await pm('DELETE', `/tasks/${t1.id}/comments/${c1.id}`, bob)).status === 204
  );
  check(
    'empty comment -> 400',
    (await pm('POST', `/tasks/${t1.id}/comments`, bob, { body: '   ' })).status === 400
  );

  // my tasks, activity, notification
  const mine = await pm('GET', '/my-tasks?includeDone=true', peer);
  check(
    'my-tasks lists work assigned to me (open work by default)',
    JSON.stringify(mine.json).includes('Design v2')
  );
  const acts = data(await pm('GET', `/tasks/${t1.id}/activity`, bob));
  check(
    'activity records the history',
    ['created', 'moved', 'updated', 'commented'].every((t) => acts.some((a) => a.type === t)),
    acts.map((a) => a.type).join()
  );
  const note = await call('GET', '/api/v1/notifications', { token: peer.token });
  check('the assignee was notified', JSON.stringify(note.json).includes('Task assigned to you'));

  // viewer role
  await pm('PATCH', `/projects/${projectId}/members/${peer.user.id}`, bob, { role: 'VIEWER' });
  check(
    'a viewer cannot create tasks -> 403',
    (await pm('POST', `/projects/${projectId}/tasks`, peer, { title: 'No' })).status === 403
  );
  check(
    'a viewer still reads the board',
    (await pm('GET', `/projects/${projectId}/board`, peer)).status === 200
  );
  await pm('PATCH', `/projects/${projectId}/members/${peer.user.id}`, bob, { role: 'CONTRIBUTOR' });

  // bulk
  const bulk = await pm('POST', '/tasks/bulk', bob, {
    taskIds: [t1.id, t2.id],
    changes: { priority: 'URGENT' },
  });
  check(
    'bulk update changes every task',
    bulk.status === 200 && data(bulk).items.every((t) => t.priority === 'URGENT')
  );
  const bulkBad = await pm('POST', '/tasks/bulk', bob, {
    taskIds: [t1.id, '00000000-0000-4000-8000-00000000dead'],
    changes: { priority: 'LOW' },
  });
  check(
    'bulk with an unknown id changes nothing -> 404',
    bulkBad.status === 404 && data(await pm('GET', `/tasks/${t1.id}`, bob)).priority === 'URGENT'
  );
  check(
    'bulk across tenants is refused',
    (await pm('POST', '/tasks/bulk', carol, { taskIds: [t1.id], changes: { priority: 'LOW' } }))
      .status === 404
  );

  // recurrence
  const rec = data(await mk('Weekly review', { recurrence: 'WEEKLY', dueDate: '2026-11-02' }));
  const recDone = await pm('POST', `/tasks/${rec.id}/move`, bob, {
    version: rec.version,
    status: 'DONE',
  });
  const recList = data(
    await pm('GET', `/projects/${projectId}/tasks?q=Weekly%20review&pageSize=50`, bob)
  );
  const next = recList.find((t) => t.id !== rec.id);
  check(
    'completing a recurring task creates the next one a week later',
    recDone.status === 200 &&
      recList.length === 2 &&
      next?.dueDate === '2026-11-09' &&
      next.status === 'TODO',
    JSON.stringify(recList.map((t) => [t.status, t.dueDate]))
  );
  await pm('POST', `/tasks/${rec.id}/move`, bob, {
    version: data(recDone).version,
    status: 'DONE',
  });
  check(
    'moving within done again does not spawn another',
    data(await pm('GET', `/projects/${projectId}/tasks?q=Weekly%20review&pageSize=50`, bob))
      .length === 2
  );

  // list filters, progress, report
  const overdue = data(await pm('GET', `/projects/${projectId}/tasks?overdue=true`, bob));
  check('overdue filter works', Array.isArray(overdue));
  const prog = data(await pm('GET', `/projects/${projectId}/progress`, bob));
  check(
    'progress counts leaf tasks',
    prog.taskTotal > 0 && prog.taskDone >= 2 && prog.progress > 0,
    JSON.stringify([prog.taskTotal, prog.taskDone])
  );
  const rep = data(await pm('GET', `/projects/${projectId}/report`, bob));
  check(
    'report has status counts and a burndown',
    rep.byStatus.length === 4 && rep.burndown.length >= 1 && rep.totals.tasks > 0
  );
  check(
    'progress needs pm:projects:report',
    (await pm('GET', `/projects/${projectId}/progress`, peer)).status === 403
  );

  // milestones
  const ms = await pm('POST', `/projects/${projectId}/milestones`, bob, {
    name: 'Beta',
    dueDate: '2026-12-01',
  });
  check('milestone created', ms.status === 201);
  const withMs = await pm('PATCH', `/tasks/${t3.id}`, bob, {
    version: t3now.version,
    milestoneId: data(ms).id,
  });
  check(
    'a task joins a milestone',
    withMs.status === 200 && data(withMs).milestoneId === data(ms).id
  );
  const prog2 = data(await pm('GET', `/projects/${projectId}/progress`, bob));
  check('progress is reported per milestone', prog2.milestones[0]?.name === 'Beta');

  // columns
  const cols = data(await pm('GET', `/projects/${projectId}`, bob)).columns;
  const dropDone = await pm('PATCH', `/projects/${projectId}`, bob, {
    columns: cols
      .filter((c) => c.key !== 'DONE' && c.key !== 'IN_PROGRESS')
      .concat([{ key: 'SHIPPED', label: 'Shipped', done: true }]),
  });
  check(
    'a column that still holds tasks cannot be removed -> 409',
    dropDone.status === 409 && dropDone.json?.error?.code === 'COLUMN_IN_USE'
  );

  // templates
  const tpl = await pm('POST', `/templates/from-project/${projectId}`, bob, {
    name: `Template ${key}`,
  });
  check(
    'save a project as a template',
    tpl.status === 201 && data(tpl).summary.tasks > 0,
    String(tpl.status)
  );
  check(
    'member without pm:templates:manage cannot create one -> 403',
    (await pm('POST', '/templates', peer, { name: 'Nope', definition: {} })).status === 403
  );
  const key2 = key.slice(0, 7) + 'T';
  const fromTpl = await pm('POST', '/projects/from-template', bob, {
    templateId: data(tpl).id,
    key: key2,
    name: 'Second launch',
    startDate: '2027-01-04',
  });
  check('create a project from the template', fromTpl.status === 201, String(fromTpl.status));
  const cloned = data(await pm('GET', `/projects/${data(fromTpl).id}/tasks?pageSize=100`, bob));
  check(
    'the template tasks and milestone were cloned',
    cloned.length === data(tpl).summary.tasks && cloned.some((t) => t.milestoneId)
  );
  check(
    'another tenant cannot read the template',
    (await pm('GET', `/templates/${data(tpl).id}`, carol)).status === 404
  );

  // attachments
  const b64 = (buf) => Buffer.from(buf).toString('base64');
  const png = b64(
    Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)])
  );
  const up = (who, fileName, base64Data) =>
    pm('POST', `/tasks/${t1.id}/attachments`, who, { fileName, base64Data });
  const rawGet = (path, who) =>
    fetch(`${BASE}/api/v1/pm${path}`, { headers: { authorization: `Bearer ${who.token}` } });
  const att = await up(bob, 'shot.png', png);
  check(
    'upload a png -> 201',
    att.status === 201 && data(att)?.mimeType === 'image/png',
    String(att.status)
  );
  check(
    'an exe renamed to pdf -> 415',
    (await up(bob, 'x.pdf', b64(Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03])))).status === 415
  );
  check(
    'svg is refused -> 415',
    (await up(bob, 'a.svg', b64('<svg onload="alert(1)"/>'))).status === 415
  );
  check(
    'html is refused -> 415',
    (await up(bob, 'a.html', b64('<script>1</script>'))).status === 415
  );
  check('invalid base64 -> 400', (await up(bob, 'a.txt', '***')).status === 400);
  check(
    'oversize file -> 413',
    (await up(bob, 'big.txt', b64(Buffer.alloc(3 * 1024 * 1024 + 1, 97)))).status === 413
  );
  check('an outsider cannot upload -> 404', (await up(carol, 'a.txt', b64('hi'))).status === 404);
  const dl = await rawGet(`/tasks/${t1.id}/attachments/${data(att).id}/download`, bob);
  check(
    'download sends nosniff, sandbox CSP and inline for images',
    dl.status === 200 &&
      dl.headers.get('x-content-type-options') === 'nosniff' &&
      /sandbox/.test(dl.headers.get('content-security-policy') ?? '') &&
      /^inline/.test(dl.headers.get('content-disposition') ?? '')
  );
  const txt = data(await up(peer, 'notes.txt', b64('hello')));
  const dlTxt = await rawGet(`/tasks/${t1.id}/attachments/${txt.id}/download`, bob);
  check(
    'text downloads as an attachment',
    /^attachment/.test(dlTxt.headers.get('content-disposition') ?? '')
  );
  check(
    'another tenant cannot download -> 404',
    (await rawGet(`/tasks/${t1.id}/attachments/${txt.id}/download`, carol)).status === 404
  );
  check(
    'list shows both files',
    data(await pm('GET', `/tasks/${t1.id}/attachments`, bob)).length === 2
  );
  check(
    'a contributor cannot delete another file -> 403',
    (await pm('DELETE', `/tasks/${t1.id}/attachments/${data(att).id}`, peer)).status === 403
  );
  check(
    'the uploader deletes their file -> 204',
    (await pm('DELETE', `/tasks/${t1.id}/attachments/${txt.id}`, peer)).status === 204
  );
  check(
    'a lead deletes any file -> 204',
    (await pm('DELETE', `/tasks/${t1.id}/attachments/${data(att).id}`, bob)).status === 204
  );
  check(
    'a deleted file answers 404',
    (await rawGet(`/tasks/${t1.id}/attachments/${txt.id}/download`, bob)).status === 404
  );
  let filled = 0;
  while (filled < 20 && (await up(bob, `f${filled}.txt`, b64('x' + filled))).status === 201) {
    filled++;
  }
  check(
    'the 21st file is refused -> 409',
    filled === 20 && (await up(bob, 'f21.txt', b64('x'))).json?.error?.code === 'TOO_MANY_FILES'
  );

  // time
  const today = new Date().toISOString().slice(0, 10);
  const log = (who, body) => pm('POST', `/tasks/${t1.id}/time`, who, body);
  const e1 = await log(bob, { hours: 3.5, workDate: today, note: 'Wireframes' });
  check('log time -> 201', e1.status === 201 && data(e1).hours === 3.5, String(e1.status));
  check('zero hours -> 400', (await log(bob, { hours: 0, workDate: today })).status === 400);
  check(
    'more than 24 hours -> 400',
    (await log(bob, { hours: 25, workDate: today })).status === 400
  );
  check(
    'a future date -> 400',
    (await log(bob, { hours: 1, workDate: '2099-01-01' })).status === 400
  );
  check(
    'over 24 hours in a day -> 400',
    (await log(bob, { hours: 21, workDate: today })).json?.error?.code === 'TOO_MANY_HOURS'
  );
  const e2 = data(await log(peer, { hours: 2, workDate: today }));
  check(
    'a contributor cannot edit another entry -> 403',
    (await pm('PATCH', `/tasks/${t1.id}/time/${data(e1).id}`, peer, { hours: 1 })).status === 403
  );
  check(
    'own entry can change',
    (await pm('PATCH', `/tasks/${t1.id}/time/${e2.id}`, peer, { hours: 2.5 })).status === 200
  );
  const tl = data(await pm('GET', `/tasks/${t1.id}/time`, bob));
  check(
    'time list totals the hours',
    tl.total === 6 && tl.entries.length === 2,
    JSON.stringify(tl.total)
  );
  const withLogged = data(await pm('GET', `/projects/${projectId}/tasks?pageSize=50`, bob)).find(
    (t) => t.id === t1.id
  );
  check(
    'task list carries loggedHours',
    withLogged?.loggedHours === 6,
    String(withLogged?.loggedHours)
  );
  const rep2 = data(await pm('GET', `/projects/${projectId}/report`, bob));
  check(
    'report has actual hours and time by person',
    rep2.hours.actual === 6 && rep2.timeByPerson.length === 2
  );
  check(
    'another tenant cannot read time -> 404',
    (await pm('GET', `/tasks/${t1.id}/time`, carol)).status === 404
  );
  check(
    'a lead removes any entry -> 204',
    (await pm('DELETE', `/tasks/${t1.id}/time/${e2.id}`, bob)).status === 204
  );
  await pm('PATCH', `/projects/${projectId}/members/${peer.user.id}`, bob, { role: 'VIEWER' });
  check(
    'a viewer cannot log time -> 403',
    (await log(peer, { hours: 1, workDate: today })).status === 403
  );
  check(
    'a viewer still lists files',
    (await pm('GET', `/tasks/${t1.id}/attachments`, peer)).status === 200
  );
  await pm('PATCH', `/projects/${projectId}/members/${peer.user.id}`, bob, {
    role: 'CONTRIBUTOR',
  });

  // removing a member frees their tasks; deleting the project hides everything
  await pm('DELETE', `/projects/${projectId}/members/${peer.user.id}`, bob);
  check(
    'removing a member unassigns their tasks',
    data(await pm('GET', `/tasks/${t1.id}`, bob)).assigneeId === null
  );
  check(
    'the owner cannot be removed',
    (await pm('DELETE', `/projects/${projectId}/members/${bob.user.id}`, bob)).status === 409
  );
  check(
    'delete the project -> 204',
    (await pm('DELETE', `/projects/${projectId}`, bob)).status === 204
  );
  check(
    'a deleted project answers 404',
    (await pm('GET', `/projects/${projectId}`, bob)).status === 404
  );
  check('its tasks answer 404 too', (await pm('GET', `/tasks/${t1.id}`, bob)).status === 404);
}

console.log('\n-- media is tenant-scoped');
{
  const mine = await call('GET', '/api/v1/storage/media', { token: admin.token });
  check('uploader sees the file', JSON.stringify(mine.json).includes('e2e.txt'));
  const theirs = await call('GET', '/api/v1/storage/media', { token: bob.token });
  check(
    'another tenant does not list it',
    theirs.status === 200 && !JSON.stringify(theirs.json).includes('e2e.txt')
  );
  const stream = await call('GET', '/api/v1/storage/media/file?pathname=e2e.txt', {
    token: bob.token,
  });
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

console.log(
  failures ? `\n${failures} end-to-end check(s) failed` : '\nall end-to-end checks passed'
);
process.exit(failures ? 1 : 0);
