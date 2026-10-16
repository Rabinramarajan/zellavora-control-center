/**
 * End-to-end run against a real Prisma client and a real Postgres engine, with no external services.
 *
 * It starts an in-process PGlite (Postgres compiled to WebAssembly) behind a socket, applies every
 * migration through `prisma migrate deploy`, fails if the result drifts from schema.prisma, seeds the
 * database, adds the fixtures in fixtures.ts, starts the API and runs api.checks.mjs against it.
 *
 *   npm run e2e
 *
 * PGlite serves one session, so Prisma runs with `pgbouncer=true` (unnamed statements) and the
 * steps run one after another.
 */
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const DB_PORT = Number(process.env.E2E_DB_PORT ?? 5544);
const API_PORT = Number(process.env.E2E_API_PORT ?? 3055);
const base = `postgresql://postgres:postgres@127.0.0.1:${DB_PORT}/postgres`;

const env = {
  ...process.env,
  DATABASE_URL: `${base}?pgbouncer=true&connection_limit=1&sslmode=disable`,
  DIRECT_URL: `${base}?sslmode=disable`,
  NODE_ENV: 'development',
  // The API loads .env.local; blank these so the run never touches a developer's Redis or mail server.
  // (An empty value wins because dotenv does not override variables that are already set.)
  REDIS_URL: '',
  REDIS_PASSWORD: '',
  REDIS_ENABLED: 'false',
  SMTP_HOST: '',
  EMAIL_PROVIDER: 'console',
  PORT: String(API_PORT),
  E2E_API_PORT: String(API_PORT),
  JWT_SECRET: 'e2e-access-secret-at-least-32-bytes-long',
  REFRESH_TOKEN_SECRET: 'e2e-refresh-secret-at-least-32-bytes-long',
};

const run = (label, command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, shell: process.platform === 'win32', stdio: options.quiet ? 'ignore' : 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${label} exited with ${code}`))));
  });

const capture = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, shell: process.platform === 'win32' });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve(out) : reject(new Error(out))));
  });

const waitForHealth = async () => {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${API_PORT}/health`)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('the API did not become healthy');
};

let api;
let db;
let socket;
let failed = false;
try {
  // A leftover API from an earlier run would answer the checks with stale state.
  const busy = await fetch(`http://127.0.0.1:${API_PORT}/health`).then(() => true, () => false);
  if (busy) throw new Error(`port ${API_PORT} is already serving; stop it or set E2E_API_PORT`);

  console.log('> starting PGlite on', DB_PORT);
  db = await PGlite.create();
  socket = new PGLiteSocketServer({ db, port: DB_PORT, host: '127.0.0.1', maxConnections: 20 });
  await socket.start();

  const deployEnv = { ...env };
  console.log('> prisma migrate deploy');
  await new Promise((resolve, reject) => {
    const child = spawn('npx', ['prisma', 'migrate', 'deploy'], {
      cwd: root,
      env: { ...deployEnv, DATABASE_URL: deployEnv.DIRECT_URL },
      shell: process.platform === 'win32',
      stdio: 'inherit',
    });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('migrate deploy failed'))));
  });

  console.log('> checking the migrations match schema.prisma');
  const diff = await capture('npx', ['prisma', 'migrate', 'diff', '--from-url', env.DIRECT_URL, '--to-schema-datamodel', 'prisma/schema.prisma', '--script']);
  if (!diff.includes('-- This is an empty migration.')) throw new Error(`schema drift:\n${diff}`);

  console.log('> seeding');
  await run('seed', 'npx', ['tsx', 'src/db/seed.ts'], { quiet: true });
  console.log('> fixtures');
  await run('fixtures', 'npx', ['tsx', 'e2e/fixtures.ts'], { quiet: true });

  console.log('> starting the API on', API_PORT);
  api = spawn('npx', ['tsx', 'src/index.ts'], { cwd: root, env, shell: process.platform === 'win32', stdio: process.env.E2E_VERBOSE ? 'inherit' : 'ignore' });
  await waitForHealth();

  console.log('> api checks');
  await run('api checks', 'node', ['e2e/api.checks.mjs']);
} catch (error) {
  failed = true;
  console.error(String(error?.message ?? error));
} finally {
  if (api) {
    // Synchronous: process.exit below would otherwise cut the kill short and leave the API running.
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(api.pid), '/T', '/F'], { stdio: 'ignore' });
    else api.kill('SIGTERM');
  }
  await socket?.stop().catch(() => undefined);
  await db?.close().catch(() => undefined);
  process.exit(failed ? 1 : 0);
}
