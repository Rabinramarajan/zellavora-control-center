import { TestBed } from '@angular/core/testing';
import { AuthRepository } from './auth.repository';
import { AuthApiService } from '@core/api/auth.api';
import { AuthStore } from '@core/auth/auth.store';
import { of } from 'rxjs';

describe('AuthRepository', () => {
  let repository: AuthRepository;
  let apiMock: jasmine.SpyObj<AuthApiService>;
  let store: AuthStore;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('AuthApiService', ['validateClientCode', 'login', 'loadMe', 'loadAvailableTenants']);

    TestBed.configureTestingModule({
      providers: [
        AuthRepository,
        { provide: AuthApiService, useValue: spy },
        AuthStore
      ]
    });

    repository = TestBed.inject(AuthRepository);
    apiMock = TestBed.inject(AuthApiService) as jasmine.SpyObj<AuthApiService>;
    store = TestBed.inject(AuthStore);
  });

  it('should be created', () => {
    expect(repository).toBeTruthy();
  });

  it('should call api.validateClientCode and return the response', () => {
    const mockResponse = { valid: true, tenant: { id: '1', name: 'Acme', clientCode: 'acme', logoUrl: null, enforce2fa: false, allowedDomains: null } };
    apiMock.validateClientCode.and.returnValue(of(mockResponse));

    repository.validateClient('acme').subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    expect(apiMock.validateClientCode).toHaveBeenCalledWith('acme');
  });
});
