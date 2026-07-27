import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ApiDataService } from './api-data.service';
import { AuthStore } from '../auth/auth.store';

describe('ApiDataService', () => {
  let service: ApiDataService;
  let httpMock: HttpTestingController;
  let store: AuthStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ApiDataService, AuthStore]
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
    const req = httpMock.expectOne('/test');
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Spinner')).toBe('true');
  });
});
