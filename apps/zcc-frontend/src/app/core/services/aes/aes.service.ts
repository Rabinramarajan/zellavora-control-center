import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import AES from 'crypto-js/aes';
import Utf8 from 'crypto-js/enc-utf8';
import Latin1 from 'crypto-js/enc-latin1';
import { firstValueFrom } from 'rxjs';

import { StorageService } from '../storage/storage.service';
import { AppSettingsService } from '../app-settings/app-settings.service';

/** Stored under 'encryptkey' as [key, iv] */
type EncryptKeyPair = readonly [key: string, iv: string];

interface LoginCredentials {
  clientCode: string;
  email: string;
  password: string;
}

interface EncryptedLoginPayload {
  clientCode: string;
  userSerialId: number;
  userLoginId: string;
  companyId: number;
  emailId: string;
  applicationEmailUrl: string;
  mPin: string;
  screenName: string;
  newPassword: string;
  confirmPassword: string;
  isPasswordValidation: boolean;
  tokenkeys: EncryptKeyPair;
  isPinValidation: boolean;
  pin: string;
  password: string;
  isAdmin: boolean;
  urlDate: string;
  confirmMPin: number;
  language_preference: string;
  oldPassWord: string;
  clientName: number;
}

@Injectable({ providedIn: 'root' })
export class AesService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(StorageService);
  private readonly appSetting = inject(AppSettingsService);

  private readonly localSecret = '_Admin_Web';
  private readonly tokenUrl = '/api/v1/admin/api/Authentication/gettoken';
  private token: EncryptKeyPair | null = null;

  async encryptLoginPayload(payload: LoginCredentials): Promise<EncryptedLoginPayload> {
    const [key, iv] = await this.getEncryptionToken();
    const encryptionKey = Latin1.parse(key);
    const encryptionIv = Latin1.parse(iv);
    const encryptField = (value: string) =>
      AES.encrypt(value, encryptionKey, { iv: encryptionIv }).toString();

    return {
      clientCode: payload.clientCode,
      userSerialId: 0,
      userLoginId: encryptField(payload.email),
      companyId: 0,
      emailId: '',
      applicationEmailUrl: '',
      mPin: '',
      screenName: '',
      newPassword: '',
      confirmPassword: '',
      isPasswordValidation: true,
      tokenkeys: [key, iv],
      isPinValidation: false,
      pin: '',
      password: encryptField(payload.password),
      isAdmin: true,
      urlDate: '',
      confirmMPin: 0,
      language_preference: '',
      oldPassWord: '',
      clientName: 0,
    };
  }

  private async getEncryptionToken(): Promise<EncryptKeyPair> {
    if (!this.token) {
      const response = await firstValueFrom(
        this.http.get<[string, string]>(this.tokenUrl)
      );

      if (!Array.isArray(response) || response.length !== 2 || !response[0] || !response[1]) {
        throw new Error('Invalid encryption token response');
      }

      this.token = response;
    }

    return this.token;
  }

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
