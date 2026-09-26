/**
 * Run a local tool with the same environment the backend uses.
 *
 * The Prisma CLI and the seed scripts do not load `.env.local`, where local
 * settings live (repo root, or apps/backend). Load those the way
 * src/config/env.ts does — never overriding variables already set, so CI and
 * hosted platforms keep their own — then run the command.
 *
 *   node scripts/with-env.cjs prisma migrate deploy
 *   node scripts/with-env.cjs tsx src/db/seed.ts
 */
const path = require('path');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');

const backendRoot = path.resolve(__dirname, '..');
for (const file of [
  path.join(backendRoot, '.env.local'),
  path.join(backendRoot, '..', '..', '.env.local'),
  path.join(backendRoot, '.env'),
]) {
  dotenv.config({ path: file, override: false });
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('Usage: node scripts/with-env.cjs <command> [...args]');
  process.exit(1);
}

const result = spawnSync('npx', [command, ...args], {
  cwd: backendRoot,
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
