import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import AES from 'crypto-js/aes';
import Latin1 from 'crypto-js/enc-latin1';
import Utf8 from 'crypto-js/enc-utf8';

import { AesService } from './aes.service';

describe('AesService', () => {
  let service: AesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('creates the field-based login payload', async () => {
    const key = Array.from({ length: 32 }, (_, index) => String.fromCharCode(index + 128)).join('');
    const iv = Array.from({ length: 16 }, (_, index) => String.fromCharCode(index + 64)).join('');
    const resultPromise = service.encryptLoginPayload({
      clientCode: 'DB',
      email: 'admin@example.com',
      password: 'secret',
    });

    http.expectOne('/api/v1/admin/api/Authentication/gettoken').flush([key, iv]);
    const result = await resultPromise;
    const decrypt = (value: string) =>
      AES.decrypt(value, Latin1.parse(key), { iv: Latin1.parse(iv) }).toString(Utf8);

    expect('encrypted' in result).toBeFalse();
    expect('data' in result).toBeFalse();
    expect(result.clientCode).toBe('DB');
    expect(result.tokenkeys).toEqual([key, iv]);
    expect(decrypt(result.userLoginId)).toBe('admin@example.com');
    expect(decrypt(result.password)).toBe('secret');
  });
});
