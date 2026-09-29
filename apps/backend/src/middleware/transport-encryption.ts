import crypto from 'crypto';
import type { Request, RequestHandler } from 'express';
import { config } from '../config/env';
import { logger } from '../infrastructure/logger';

/**
 * Application-layer payload encryption (on top of TLS).
 *
 * Hybrid scheme, so no shared secret ever ships in the browser bundle:
 *   1. The client fetches the server's RSA public key (GET /api/v1/crypto/public-key).
 *   2. Per request it generates a random AES-256-GCM key, encrypts the JSON body
 *      with it, and sends the key wrapped with RSA-OAEP-SHA256 in `X-Enc-Key`.
 *   3. The server unwraps the key, decrypts the body, and encrypts the JSON
 *      response with the same key (fresh IV).
 *
 * Envelope (both directions): { payload: base64(ciphertext || tag), iv: base64(12 bytes) }
 *
 * Requests without `X-Enc-Key` pass through untouched so Swagger, health checks
 * and server-to-server callers keep working.
 */

export const ENC_KEY_HEADER = 'x-enc-key';
const IV_BYTES = 12;
const TAG_BYTES = 16;

export interface EncryptedEnvelope {
  payload: string;
  iv: string;
}

function loadPrivateKey(): crypto.KeyObject {
  if (config.transportPrivateKey) {
    return crypto.createPrivateKey(config.transportPrivateKey.replace(/\\n/g, '\n'));
  }
  // Ephemeral keys differ per serverless instance, which breaks requests that
  // land on another instance — acceptable locally, never in production.
  logger.warn('TRANSPORT_PRIVATE_KEY not set — using an ephemeral key (development only)');
  return crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
}

const privateKey = loadPrivateKey();
const publicKeySpki = crypto
  .createPublicKey(privateKey)
  .export({ type: 'spki', format: 'der' })
  .toString('base64');

export function getTransportPublicKey(): string {
  return publicKeySpki;
}

function unwrapKey(wrapped: string): Buffer {
  return crypto.privateDecrypt(
    { key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(wrapped, 'base64')
  );
}

export function encryptJson(key: Buffer, value: unknown): EncryptedEnvelope {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return {
    payload: Buffer.concat([ciphertext, cipher.getAuthTag()]).toString('base64'),
    iv: iv.toString('base64'),
  };
}

export function decryptJson(key: Buffer, envelope: EncryptedEnvelope): unknown {
  const raw = Buffer.from(envelope.payload, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(raw.subarray(raw.length - TAG_BYTES));
  const plain = Buffer.concat([decipher.update(raw.subarray(0, raw.length - TAG_BYTES)), decipher.final()]);
  return JSON.parse(plain.toString('utf8'));
}

function isEnvelope(body: unknown): body is EncryptedEnvelope {
  return (
    !!body &&
    typeof body === 'object' &&
    typeof (body as EncryptedEnvelope).payload === 'string' &&
    typeof (body as EncryptedEnvelope).iv === 'string'
  );
}

function rejectMalformed(req: Request, reason: string) {
  logger.warn(`Transport decryption failed on ${req.method} ${req.path}: ${reason}`);
  return { error: { message: 'Malformed encrypted request', code: 'BAD_ENCRYPTION', status: 400 } };
}

/**
 * Must be registered after the body parsers and BEFORE any middleware that
 * wraps res.json (e.g. responseEnvelope): wrappers installed later run first,
 * so ours sees the final body and encrypts it last.
 */
export const transportEncryption: RequestHandler = (req, res, next) => {
  const wrapped = req.header(ENC_KEY_HEADER);
  if (!wrapped) return next();

  let key: Buffer;
  try {
    key = unwrapKey(wrapped);
    if (key.length !== 32) throw new Error('unexpected key length');
    if (isEnvelope(req.body)) req.body = decryptJson(key, req.body);
  } catch (err) {
    res.status(400).json(rejectMalformed(req, err instanceof Error ? err.message : String(err)));
    return;
  }

  const originalJson = res.json;
  res.json = function (body) {
    return originalJson.call(this, encryptJson(key, body));
  };
  next();
};

export const transportPublicKeyHandler: RequestHandler = (_req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({ algorithm: 'RSA-OAEP-256', format: 'spki', key: getTransportPublicKey() });
};
