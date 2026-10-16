import type { Express } from 'express';
import { registerApiRoutes } from './index';
import { GUARD_MARK } from '../middleware/auth';

/**
 * Walks every router registered by registerApiRoutes and fails when a route is reachable without
 * a guard (authenticate, requirePermission, requirePlatformAdmin or adminAuthGuard) and is not on
 * the reviewed allow-list below. It is the check that would have caught the unauthenticated
 * organization, notification and storage routes.
 */

type Handler = ((...args: unknown[]) => unknown) & { [GUARD_MARK]?: boolean };
interface Layer {
  name?: string;
  regexp?: RegExp;
  handle: Handler & { stack?: Layer[] };
  route?: {
    path: string | string[];
    methods: Record<string, boolean>;
    stack: { handle: Handler }[];
  };
}

const isGuard = (fn: Handler): boolean => fn[GUARD_MARK] === true;

/** Static mount path recovered from Express's compiled matcher, e.g. `/iam/users`. */
const mountPath = (layer: Layer): string => {
  const source = layer.regexp?.source ?? '';
  if (source === '^\\/?(?=\\/|$)') return '';
  return source
    .replace(/^\^/, '')
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/, '')
    .replace(/\\\//g, '/');
};

interface Found {
  method: string;
  path: string;
  guarded: boolean;
}

const walk = (stack: Layer[], base: string, inheritedGuard: boolean, out: Found[]): void => {
  let guardedHere = inheritedGuard;
  for (const layer of stack) {
    if (layer.route) {
      const guarded = guardedHere || layer.route.stack.some((s) => isGuard(s.handle));
      const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
      for (const p of paths) {
        for (const method of Object.keys(layer.route.methods)) {
          out.push({ method: method.toUpperCase(), path: base + (p === '/' ? '' : p), guarded });
        }
      }
    } else if (layer.handle.stack) {
      walk(layer.handle.stack, base + mountPath(layer), guardedHere, out);
    } else if (isGuard(layer.handle)) {
      guardedHere = true;
    }
  }
};

const collectRoutes = (): Found[] => {
  // Record each mount with its exact path(s), then walk the mounted router.
  const mounts: { paths: string[]; router: { stack: Layer[] } }[] = [];
  registerApiRoutes({
    use(paths: string | string[], router: { stack: Layer[] }) {
      mounts.push({ paths: Array.isArray(paths) ? paths : [paths], router });
    },
  } as unknown as Express);

  const out: Found[] = [];
  for (const { paths, router } of mounts) {
    // Aliases mount the same router, so the first path is enough to judge it.
    walk(router.stack, paths[0], false, out);
  }
  return out;
};

/**
 * Routes that are public on purpose. Keep this short; every entry is a decision to accept
 * anonymous traffic, so a new one needs a review.
 */
const AUTH = '/api/(?:v1|admin)/auth';
const PUBLIC_ROUTES: { method: string; path: RegExp; why: string }[] = [
  {
    method: 'GET',
    path: new RegExp(`^${AUTH}/(config|gettoken)$`),
    why: 'public auth policy and login key',
  },
  {
    method: 'GET',
    path: new RegExp(`^${AUTH}/registration/(organizations|organization-code)$`),
    why: 'sign-up organization lookup',
  },
  {
    method: 'POST',
    path: new RegExp(`^${AUTH}/(login|login/mfa|login/recovery-code|refresh|register)$`),
    why: 'sign-in, token refresh and sign-up',
  },
  {
    method: 'POST',
    path: new RegExp(
      `^${AUTH}/(forgot-password|reset-password|reset-password/validate|verify-email|resend-verification|invitations/preview|invitations/accept)$`
    ),
    why: 'account recovery, email verification and invitations (token-based, rate-limited)',
  },
  {
    method: 'GET',
    path: new RegExp('^/api/v1/operations/health/(liveness|readiness)$'),
    why: 'platform probes',
  },
  { method: 'GET', path: new RegExp('^/api/v1/public/portfolios/'), why: 'public portfolio pages' },
  {
    method: 'GET',
    path: new RegExp('^/api/v1/storage/media/public/[^/]+$'),
    why: 'public media by unguessable id',
  },
  {
    method: 'GET',
    path: new RegExp(
      '^/api/(?:v1|app)/(projects|gallery|technologies)(/|$)|^/api/v1/projects/:projectId/(gallery|technologies)$'
    ),
    why: 'public portfolio showcase reads (legacy routes/, writes are guarded)',
  },
];

describe('route guards', () => {
  const routes = collectRoutes();

  it('finds the registered routes', () => {
    expect(routes.length).toBeGreaterThan(200);
  });

  it('has no unguarded route outside the reviewed public allow-list', () => {
    const unguarded = routes
      .filter((r) => !r.guarded)
      .filter((r) => !PUBLIC_ROUTES.some((p) => p.method === r.method && p.path.test(r.path)))
      .map((r) => `${r.method} ${r.path}`);
    expect(unguarded).toEqual([]);
  });

  it('keeps every allow-list entry in use', () => {
    const stale = PUBLIC_ROUTES.filter(
      (p) => !routes.some((r) => !r.guarded && r.method === p.method && p.path.test(r.path))
    ).map((p) => `${p.method} ${p.path}`);
    expect(stale).toEqual([]);
  });

  it('guards the routes that used to be open', () => {
    const guarded = (method: string, path: string) =>
      routes.find((r) => r.method === method && r.path === path)?.guarded;
    expect(guarded('GET', '/api/v1/organizations/:id')).toBe(true);
    expect(guarded('POST', '/api/v1/organizations')).toBe(true);
    expect(guarded('PUT', '/api/v1/organizations/:id')).toBe(true);
    expect(guarded('GET', '/api/v1/notifications')).toBe(true);
    expect(guarded('GET', '/api/v1/lookups')).toBe(true);
    expect(routes.some((r) => r.path === '/api/v1/storage/upload')).toBe(false);
    expect(routes.some((r) => r.path === '/api/v1/audit-logs/log')).toBe(false);
    expect(routes.some((r) => r.path === '/api/v1/notifications/send')).toBe(false);
  });
});
