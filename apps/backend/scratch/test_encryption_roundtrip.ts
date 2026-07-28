import crypto from 'crypto';
import { webcrypto } from 'crypto';

const subtle = webcrypto.subtle;

function binaryStringToArrayBuffer(str: string): ArrayBuffer {
  const buf = new ArrayBuffer(str.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

async function encryptAesCbc(plainText: string, keyStr: string, ivStr: string): Promise<string> {
  const keyBuf = binaryStringToArrayBuffer(keyStr);
  const ivBuf = binaryStringToArrayBuffer(ivStr);
  const key = await subtle.importKey(
    'raw',
    keyBuf,
    { name: 'AES-CBC' },
    false,
    ['encrypt']
  );
  const data = new TextEncoder().encode(plainText);
  const encrypted = await subtle.encrypt(
    {
      name: 'AES-CBC',
      iv: ivBuf,
    },
    key,
    data
  );
  return Buffer.from(encrypted).toString('base64');
}

function decryptAes(cipherText: string, keyStr: string, ivStr: string): string {
  const aesKey = Buffer.from(keyStr, 'binary');
  const aesIv = Buffer.from(ivStr, 'binary');
  const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, aesIv);
  let decrypted = decipher.update(cipherText, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function main() {
  const plainText = 'superadmin@zellavora.com';
  
  // 1. Generate key and iv (binary strings)
  const keyBytes = crypto.randomBytes(32);
  const ivBytes = crypto.randomBytes(16);
  const keyStr = keyBytes.toString('binary');
  const ivStr = ivBytes.toString('binary');

  // 2. Encrypt using SubtleCrypto (simulating browser)
  console.log('Encrypting with SubtleCrypto...');
  const cipherText = await encryptAesCbc(plainText, keyStr, ivStr);
  console.log('CipherText (Base64):', cipherText);

  // 3. Decrypt using crypto.createDecipheriv (simulating backend)
  console.log('Decrypting with decipheriv...');
  const decryptedText = decryptAes(cipherText, keyStr, ivStr);
  console.log('Decrypted Text:', decryptedText);

  console.log('Match:', plainText === decryptedText);
}

main().catch(err => {
  console.error('Error during roundtrip:', err);
});
