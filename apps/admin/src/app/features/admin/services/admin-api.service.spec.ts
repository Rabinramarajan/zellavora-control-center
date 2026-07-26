import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AdminApiService } from './admin-api.service';
import { UserSearchCriteria } from '../models';

describe('AdminApiService', () => {
  let service: AdminApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AdminApiService]
    });
    service = TestBed.inject(AdminApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('User Operations', () => {
    it('should search users', async () => {
      const mockCriteria: UserSearchCriteria = {
        pageSize: 10,
        pageNumber: 1,
        ascending: true,
      };
      const mockResponse = { searchResult: [] };

      const promise = service.searchUsers(mockCriteria);

      const req = httpMock.expectOne('/api/user/search');
      expect(req.request.method).toBe('POST');
      req.flush(mockResponse);

      const result = await promise;
      expect(result).toEqual(mockResponse);
    });

    it('should create a new user', async () => {
      const mockUser = { userSerialId: 0, userLoginId: '', firstName: '', lastName: '', emailId: '', statusValue: 'Active' };

      const promise = service.createNewUser();

      const req = httpMock.expectOne('/api/user/new');
      expect(req.request.method).toBe('GET');
      req.flush(mockUser);

      const result = await promise;
      expect(result).toEqual(mockUser);
    });

    it('should save a user', async () => {
      const mockUser = { userSerialId: 1, userLoginId: 'test', firstName: 'Test', lastName: 'User', emailId: 'test@example.com', statusValue: 'Active' };

      const promise = service.saveUser(mockUser);

      const req = httpMock.expectOne('/api/user/save');
      expect(req.request.method).toBe('POST');
      req.flush(mockUser);

      const result = await promise;
      expect(result).toEqual(mockUser);
    });
  });

  describe('Role Operations', () => {
    it('should search roles', async () => {
      const mockCriteria = { pageSize: 10, pageNumber: 1, ascending: true };
      const mockResponse = { searchResult: [] };

      const promise = service.searchRoles(mockCriteria);

      const req = httpMock.expectOne('/api/role/search');
      expect(req.request.method).toBe('POST');
      req.flush(mockResponse);

      const result = await promise;
      expect(result).toEqual(mockResponse);
    });

    it('should delete a role', async () => {
      const roleId = 1;
      const mockRole = { roleId, roleName: 'Test', roleActive: true };

      const promise = service.deleteRole(roleId);

      const req = httpMock.expectOne('/api/role/delete');
      expect(req.request.method).toBe('POST');
      req.flush(mockRole);

      const result = await promise;
      expect(result).toEqual(mockRole);
    });
  });
});
