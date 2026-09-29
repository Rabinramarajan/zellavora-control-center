import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { AuthStore } from './auth.store';
import { authInterceptor } from './auth.interceptor';
import { PolicyStore } from '../rbac/store/policy.store';

describe('AuthService', () => {
  let auth: AuthService;
  let store: AuthStore;
  let http: HttpTestingController;
  let router: { url: string; navigate: jasmine.Spy; navigateByUrl: jasmine.Spy };

  const pair = () => ({
    accessToken: 'access',
    refreshToken: 'refresh',
    sessionId: 'session',
    accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
    refreshTokenExpiresAt: new Date(Date.now() + 86400_000).toISOString(),
  });
  const seed = (tokens = pair()) => {
    sessionStorage.setItem('zcc.refresh', tokens.refreshToken);
    sessionStorage.setItem('zcc.tokens', JSON.stringify(tokens));
  };
  const meBody = { user: { id: 'user' }, tenant: { id: 'tenant' }, permissions: [], menu: [], mfaSetupRequired: false };
  const finishMe = () => http.expectOne('/api/v1/auth/me').flush(meBody);
  const success = (extra: object = {}) => ({
    ...pair(),
    mfaRequired: false,
    user: { id: 'user' },
    tenant: { id: 'tenant' },
    mfaSetupRequired: false,
    ...extra,
  });

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    router = {
      url: '/dashboard',
      navigate: jasmine.createSpy('navigate').and.resolveTo(true),
      navigateByUrl: jasmine.createSpy('navigateByUrl').and.resolveTo(true),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
      ],
    });
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

  describe('boot', () => {
    it('reuses a valid access token on reload without refreshing', () => {
      seed();
      let restored = false;
      auth.initialize().subscribe((ok) => (restored = ok));
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
  });

  describe('sign in', () => {
    const credentials = { clientCode: 'acme', email: ' Ada@Acme.test ', password: 'pw', rememberMe: false };

    it('normalizes the email and never sends a bearer token to /login', () => {
      store.updateTokens(pair());
      auth.login(credentials).subscribe();
      const req = http.expectOne('/api/v1/auth/login');
      expect(req.request.body.email).toBe('ada@acme.test');
      expect(req.request.headers.has('Authorization')).toBeFalse();
      req.flush(success());
      finishMe();
    });

    it('stores a 2FA challenge and routes to the challenge page', () => {
      auth.login(credentials).subscribe();
      http.expectOne('/api/v1/auth/login').flush({
        mfaRequired: true,
        mfaToken: 'challenge-token',
        mfaMethod: 'totp',
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      });
      expect(auth.pendingMfaChallenge()?.mfaToken).toBe('challenge-token');
      expect(router.navigate).toHaveBeenCalledWith(['/auth/two-factor'], { replaceUrl: true });
      expect(store.isAuthenticated()).toBeFalse();
    });

    it('completes the challenge, clears it and stores the session', () => {
      sessionStorage.setItem(
        'zcc.mfaChallenge',
        JSON.stringify({ mfaToken: 'challenge-token', mfaMethod: 'totp', expiresAt: new Date(Date.now() + 60_000).toISOString() })
      );
      auth.verifyTwoFactor('123456').subscribe();
      const req = http.expectOne('/api/v1/auth/login/mfa');
      expect(req.request.body).toEqual({ mfaToken: 'challenge-token', code: '123456' });
      req.flush(success());
      expect(auth.pendingMfaChallenge()).toBeNull();
      expect(JSON.parse(sessionStorage.getItem('zcc.tokens')!).accessToken).toBe('access');
      finishMe();
    });

    it('ignores an expired stored challenge', () => {
      sessionStorage.setItem(
        'zcc.mfaChallenge',
        JSON.stringify({ mfaToken: 't', mfaMethod: 'totp', expiresAt: new Date(0).toISOString() })
      );
      expect(auth.pendingMfaChallenge()).toBeNull();
    });

    it('routes locked accounts to the safe status page', () => {
      auth.login(credentials).subscribe({ error: () => undefined });
      http.expectOne('/api/v1/auth/login').flush(
        { error: { code: 'ACCOUNT_LOCKED', message: 'This account is locked.', status: 423 } },
        { status: 423, statusText: 'Locked' }
      );
      expect(router.navigate).toHaveBeenCalledWith(['/auth/account-locked'], { queryParams: { reason: 'locked' } });
    });

    it('sends users with unfinished 2FA setup to account security', () => {
      auth.login(credentials).subscribe();
      http.expectOne('/api/v1/auth/login').flush(success({ mfaSetupRequired: true }));
      expect(router.navigateByUrl).toHaveBeenCalledWith('/account/security', { replaceUrl: true });
      finishMe();
    });

    it('never restores an off-site or auth-page redirect after sign-in', () => {
      sessionStorage.setItem('zcc.redirect', '//evil.example');
      auth.login(credentials).subscribe();
      http.expectOne('/api/v1/auth/login').flush(success());
      expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard', { replaceUrl: true });
      finishMe();
    });
  });

  describe('session lifecycle', () => {
    it('shares refreshes across simultaneous callers', () => {
      let results = 0;
      auth.refresh('refresh').subscribe(() => results++);
      auth.refresh('refresh').subscribe(() => results++);
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
      retry.flush(meBody);
      expect(store.isAuthenticated()).toBeTrue();
    });

    it('clears local state and shows session-expired when refresh fails', () => {
      seed();
      store.updateTokens(pair());
      let failed = false;
      TestBed.inject(HttpClient).get('/api/v1/test').subscribe({ error: () => (failed = true) });
      http.expectOne('/api/v1/test').flush({}, { status: 401, statusText: 'Unauthorized' });
      http.expectOne('/api/v1/auth/refresh').flush({}, { status: 401, statusText: 'Unauthorized' });
      expect(failed).toBeTrue();
      expect(sessionStorage.getItem('zcc.tokens')).toBeNull();
      expect(sessionStorage.getItem('zcc.refresh')).toBeNull();
      expect(sessionStorage.getItem('zcc.redirect')).toBe('/dashboard');
      expect(router.navigate).toHaveBeenCalledWith(['/auth/session-expired'], { replaceUrl: true });
    });

    it('revokes the server session on logout and clears every cached identity', () => {
      const policy = TestBed.inject(PolicyStore);
      spyOn(policy, 'clear').and.callThrough();
      seed();
      store.updateTokens(pair());
      auth.logout().subscribe();
      const req = http.expectOne('/api/v1/auth/logout');
      expect(req.request.headers.get('Authorization')).toBe('Bearer access');
      req.flush({ ok: true });
      expect(store.accessToken()).toBeNull();
      expect(sessionStorage.getItem('zcc.refresh')).toBeNull();
      expect(policy.clear).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], { replaceUrl: true });
    });

    it('still signs out locally when the logout request fails', () => {
      store.updateTokens(pair());
      auth.logout().subscribe();
      http.expectOne('/api/v1/auth/logout').flush({}, { status: 500, statusText: 'Server Error' });
      expect(store.accessToken()).toBeNull();
    });
  });
});
