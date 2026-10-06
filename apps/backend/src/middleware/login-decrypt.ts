import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const ALGO = 'aes-256-cbc';
const KEY_BYTES = 32;
const IV_BYTES = 16;

const LOGIN_PATHS = ['/api/v1/auth/login', '/api/admin/auth/login', '/auth/login'];

function decodeTokenKey(s: string, expectedBytes: number): Buffer | null {
  const b64 = Buffer.from(s, 'base64');
  if (b64.length === expectedBytes) return b64;
  const bin = Buffer.from(s, 'binary');
  if (bin.length === expectedBytes) return bin;
  return null;
}

function decryptField(encryptedData: string, key: Buffer, iv: Buffer): string {
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  return decipher.update(encryptedData, 'base64', 'utf8') + decipher.final('utf8');
}

export function loginDecryptMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (!LOGIN_PATHS.some((p) => req.path === p || req.originalUrl.startsWith(p)) || req.method !== 'POST') {
    return next();
  }

  const body = req.body;
  if (!body || typeof body !== 'object' || !Array.isArray(body.tokenkeys) || body.tokenkeys.length !== 2) {
    return next();
  }

  const key = decodeTokenKey(body.tokenkeys[0], KEY_BYTES);
  const iv  = decodeTokenKey(body.tokenkeys[1], IV_BYTES);
  if (!key || !iv) return next();

  try {
    // Legacy format: encrypted email is in userLoginId
    if (typeof body.userLoginId === 'string' && typeof body.password === 'string') {
      req.body = {
        clientCode: body.clientCode,
        email:      decryptField(body.userLoginId, key, iv),
        password:   decryptField(body.password, key, iv),
        rememberMe: false,
      };
      return next();
    }

    // Standard format: email and password are encrypted in-place
    if (typeof body.email === 'string' && typeof body.password === 'string') {
      req.body = {
        clientCode: body.clientCode,
        email:      decryptField(body.email, key, iv),
        password:   decryptField(body.password, key, iv),
        rememberMe: body.rememberMe,
      };
      return next();
    }
  } catch (err) {
    console.error('Login decryption failed:', err);
  }

  next();
}
