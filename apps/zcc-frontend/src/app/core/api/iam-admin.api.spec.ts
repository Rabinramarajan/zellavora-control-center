import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { IamAdminApiService } from './iam-admin.api';

describe('IamAdminApiService', () => {
  let api: IamAdminApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(IamAdminApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('drops empty query params and unwraps the envelope', async () => {
    const result = firstValueFrom(
      api.listDepartments({ q: '', status: 'active', page: 1, pageSize: 20, parentId: null })
    );
    const req = http.expectOne((r) => r.url === '/api/v1/iam/departments');
    expect(req.request.params.keys().sort()).toEqual(['page', 'pageSize', 'status']);
    req.flush({
      success: true,
      data: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
    });
    expect((await result).meta.total).toBe(0);
  });

  it('url-encodes configuration keys on delete', () => {
    void firstValueFrom(api.deleteConfiguration('billing.invoice/prefix'));
    http
      .expectOne('/api/v1/iam/configurations/billing.invoice%2Fprefix')
      .flush({ success: true, data: {} });
  });

  it('sends the audience with communications', () => {
    void firstValueFrom(
      api.sendEmail({ audience: { type: 'team', ids: ['t1'] }, subject: 'Hi', body: 'Hello' })
    );
    const req = http.expectOne('/api/v1/iam/communications/emails');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.audience).toEqual({ type: 'team', ids: ['t1'] });
    req.flush({ success: true, data: { recipients: 1, delivered: 1, failed: 0 } });
  });
});
