import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { AuthStore } from './auth.store';
import { authInterceptor } from './auth.interceptor';

describe('stored login tokens', () => {
  let auth: AuthService;
  let store: AuthStore;
  let http: HttpTestingController;
  const pair = () => ({
    accessToken: 'access', refreshToken: 'refresh', sessionId: 'session',
    accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
    refreshTokenExpiresAt: new Date(Date.now() + 86400_000).toISOString(),
  });
  const seed = (tokens = pair()) => {
    sessionStorage.setItem('zcc.refresh', tokens.refreshToken);
    sessionStorage.setItem('zcc.tokens', JSON.stringify(tokens));
  };
  const finishMe = () => http.expectOne('/api/v1/auth/me').flush({
    user: { id: 'user' }, tenant: { id: 'tenant' }, permissions: [], menu: [],
  });

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
      { provide: Router, useValue: { url: '/auth/login', navigate: jasmine.createSpy(), navigateByUrl: jasmine.createSpy() } },
    ] });
    auth = TestBed.inject(AuthService);
    store = TestBed.inject(AuthStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('reuses a valid login access token on reload without refreshing', () => {
    seed();
    let restored = false;
    auth.initialize().subscribe(ok => restored = ok);
    http.expectNone('/api/v1/auth/refresh');
    expect(store.accessToken()).toBe('access');
    finishMe();
    expect(restored).toBeTrue();
  });

  it('refreshes an expired access token and saves the rotated pair', () => {
    seed({ ...pair(), accessTokenExpiresAt: new Date(0).toISOString() });
    auth.initialize().subscribe();
    const request = http.expectOne('/api/v1/auth/refresh');
    expect(request.request.body).toEqual({ refreshToken: 'refresh' });
    request.flush({ ...pair(), refreshToken: 'rotated' });
    finishMe();
    expect(sessionStorage.getItem('zcc.refresh')).toBe('rotated');
    expect(JSON.parse(sessionStorage.getItem('zcc.tokens')!).refreshToken).toBe('rotated');
  });

  it('supports existing sessions that only stored a refresh token', () => {
    sessionStorage.setItem('zcc.refresh', 'refresh');
    auth.initialize().subscribe();
    http.expectOne('/api/v1/auth/refresh').flush(pair());
    finishMe();
  });

  it('stores the tokens returned by login before loading user context', () => {
    auth.loginMfa({ mfaToken: 'challenge', code: '123456' } as any).subscribe();
    http.expectOne('/api/v1/auth/login/mfa').flush({
      ...pair(), mfaRequired: false, user: { id: 'user' }, tenant: { id: 'tenant' },
    });
    expect(JSON.parse(sessionStorage.getItem('zcc.tokens')!).accessToken).toBe('access');
    expect(sessionStorage.getItem('zcc.refresh')).toBe('refresh');
    http.expectNone('/api/v1/auth/refresh');
    finishMe();
  });

  it('does not reuse access tokens from a different stored refresh session', () => {
    seed();
    sessionStorage.setItem('zcc.refresh', 'different-session');
    auth.initialize().subscribe();
    const request = http.expectOne('/api/v1/auth/refresh');
    expect(request.request.body.refreshToken).toBe('different-session');
    request.flush(pair());
    finishMe();
  });

  it('shares refreshes across simultaneous callers', () => {
    let results = 0;
    auth.refresh({ refreshToken: 'refresh' }).subscribe(() => results++);
    auth.refresh({ refreshToken: 'refresh' }).subscribe(() => results++);
    http.expectOne('/api/v1/auth/refresh').flush(pair());
    expect(results).toBe(2);
  });

  it('refreshes and retries when the server rejects a stored access token', () => {
    seed();
    auth.initialize().subscribe();
    http.expectOne('/api/v1/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/v1/auth/refresh').flush({ ...pair(), accessToken: 'new-access' });
    const retry = http.expectOne('/api/v1/auth/me');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new-access');
    retry.flush({ user: { id: 'user' }, tenant: { id: 'tenant' }, permissions: [], menu: [] });
    expect(store.isAuthenticated()).toBeTrue();
  });

  it('clears stored tokens and errors waiting requests when refresh fails', () => {
    seed();
    store.updateTokens(pair());
    let failed = false;
    TestBed.inject(HttpClient).get('/api/v1/test').subscribe({ error: () => failed = true });
    http.expectOne('/api/v1/test').flush({}, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/v1/auth/refresh').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(failed).toBeTrue();
    expect(sessionStorage.getItem('zcc.tokens')).toBeNull();
    expect(sessionStorage.getItem('zcc.refresh')).toBeNull();
  });
});
