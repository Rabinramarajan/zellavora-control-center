import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const ALGO = 'aes-256-cbc';
const KEY_BYTES = 32;
const IV_BYTES = 16;

const LOGIN_PATHS = ['/api/v1/auth/login', '/api/admin/auth/login', '/auth/login'];

type Encoding = 'hex' | 'binary' | 'base64';

function tryDecode(s: string, expectedBytes: number): Array<{ buf: Buffer; enc: Encoding }> {
  const results: Array<{ buf: Buffer; enc: Encoding }> = [];
  for (const enc of ['hex', 'binary', 'base64'] as const) {
    const buf = Buffer.from(s, enc);
    if (buf.length === expectedBytes) results.push({ buf, enc });
  }
  return results;
}

function decryptField(encryptedData: string, key: Buffer, iv: Buffer): string {
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  return decipher.update(encryptedData, 'base64', 'utf8') + decipher.final('utf8');
}

function tryDecrypt(
  fields: { email: string; password: string },
  tokenkeys: [string, string],
): { email: string; password: string } | null {
  const keyCandidates = tryDecode(tokenkeys[0], KEY_BYTES);
  const ivCandidates = tryDecode(tokenkeys[1], IV_BYTES);

  for (const k of keyCandidates) {
    for (const v of ivCandidates) {
      try {
        return {
          email: decryptField(fields.email, k.buf, v.buf),
          password: decryptField(fields.password, k.buf, v.buf),
        };
      } catch {
        // Try next combination
      }
    }
  }
  return null;
}

export function loginDecryptMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (!LOGIN_PATHS.some((p) => req.path === p || req.originalUrl.startsWith(p)) || req.method !== 'POST') {
    return next();
  }

  const body = req.body;
  if (!body || typeof body !== 'object' || !Array.isArray(body.tokenkeys) || body.tokenkeys.length !== 2) {
    return next();
  }

  const tokenkeys = body.tokenkeys as [string, string];

  // Legacy format: encrypted email is in userLoginId
  if (typeof body.userLoginId === 'string' && typeof body.password === 'string') {
    const result = tryDecrypt({ email: body.userLoginId, password: body.password }, tokenkeys);
    if (result) {
      req.body = {
        clientCode: body.clientCode,
        email: result.email,
        password: result.password,
        rememberMe: false,
      };
      return next();
    }
    _res.status(400).json({ error: { message: 'Invalid credentials payload', status: 400 } });
    return;
  }

  // Standard format: email and password are encrypted in-place
  if (typeof body.email === 'string' && typeof body.password === 'string') {
    const result = tryDecrypt({ email: body.email, password: body.password }, tokenkeys);
    if (result) {
      req.body = {
        clientCode: body.clientCode,
        email: result.email,
        password: result.password,
        rememberMe: body.rememberMe,
      };
      return next();
    }
    _res.status(400).json({ error: { message: 'Invalid credentials payload', status: 400 } });
    return;
  }

  next();
}
