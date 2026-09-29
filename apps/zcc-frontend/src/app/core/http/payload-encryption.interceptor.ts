import {
  HttpBackend,
  HttpClient,
  HttpErrorResponse,
  HttpEvent,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, firstValueFrom, from, map, switchMap, throwError } from 'rxjs';

/**
 * Encrypts API request bodies and decrypts API responses with AES-256-GCM.
 * The per-request AES key travels RSA-OAEP-wrapped with the server's public key
 * in `X-Enc-Key`; see apps/backend/src/middleware/transport-encryption.ts.
 *
 * Registered last so it sits closest to the network: retries re-encrypt with a
 * fresh key, and the error interceptor sees decrypted error bodies.
 */

const PUBLIC_KEY_PATH = '/api/v1/crypto/public-key';
const IV_BYTES = 12;

interface EncryptedEnvelope {
  payload: string;
  iv: string;
}

const publicKeys = new Map<string, Promise<CryptoKey>>();

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

function isEnvelope(body: unknown): body is EncryptedEnvelope {
  return (
    !!body &&
    typeof body === 'object' &&
    typeof (body as EncryptedEnvelope).payload === 'string' &&
    typeof (body as EncryptedEnvelope).iv === 'string'
  );
}

function shouldEncrypt(req: HttpRequest<unknown>): boolean {
  if (!req.url.startsWith('http') || !req.url.includes('/api/v1/')) return false;
  if (req.url.includes(PUBLIC_KEY_PATH) || req.responseType !== 'json') return false;
  const body = req.body;
  return !(body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer);
}

function loadPublicKey(http: HttpClient, origin: string): Promise<CryptoKey> {
  let key = publicKeys.get(origin);
  if (!key) {
    key = firstValueFrom(http.get<{ key: string }>(`${origin}${PUBLIC_KEY_PATH}`))
      .then(({ key: spki }) =>
        crypto.subtle.importKey('spki', fromBase64(spki), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, [
          'encrypt',
        ])
      )
      .catch((err: unknown) => {
        publicKeys.delete(origin); // retry on the next request
        throw err;
      });
    publicKeys.set(origin, key);
  }
  return key;
}

async function encryptJson(key: CryptoKey, value: unknown): Promise<EncryptedEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
  return { payload: toBase64(cipher), iv: toBase64(iv) };
}

async function decryptJson(key: CryptoKey, envelope: EncryptedEnvelope): Promise<unknown> {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(envelope.iv) },
    key,
    fromBase64(envelope.payload)
  );
  return JSON.parse(new TextDecoder().decode(plain));
}

async function prepare(
  http: HttpClient,
  req: HttpRequest<unknown>
): Promise<{ req: HttpRequest<unknown>; aesKey: CryptoKey }> {
  const rsaKey = await loadPublicKey(http, new URL(req.url).origin);
  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
  const rawKey = await crypto.subtle.exportKey('raw', aesKey);
  const wrappedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, rsaKey, rawKey);
  const body = req.body == null ? req.body : await encryptJson(aesKey, req.body);
  return {
    req: req.clone({ body, setHeaders: { 'X-Enc-Key': toBase64(wrappedKey) } }),
    aesKey,
  };
}

function isStaleKeyError(err: unknown): boolean {
  return (
    err instanceof HttpErrorResponse &&
    err.status === 400 &&
    (err.error as { error?: { code?: string } } | null)?.error?.code === 'BAD_ENCRYPTION'
  );
}

export const payloadEncryptionInterceptor: HttpInterceptorFn = (req, next) => {
  if (!shouldEncrypt(req)) return next(req);

  // HttpBackend skips the interceptor chain, so the key fetch is not itself encrypted.
  const http = new HttpClient(inject(HttpBackend));

  // The server key may have rotated since it was cached: refetch it once and retry.
  return send(http, req, next).pipe(
    catchError((err: unknown) => {
      if (!isStaleKeyError(err)) return throwError(() => err);
      publicKeys.delete(new URL(req.url).origin);
      return send(http, req, next);
    })
  );
};

function send(
  http: HttpClient,
  req: HttpRequest<unknown>,
  next: (req: HttpRequest<unknown>) => Observable<HttpEvent<unknown>>
): Observable<HttpEvent<unknown>> {
  return from(prepare(http, req)).pipe(
    switchMap(({ req: encrypted, aesKey }): Observable<HttpEvent<unknown>> =>
      next(encrypted).pipe(
        switchMap((event) =>
          event instanceof HttpResponse && isEnvelope(event.body)
            ? from(decryptJson(aesKey, event.body)).pipe(map((body) => event.clone({ body })))
            : [event]
        ),
        catchError((err: unknown) =>
          err instanceof HttpErrorResponse && isEnvelope(err.error)
            ? from(decryptJson(aesKey, err.error)).pipe(
                switchMap((error) =>
                  throwError(
                    () =>
                      new HttpErrorResponse({
                        error,
                        headers: err.headers,
                        status: err.status,
                        statusText: err.statusText,
                        url: err.url ?? undefined,
                      })
                  )
                )
              )
            : throwError(() => err)
        )
      )
    )
  );
}
