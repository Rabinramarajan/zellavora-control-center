import type { Server } from 'http';
import type { AddressInfo } from 'net';
import app from '../app';

/**
 * Regression tests for the findings that let anonymous callers reach tenant data: C1 organizations,
 * C3 notifications, H2 disk upload, H3 audit write, M9 lookups, L1 gettoken aliases, M1 rbac.
 */
describe('anonymous access', () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve);
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  });

  const call = (method: string, path: string, body?: unknown) =>
    fetch(base + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

  it.each([
    ['GET', '/api/v1/organizations/11111111-1111-4111-8111-111111111111'],
    ['POST', '/api/v1/organizations'],
    ['PUT', '/api/v1/organizations/11111111-1111-4111-8111-111111111111'],
    ['GET', '/api/v1/notifications'],
    ['POST', '/api/v1/notifications/send'],
    ['GET', '/api/v1/lookups'],
    ['GET', '/api/v1/lookups/types'],
    ['GET', '/api/v1/lookups/countries'],
    ['GET', '/api/v1/storage/media'],
    ['POST', '/api/v1/storage/media'],
    ['GET', '/api/v1/settings/email'],
    ['GET', '/api/v1/iam/users'],
    ['GET', '/api/v1/health'],
    ['GET', '/api/admin/organizations/11111111-1111-4111-8111-111111111111'],
    ['GET', '/api/app/notifications'],
  ])('%s %s answers 401 without a token', async (method, path) => {
    const response = await call(method, path);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: 'NO_TOKEN' } });
  });

  it.each([
    ['POST', '/api/v1/storage/upload'],
    ['POST', '/api/v1/audit-logs/log'],
    ['POST', '/api/v1/operations/audit-logs/log'],
    ['GET', '/api/v1/admin/api/Authentication/gettoken'],
    ['GET', '/api/v1/Authentication/gettoken'],
    ['GET', '/api/v1/rbac/roles'],
    ['GET', '/api/v1/clean/organizations/11111111-1111-4111-8111-111111111111'],
    ['GET', '/api/v1/clean/notifications'],
  ])('%s %s no longer exists', async (method, path) => {
    expect((await call(method, path)).status).toBe(404);
  });

  it('no longer serves the admin-tree gettoken alias', async () => {
    expect((await call('GET', '/api/admin/Authentication/gettoken')).status).not.toBe(200);
  });

  it('still serves the login key from the auth module', async () => {
    expect((await call('GET', '/api/v1/auth/gettoken')).status).toBe(200);
  });
});

describe('public surface', () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve);
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  });

  it('/health reports status only', async () => {
    const response = await fetch(base + '/health');
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty('environment');
    expect(body).not.toHaveProperty('configErrors');
    expect(body).not.toHaveProperty('rbac');
    expect(typeof body.timestamp).toBe('string');
    expect(['ok', 'degraded']).toContain(body.status);
  });

  it('rejects a JSON body over 1 MB before any route runs', async () => {
    const response = await fetch(base + '/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blob: 'x'.repeat(1.2 * 1024 * 1024) }),
    });
    expect(response.status).toBe(413);
  });

  it('keeps unsafe-inline scripts off the API and on Swagger only', async () => {
    const api = (await fetch(base + '/health')).headers.get('content-security-policy') ?? '';
    const swagger = (await fetch(base + '/swagger')).headers.get('content-security-policy') ?? '';
    expect(api).toContain("default-src 'self'");
    expect(api).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(swagger).toMatch(/script-src[^;]*'unsafe-inline'/);
  });
});
