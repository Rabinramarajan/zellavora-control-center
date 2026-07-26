import crypto from 'crypto';

const defaultPublicKeyPem = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtoj992YSXfGyv2Z2o/BP
PddYLqb3Jo0vmtnB/QXmI5YxST9izZBNJczsjVq0MHJLaKBMg1WWDOS2+bueL57S
9IqdHCCph/vZtuRv18SDHC/gqdWJAceVep1iGk605vZzz7frNNd5R743ZSnkqP+d
DiOUqG7m/YqU70QaJyCdFMrBTRdIU8x2P6VvQ7hvtefjpg9ViW6opupRPcJJdhxX
cVTUGFi8dtxb/o74D3jqApurmR27wg8m2gxNJy4B18CLUPkRsLB+e/drzq3rVHDB
SExCcl0Shr1FI9ka+ktwZIx9Bi3dd3qoj9bey3lckWYYax/bxthMo20HsIfAgZ3V
4QIDAQAB
-----END PUBLIC KEY-----`;

const defaultPrivateKeyPem = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC2iP33ZhJd8bK/
Znaj8E8911gupvcmjS+a2cH9BeYjljFJP2LNkE0lzOyNWrQwcktooEyDVZYM5Lb5
u54vntL0ip0cIKmH+9m25G/XxIMcL+Cp1YkBx5V6nWIaTrTm9nPPt+s013lHvjdl
KeSo/50OI5Sobub9ipTvRBonIJ0UysFNF0hTzHY/pW9DuG+15+OmD1WJbqim6lE9
wkl2HFdxVNQYWLx23Fv+jvgPeOoCm6uZHbvCDybaDE0nLgHXwItQ+RGwsH5792vO
retUcMFITEJyXRKGvUUj2Rr6S3BkjH0GLd13eqiP1t7LeVyRZhhrH9vG2EyjbQew
h8CBndXhAgMBAAECggEAA9EVMS53QFnsytlCex0r5WcveH90jmyoO+se0tXw5CCA
fjklbWOj/uzlxL/kIb/MdiilHB+2qaVBP5mndI30EcZxnUEZyMmtZmH1uVO3Ceh+
k8NVOc5AGlmYaUq161ibmJ9bIbzGra20/IT8SCqOHWaFKRXZxFMfPmohYan29uE/
hmZIMreboQGzCryq+q+LtAUi5bHz0pGM9EQhZgYE70zji4U+4Of0ygS4K7rl7Tm6
zA66AgSDHhY7aqvWu5O7zMeJsKfLQNkS2uWr0gPFVIcB8zyJUbk1VW+SiYhIE4O3
BIWKsvtEXAOUuVn4L2yq0+b4I7gu31pZ0cNFfj9+RQKBgQD4pRwdRD4YSzdhODI6
fiUjorCUBtUu3D6XLMydkQAe9Tg2sRtdiidL8EOdJ/7vM9HASkKPTrW47LK6Zybk
OeKyaV08GiOg6nSHInQpMN2MMTyIWkuAGbs54aPYpyrS32XDRarCAc1TjUwHJ/T1
gBGwtBzdMJGBZgd9pJIy0m6EjQKBgQC770Ivkox2VM0++VrTpPehNGRZBPoOGVyZ
Aac0/yh2+GT6XCdyyrzyeCQuqrY50MlV+L1wetY5QVdjCYwZI7cpmK6pV7DCla55
7tQ/+q7k5C9eNfrh5PveUltfxAGJioh9DKfUt+ZD5FrmHFl05wGxaMGLvtbBA6+B
AJyqm9fDpQKBgHLQGvlQp7OkF8BmqJrl4NRhrVPNC+eFf8liwGEJsZqZ9QkcItzA
jIC+Qxpwe4GM1hAKuk1eNP9dHPKB6y17pTho+spj74vAd2pm+GiEzeiMW71CpJZU
S2Xg0T2bg2S4D09p/f1zw5IPLsonIy+xoXmM0b85TBcKO+9CbNfW332JAoGBAIrI
pDrXYU0dULiZkh5La+cq9pPangJ9bik71EvJxgsdYgyUszkNSL1SRX4E6S8G5TfM
ybDftYVwoGTtrvz9qAxayVka/dikisVWvn1E1ZUIgYZ0HIJnBCzo6rts1qnImQSn
rOTkrXIjl5DpDJLM6S4nKw7U7mh5HUkJt6gyEANVAoGBAJgizS59/DNWNExC1Tuh
DBtE1H9BXIWdUCNeZ9C0dzK0WXQW+7c6gzGgsUQ5wLO+6sL8d+3tykAnr4pXzn9y
AEZ6sbCWf5CxPSTqIZBPEHHwz12hqEPUWwt+rSXt9JnNlFfoTqOTrsrjltnk02+i
6TIHYx5W8Xs7KplIe5nTqa+g
-----END PRIVATE KEY-----`;

let rsaPrivateKey: crypto.KeyObject | null = null;
let rsaPublicKeyJwk: any = null;

export class RsaKeysService {
  /**
   * Returns (generating if necessary) the RSA keypair.
   * Uses default keys built-in or environment overrides (to support serverless consistency).
   */
  static getKeys() {
    if (!rsaPrivateKey || !rsaPublicKeyJwk) {
      const privatePem = process.env.RSA_PRIVATE_KEY || defaultPrivateKeyPem;
      const publicPem = process.env.RSA_PUBLIC_KEY || defaultPublicKeyPem;

      rsaPrivateKey = crypto.createPrivateKey(privatePem);
      const pubKeyObj = crypto.createPublicKey(publicPem);
      rsaPublicKeyJwk = pubKeyObj.export({ format: 'jwk' });
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
