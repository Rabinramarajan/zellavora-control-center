import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

interface EncryptionToken {
  key: string;
  iv: string;
}

@Injectable({ providedIn: 'root' })
export class LoginEncryptionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/v1/admin/api/Authentication/gettoken';

  private cachedToken: EncryptionToken | null = null;

  async getEncryptionToken(): Promise<EncryptionToken> {
    if (this.cachedToken) {
      return this.cachedToken;
    }

    try {
      const response = await firstValueFrom(
        this.http.get<[string, string]>(this.apiUrl)
      );

      if (Array.isArray(response) && response.length === 2) {
        this.cachedToken = {
          key: response[0],
          iv: response[1],
        };
        return this.cachedToken;
      }

      throw new Error('Invalid encryption token response');
    } catch (error) {
      console.error('Failed to fetch encryption token:', error);
      throw error;
    }
  }

  private binaryStringToArrayBuffer(binaryStr: string): ArrayBuffer {
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  async encryptLoginPayload(payload: {
    clientCode: string;
    email: string;
    password: string;
    rememberMe?: boolean;
  }): Promise<{ encrypted: true; data: string; key: string; iv: string }> {
    const token = await this.getEncryptionToken();

    const keyBuffer = this.binaryStringToArrayBuffer(token.key);
    const ivBuffer = this.binaryStringToArrayBuffer(token.iv);

    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-CBC' },
      false,
      ['encrypt']
    );

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-CBC', iv: new Uint8Array(ivBuffer) },
      cryptoKey,
      data
    );

    return {
      encrypted: true,
      data: this.arrayBufferToBase64(encrypted),
      key: token.key,
      iv: token.iv,
    };
  }

  clearCache(): void {
    this.cachedToken = null;
  }
}