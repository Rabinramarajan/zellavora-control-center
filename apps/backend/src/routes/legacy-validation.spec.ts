const insert = jest.fn();
const update = jest.fn();
const guardedBy: string[][] = [];

jest.mock('../config/supabase', () => ({
  supabase: {
    from: jest.fn((table: string) => {
      if (table === 'projects') {
        return {
          select: () => ({
            eq: () => ({ single: async () => ({ data: { user_id: 'owner-1' }, error: null }) }),
          }),
        };
      }
      return {
        insert: (...args: unknown[]) => {
          insert(...args);
          return { select: () => ({ single: async () => ({ data: { id: 'new' }, error: null }) }) };
        },
        update: (...args: unknown[]) => {
          update(...args);
          return {
            eq: () => ({
              eq: () => ({
                select: () => ({ single: async () => ({ data: { id: 'img' }, error: null }) }),
              }),
            }),
          };
        },
      };
    }),
  },
}));

jest.mock('../middleware/auth', () => ({
  authenticateToken: (req: { userId?: string }, _res: unknown, next: () => void) => {
    req.userId = 'owner-1';
    next();
  },
  requirePermission:
    (...codes: string[]) =>
    (req: { headers: Record<string, string> }, _res: unknown, next: (e?: unknown) => void) => {
      guardedBy.push(codes);
      if (req.headers['x-grant'] === codes[0]) return next();
      const { AppError } = jest.requireActual('../middleware/error');
      return next(new AppError('Insufficient permission', 403, 'FORBIDDEN_PERMISSION'));
    },
}));

import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import galleryRoutes from './gallery';
import technologyRoutes from './technologies';
import { errorHandler } from '../middleware/error';

describe('legacy route validation', () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = express();
    app.use(express.json());
    app.use('/api/v1', technologyRoutes);
    app.use('/api/v1', galleryRoutes);
    app.use(errorHandler);
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve);
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  });

  beforeEach(() => {
    insert.mockClear();
    update.mockClear();
  });

  const send = (
    method: string,
    path: string,
    body: unknown,
    headers: Record<string, string> = {}
  ) =>
    fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });

  describe('POST /technologies', () => {
    it('requires projects:write', async () => {
      const response = await send('POST', '/technologies', { name: 'TypeScript' });
      expect(response.status).toBe(403);
      expect(insert).not.toHaveBeenCalled();
      expect(guardedBy).toContainEqual(['projects:write']);
    });

    it('inserts only the allow-listed fields', async () => {
      const response = await send(
        'POST',
        '/technologies',
        { name: 'TypeScript', icon: 'ts', color: '#3178c6' },
        { 'x-grant': 'projects:write' }
      );
      expect(response.status).toBe(201);
      expect(insert).toHaveBeenCalledWith({ name: 'TypeScript', icon: 'ts', color: '#3178c6' });
    });

    it('rejects columns outside the allow-list instead of passing them to the database', async () => {
      const response = await send(
        'POST',
        '/technologies',
        { name: 'TypeScript', id: 'forced-id', created_at: '2000-01-01' },
        { 'x-grant': 'projects:write' }
      );
      expect(response.status).toBe(400);
      expect(insert).not.toHaveBeenCalled();
    });
  });

  describe('PUT /projects/:projectId/gallery/:imageId', () => {
    const path = '/projects/11111111-1111-4111-8111-111111111111/gallery/img';

    it('updates only the allow-listed fields', async () => {
      const response = await send('PUT', path, { caption: 'New', order_index: 2 });
      expect(response.status).toBe(200);
      expect(update).toHaveBeenCalledWith({ caption: 'New', order_index: 2 });
    });

    it('rejects attempts to re-point the item at another project or change its id', async () => {
      const response = await send('PUT', path, {
        caption: 'New',
        project_id: '22222222-2222-4222-8222-222222222222',
        id: 'other',
      });
      expect(response.status).toBe(400);
      expect(update).not.toHaveBeenCalled();
    });

    it('rejects invalid values', async () => {
      expect((await send('PUT', path, { order_index: -1 })).status).toBe(400);
      expect((await send('PUT', path, { media_url: '' })).status).toBe(400);
    });
  });
});
