import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthApiService } from './auth.api';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('AuthApiService', () => {
  let service: AuthApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [],
    providers: [AuthApiService, provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    service = TestBed.inject(AuthApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call validateClientCode', () => {
    const mockResponse = { valid: true, tenant: { id: '1', name: 'Acme', clientCode: 'acme', logoUrl: null, enforce2fa: false, allowedDomains: null } };
    service.validateClientCode('acme').subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('/api/v1/auth/validate-client');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ clientCode: 'acme' });
    req.flush(mockResponse);
  });

  it('should call getPublicKey / getToken', () => {
    const mockResponse = ['key', 'iv'];
    service.getPublicKey().subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('/api/v1/auth/gettoken');
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('should call login', () => {
    const mockResponse = { mfaRequired: false } as any;
    service.login({ email: 'test@example.com', password: 'password' }).subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('/api/v1/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });
});
