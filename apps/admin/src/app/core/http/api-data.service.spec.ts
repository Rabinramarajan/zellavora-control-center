import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiDataService } from './api-data.service';
import { AuthStore } from '../auth/auth.store';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('ApiDataService', () => {
  let service: ApiDataService;
  let httpMock: HttpTestingController;
  let store: AuthStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [],
    providers: [ApiDataService, AuthStore, provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    service = TestBed.inject(ApiDataService);
    httpMock = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch data with headers', () => {
    service.getData('/test').subscribe();
    const req = httpMock.expectOne('/api/v1/test');
    expect(req.request.method).toBe('GET');
  });

  it('should set spinner control headers from options', () => {
    service.getData('/test', undefined, { hideFullSpinner: true, hideJwt: true, hideErrorMethod: true }).subscribe();
    const req = httpMock.expectOne('/api/v1/test');
    expect(req.request.headers.get('hideFullSpinner')).toBe('true');
    expect(req.request.headers.get('hideJwt')).toBe('true');
    expect(req.request.headers.get('hideErrorMethod')).toBe('true');
  });

  it('should pass query params and custom headers', () => {
    service.getData('/test', { range: '30' }, { headers: { 'X-Tenant': 'acme' } }).subscribe();
    const req = httpMock.expectOne((r) => r.url === '/api/v1/test' && r.params.get('range') === '30');
    expect(req.request.headers.get('X-Tenant')).toBe('acme');
  });
});
