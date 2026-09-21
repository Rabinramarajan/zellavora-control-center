import express, { type Express } from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { registerApiRoutes } from './index';
import { swaggerSpec } from '../config/swagger';
import { errorHandler } from '../middleware/error';

type RouteLayer = {
  route?: { path: string | string[]; methods: Record<string, boolean> };
};
type Mount = { paths: string[]; router: { stack: RouteLayer[] } };
type Operation = { operationId: string; summary: string; tags: string[] };
const mounts: Mount[] = [];
registerApiRoutes({
  use(paths: string | string[], router: Mount['router']) {
    mounts.push({ paths: Array.isArray(paths) ? paths : [paths], router });
  },
} as unknown as Express);

const spec = swaggerSpec as {
  paths: Record<string, Record<string, Operation>>;
  tags: { name: string }[];
};
const methods = ['get', 'post', 'put', 'patch', 'delete'];
const canonicalRoutes = mounts.flatMap((mount) =>
  mount.router.stack.flatMap((layer) => {
    if (!layer.route) return [];
    const route = layer.route;
    const relative = Array.isArray(route.path) ? route.path[0] : route.path;
    const path = (mount.paths[0] + (relative === '/' ? '' : relative)).replace(
      /:([A-Za-z][A-Za-z0-9]*)/g,
      '{$1}'
    );
    return Object.keys(route.methods).map((method) => ({ method, path }));
  })
);

describe('API naming contract', () => {
  it('uses lowercase kebab-case for every canonical URL segment', () => {
    for (const { path } of canonicalRoutes) {
      expect(path.replace(/\{[^}]+\}/g, 'id')).toMatch(/^\/[a-z0-9/-]+$/);
      expect(path).not.toContain('/clean/');
    }
  });

  it('documents each registered canonical endpoint', () => {
    const missing = canonicalRoutes.filter(({ method, path }) => !spec.paths[path]?.[method]);
    expect(missing).toEqual([]);
  });

  it('documents real endpoints without publishing compatibility aliases', () => {
    for (const [path, item] of Object.entries(spec.paths)) {
      if (!path.startsWith('/api/v1/') || path.startsWith('/api/v1/rbac/')) continue;
      for (const method of methods.filter((method) => item[method])) {
        expect(canonicalRoutes).toContainEqual({ path, method });
      }
    }
  });

  it('provides unique operation IDs and names without spaces', () => {
    const ids: string[] = [];
    const tags = spec.tags.map((tag) => tag.name);
    for (const tag of tags) expect(tag).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    for (const item of Object.values(spec.paths)) {
      for (const method of methods.filter((method) => item[method])) {
        const operation = item[method];
        expect(operation.operationId).toMatch(/^[a-z][A-Za-z0-9]+$/);
        expect(operation.summary).toMatch(/^[a-z][A-Za-z0-9]+$/);
        for (const tag of operation.tags) expect(tags).toContain(tag);
        ids.push(operation.operationId);
      }
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps historical namespaces on the same router as canonical namespaces', () => {
    expect(mounts.find((m) => m.paths.includes('/api/v1/clean/ddls'))?.paths[0]).toBe(
      '/api/v1/lookups'
    );
    expect(mounts.find((m) => m.paths.includes('/api/v1/register'))?.paths[0]).toBe(
      '/api/v1/registrations'
    );
    expect(mounts.find((m) => m.paths.includes('/api/v1/clean/settings'))?.paths[0]).toBe(
      '/api/v1/organization-settings'
    );
    const adminRoutes = mounts
      .filter((m) => m.paths[0] === '/api/v1/admin')
      .flatMap((m) => m.router.stack);
    expect(
      adminRoutes.find((l) => l.route?.path.includes('/Branch/Branch/Search'))?.route?.path
    ).toEqual(['/branches/search', '/Branch/Branch/Search']);
    expect(
      adminRoutes.find((l) => l.route?.path.includes('/auditlog/LoadAuditLogDetails'))?.route?.path
    ).toEqual(['/audit-logs/details', '/auditlog/LoadAuditLogDetails']);
  });
});

describe('Renamed API HTTP routing', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    registerApiRoutes(app);
    app.use(errorHandler);
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve);
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  });

  it.each([
    ['GET', '/admin/users/search', '/admin/user/search'],
    ['POST', '/admin/branches/search', '/admin/Branch/Branch/Search'],
    ['POST', '/admin/audit-logs/details', '/admin/auditlog/LoadAuditLogDetails'],
    ['POST', '/admin/resources/bulk-save', '/admin/resource/SaveListResource'],
  ])('%s %s and its historical alias enforce authentication', async (method, canonical, alias) => {
    for (const path of [canonical, alias]) {
      const response = await fetch(baseUrl + path, { method });
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: { code: 'NO_TOKEN' } });
    }
  });

  it('serves encryption keys on both canonical and historical URLs', async () => {
    for (const path of ['/auth/encryption-key', '/auth/gettoken']) {
      const response = await fetch(baseUrl + path);
      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload).toHaveLength(2);
      expect(Array.isArray(payload) && payload.every((part) => typeof part === 'string')).toBe(
        true
      );
    }
  });
});
