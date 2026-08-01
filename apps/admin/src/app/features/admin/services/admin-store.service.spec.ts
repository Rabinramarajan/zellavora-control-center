import { TestBed } from '@angular/core/testing';
import { AdminStoreService } from './admin-store.service';
import { AdminApiService } from './admin-api.service';
import { User, Role } from '../models';

describe('AdminStoreService', () => {
  let service: AdminStoreService;
  let apiService: jasmine.SpyObj<AdminApiService>;

  const mockUser: User = {
    userSerialId: 1,
    userLoginId: 'test',
    firstName: 'Test',
    lastName: 'User',
    emailId: 'test@example.com',
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
  };

  const mockRole: Role = {
    roleId: 1,
    roleName: 'Test Role',
    statusId: 1,
    statusValue: 'Active',
    beginDate: '2024-01-01',
    endDate: '2099-12-31',
    moduleId: 1,
    moduleValue: 'Platform',
    ilstRoleResource: [],
  };

  beforeEach(() => {
    const apiServiceSpy = jasmine.createSpyObj('AdminApiService', [
      'searchUsers',
      'createNewUser',
      'openUser',
      'saveUser',
      'searchRoles',
      'createNewRole',
      'openRole',
      'saveRole',
      'deleteRole',
      'searchResources',
      'createNewResource',
      'saveResource',
      'deleteResource',
      'searchBranches',
      'createNewBranch',
      'openBranch',
      'saveBranch',
      'deleteBranch',
      'searchAuditLogs',
      'loadAuditLogDetails',
      'searchConfigs',
      'openConfig',
      'saveConfig',
    ]);

    TestBed.configureTestingModule({
      providers: [AdminStoreService, { provide: AdminApiService, useValue: apiServiceSpy }]
    });

    service = TestBed.inject(AdminStoreService);
    apiService = TestBed.inject(AdminApiService) as jasmine.SpyObj<AdminApiService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('User Operations', () => {
    it('should load users', async () => {
      const mockResponse = { searchResult: [mockUser], totalCount: 1, pageSize: 10, pageNumber: 1 };
      apiService.searchUsers.and.returnValue(Promise.resolve(mockResponse as never));

      const criteria = { pageSize: 10, pageNumber: 1, ascending: true };
      const result = await service.loadUsers(criteria);

      expect(result).toEqual([mockUser]);
      expect(service.users()).toEqual([mockUser]);
      expect(service.loading()).toBe(false);
    });

    it('should save a user', async () => {
      apiService.saveUser.and.returnValue(Promise.resolve(mockUser));

      const result = await service.saveUser(mockUser);

      expect(result).toEqual(mockUser);
      expect(service.users()).toContain(mockUser);
    });

    it('should handle errors', async () => {
      const error = new Error('Test error');
      apiService.searchUsers.and.returnValue(Promise.reject(error));

      try {
        await service.loadUsers({ pageSize: 10, pageNumber: 1, ascending: true });
      } catch (e) {
        expect(service.error()).toBeTruthy();
      }
    });
  });

  describe('Role Operations', () => {
    it('should load roles', async () => {
      const mockResponse = { searchResult: [mockRole], totalCount: 1, pageSize: 10, pageNumber: 1 };
      apiService.searchRoles.and.returnValue(Promise.resolve(mockResponse as never));

      const criteria = { pageSize: 10, pageNumber: 1, ascending: true };
      const result = await service.loadRoles(criteria);

      expect(result).toEqual([mockRole]);
      expect(service.roles()).toEqual([mockRole]);
    });

    it('should delete a role', async () => {
      service['state'].update(s => ({ ...s, roles: [mockRole] }));
      apiService.deleteRole.and.returnValue(Promise.resolve() as never);

      await service.deleteRole(mockRole.roleId);

      expect(service.roles()).not.toContain(mockRole);
    });
  });

  describe('State Management', () => {
    it('should clear errors', () => {
      service['setError']('Test error');
      expect(service.error()).toBe('Test error');

      service.clearError();
      expect(service.error()).toBeNull();
    });

    it('should reset state', () => {
      service['state'].update(s => ({ ...s, users: [mockUser], roles: [mockRole] }));

      service.reset();

      expect(service.users()).toEqual([]);
      expect(service.roles()).toEqual([]);
      expect(service.error()).toBeNull();
    });
  });
});
