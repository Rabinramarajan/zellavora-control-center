import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { responseEnvelope } from './response-envelope';

describe('responseEnvelope', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(responseEnvelope);
    app.get('/object', (_req, res) => res.json({ data: { id: 1 } }));
    app.get('/error', (_req, res) => res.status(400).json({ error: { message: 'Invalid input' } }));
    app.get('/existing', (_req, res) => res.json({ msg: { errorMessage: ['Original'] } }));
    app.get('/array', (_req, res) => res.json(['key', 'iv']));
    app.get('/null', (_req, res) => res.json(null));
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve);
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  });

  it('adds the legacy envelope without replacing the payload', async () => {
    const response = await fetch(`${baseUrl}/object`);
    expect(await response.json()).toEqual({
      data: { id: 1 },
      msg: { errorMessage: [], infoMessage: { id: 0, msg: '', msgType: 'Information' } },
    });
  });

  it('preserves error status and copies the error message', async () => {
    const response = await fetch(`${baseUrl}/error`);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ msg: { errorMessage: ['Invalid input'] } });
  });

  it('preserves an existing message envelope', async () => {
    const response = await fetch(`${baseUrl}/existing`);
    expect(await response.json()).toEqual({ msg: { errorMessage: ['Original'] } });
  });

  it.each([
    ['array', ['key', 'iv']],
    ['null', null],
  ])('preserves %s responses', async (route, expected) => {
    const response = await fetch(`${baseUrl}/${route}`);
    expect(await response.json()).toEqual(expected);
  });
});
