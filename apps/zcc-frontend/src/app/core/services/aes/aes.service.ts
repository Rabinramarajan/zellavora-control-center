import { inject, Injectable } from '@angular/core';
import AES from 'crypto-js/aes';
import Utf8 from 'crypto-js/enc-utf8';

import { StorageService } from '../storage/storage.service';
import { AppSettingsService } from '../app-settings/app-settings.service';

/** Stored under 'encryptkey' as [key, iv] */
type EncryptKeyPair = readonly [key: string, iv: string];

@Injectable({ providedIn: 'root' })
export class AesService {
  private readonly storage = inject(StorageService);
  private readonly appSetting = inject(AppSettingsService);

  private readonly localSecret = '_Admin_Web';

  /** API payload encryption (AES-CBC + PKCS7 are CryptoJS defaults). */
  async encrypt(text: string): Promise<string> {
    if (!this.appSetting.environment.encrypt) {
      return text;
    }

    const pair = (await this.storage.get('encryptkey')) as EncryptKeyPair | null;
    if (!pair?.[0] || !pair?.[1]) {
      return text;
    }

    const [key, iv] = pair;
    return AES.encrypt(text, Utf8.parse(key), { iv: Utf8.parse(iv) }).toString();
  }

  localEncrypt(text: unknown): string {
    return AES.encrypt(String(text), this.localSecret).toString();
  }

  localDecrypt(cipherText: string): string {
    return AES.decrypt(cipherText, this.localSecret).toString(Utf8);
  }
}