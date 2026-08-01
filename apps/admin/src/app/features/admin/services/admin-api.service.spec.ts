import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AdminApiService } from './admin-api.service';
import { User, Role, UserSearchCriteria, RoleSearchCriteria } from '../models';

describe('AdminApiService', () => {
  let service: AdminApiService;
  let httpMock: HttpTestingController;

  const makeUser = (userSerialId: number, userLoginId: string): User => ({
    userSerialId,
    userLoginId,
    firstName: 'Test',
    lastName: 'User',
    emailId: `${userLoginId}@example.com`,
    contactNumber: '1234567890',
    genderId: 1,
    genderValue: 'Male',
    beginDate: '2024-01-01',
    endDate: '2099-12-31',
    statusId: 1,
    statusValue: 'Active',
    designationId: 1,
    designationValue: 'Engineer',
    locationId: 1,
    locationValue: 'HQ',
    branchId: 1,
    branchValue: 'Main',
    employeeCode: 'E001',
    departmentId: 1,
    departmentValue: 'Engineering',
    teamId: 1,
    teamValue: 'Platform',
  });

  const makeRole = (roleId: number, roleName: string): Role => ({
    roleId,
    roleName,
    statusId: 1,
    statusValue: 'Active',
    beginDate: '2024-01-01',
    endDate: '2099-12-31',
    moduleId: 1,
    moduleValue: 'Platform',
    ilstRoleResource: [],
  });

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
      const mockResponse = { searchResult: [], totalCount: 0, pageSize: 10, pageNumber: 1 };

      const promise = service.searchUsers(mockCriteria);

      const req = httpMock.expectOne('/api/v1/admin/user/search');
      expect(req.request.method).toBe('POST');
      req.flush(mockResponse);

      const result = await promise;
      expect(result).toEqual(mockResponse);
    });

    it('should create a new user', async () => {
      const mockUser = makeUser(0, '');

      const promise = service.createNewUser();

      const req = httpMock.expectOne('/api/v1/admin/user/new');
      expect(req.request.method).toBe('GET');
      req.flush(mockUser);

      const result = await promise;
      expect(result).toEqual(mockUser);
    });

    it('should save a user', async () => {
      const mockUser = makeUser(1, 'test');

      const promise = service.saveUser(mockUser);

      const req = httpMock.expectOne('/api/v1/admin/user/save');
      expect(req.request.method).toBe('POST');
      req.flush(mockUser);

      const result = await promise;
      expect(result).toEqual(mockUser);
    });
  });

  describe('Role Operations', () => {
    it('should search roles', async () => {
      const mockCriteria: RoleSearchCriteria = {
        pageSize: 10,
        pageNumber: 1,
        ascending: true,
      };
      const mockResponse = { searchResult: [], totalCount: 0, pageSize: 10, pageNumber: 1 };

      const promise = service.searchRoles(mockCriteria);

      const req = httpMock.expectOne('/api/v1/admin/role/search');
      expect(req.request.method).toBe('POST');
      req.flush(mockResponse);

      const result = await promise;
      expect(result).toEqual(mockResponse);
    });

    it('should delete a role', async () => {
      const roleId = 1;
      const mockRole = makeRole(roleId, 'Test');

      const promise = service.deleteRole(roleId);

      const req = httpMock.expectOne('/api/v1/admin/role/delete');
      expect(req.request.method).toBe('POST');
      req.flush(mockRole);

      const result = await promise;
      expect(result).toEqual(mockRole);
    });
  });
});
