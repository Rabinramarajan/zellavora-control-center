import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const ALGO = 'aes-256-cbc';
const KEY_BYTES = 32;
const IV_BYTES = 16;

function parseBinaryString(str: string): Buffer {
  return Buffer.from(str, 'binary');
}

function decryptPayload(encryptedData: string, key: Buffer, iv: Buffer): unknown {
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

export function loginDecryptMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (req.path === '/login' && req.method === 'POST') {
    const encryptionKey = req.headers['x-encryption-key'] as string;
    const encryptionIv = req.headers['x-encryption-iv'] as string;

    if (encryptionKey && encryptionIv) {
      try {
        const key = parseBinaryString(encryptionKey);
        const iv = parseBinaryString(encryptionIv);

        if (key.length !== KEY_BYTES || iv.length !== IV_BYTES) {
          return next();
        }

        const encryptedBody = req.body;
        if (
          encryptedBody &&
          typeof encryptedBody === 'object' &&
          encryptedBody.encrypted === true &&
          encryptedBody.data
        ) {
          const decrypted = decryptPayload(encryptedBody.data, key, iv);
          req.body = decrypted;
        }
      } catch (error) {
        console.error('Login decryption failed:', error);
      }
    }
  }
  next();
}
