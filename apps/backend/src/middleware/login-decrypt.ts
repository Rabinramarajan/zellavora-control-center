import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const ALGO = 'aes-256-cbc';
const KEY_BYTES = 32;
const IV_BYTES = 16;

function parseBinaryString(str: string): Buffer {
  return Buffer.from(str, 'binary');
}

function decryptField(encryptedData: string, key: Buffer, iv: Buffer): string {
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function loginDecryptMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const LOGIN_PATHS = ['/api/v1/auth/login', '/api/admin/auth/login', '/auth/login'];
  if (LOGIN_PATHS.some((p) => req.path === p || req.originalUrl.startsWith(p)) && req.method === 'POST') {
    const body = req.body;
    if (
      body &&
      typeof body === 'object' &&
      Array.isArray(body.tokenkeys) &&
      body.tokenkeys.length === 2 &&
      typeof body.userLoginId === 'string' &&
      typeof body.password === 'string'
    ) {
      try {
        const key = parseBinaryString(body.tokenkeys[0]);
        const iv = parseBinaryString(body.tokenkeys[1]);

        if (key.length !== KEY_BYTES || iv.length !== IV_BYTES) {
          return next();
        }

        req.body = {
          clientCode: body.clientCode,
          email: decryptField(body.userLoginId, key, iv),
          password: decryptField(body.password, key, iv),
          rememberMe: false,
        };
      } catch (error) {
        console.error('Login decryption failed:', error);
      }
    }
  }
  next();
}
