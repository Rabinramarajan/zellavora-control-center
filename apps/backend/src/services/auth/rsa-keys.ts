import crypto from 'crypto';

let rsaPrivateKey: crypto.KeyObject | null = null;
let rsaPublicKeyJwk: any = null;

export class RsaKeysService {
  /**
   * Returns (generating if necessary) the in-memory RSA keypair.
   * Exposes the public key as a JWK (JSON Web Key).
   */
  static getKeys() {
    if (!rsaPrivateKey || !rsaPublicKeyJwk) {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
      });
      rsaPrivateKey = privateKey;
      rsaPublicKeyJwk = publicKey.export({ format: 'jwk' });
    }
    return { privateKey: rsaPrivateKey, publicKeyJwk: rsaPublicKeyJwk };
  }

  /**
   * Decrypts a base64-encoded ciphertext encrypted using the public key with RSA-OAEP (SHA-256).
   */
  static decrypt(encryptedBase64: string): string {
    const { privateKey } = this.getKeys();
    const buffer = Buffer.from(encryptedBase64, 'base64');
    const decrypted = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      buffer
    );
    return decrypted.toString('utf8');
  }
}
