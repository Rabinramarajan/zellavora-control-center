import { SearchFilterHelper } from './search-filter.helper';
import { User, Role, Branch } from '../models';

describe('SearchFilterHelper', () => {
  const mockUsers: User[] = [
    {
      userSerialId: 1,
      userLoginId: 'john.doe',
      firstName: 'John',
      lastName: 'Doe',
      emailId: 'john@example.com',
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
    },
    {
      userSerialId: 2,
      userLoginId: 'jane.smith',
      firstName: 'Jane',
      lastName: 'Smith',
      emailId: 'jane@example.com',
      contactNumber: '0987654321',
      genderId: 2,
      genderValue: 'Female',
      beginDate: '2024-01-01',
      endDate: '2099-12-31',
      statusId: 2,
      statusValue: 'Inactive',
      designationId: 1,
      designationValue: 'Engineer',
      locationId: 1,
      locationValue: 'HQ',
      branchId: 1,
      branchValue: 'Main',
      employeeCode: 'E002',
      departmentId: 1,
      departmentValue: 'Engineering',
      teamId: 1,
      teamValue: 'Platform',
    },
  ];

  const mockRoles: Role[] = [
    {
      roleId: 1,
      roleName: 'Admin',
      statusId: 1,
      statusValue: 'Active',
      beginDate: '2024-01-01',
      endDate: '2099-12-31',
      moduleId: 1,
      moduleValue: 'Platform',
      ilstRoleResource: [],
    },
    {
      roleId: 2,
      roleName: 'User',
      statusId: 2,
      statusValue: 'Inactive',
      beginDate: '2024-01-01',
      endDate: '2099-12-31',
      moduleId: 1,
      moduleValue: 'Platform',
      ilstRoleResource: [],
    },
  ];

  describe('filterUsers', () => {
    it('should filter users by search term', () => {
      const result = SearchFilterHelper.filterUsers(mockUsers, { searchTerm: 'john' });

      expect(result.length).toBe(1);
      expect(result[0].firstName).toBe('John');
    });

    it('should filter users by status', () => {
      const result = SearchFilterHelper.filterUsers(mockUsers, { statusFilter: 'Active' });

      expect(result.length).toBe(1);
      expect(result[0].statusValue).toBe('Active');
    });

    it('should apply multiple filters', () => {
      const result = SearchFilterHelper.filterUsers(mockUsers, {
        searchTerm: 'john',
        statusFilter: 'Active'
      });

      expect(result.length).toBe(1);
      expect(result[0].firstName).toBe('John');
      expect(result[0].statusValue).toBe('Active');
    });

    it('should return all users when no filters provided', () => {
      const result = SearchFilterHelper.filterUsers(mockUsers);

      expect(result.length).toBe(2);
    });

    it('should be case insensitive', () => {
      const result = SearchFilterHelper.filterUsers(mockUsers, { searchTerm: 'JOHN' });

      expect(result.length).toBe(1);
    });
  });

  describe('filterRoles', () => {
    it('should filter roles by search term', () => {
      const result = SearchFilterHelper.filterRoles(mockRoles, { searchTerm: 'admin' });

      expect(result.length).toBe(1);
      expect(result[0].roleName).toBe('Admin');
    });

    it('should filter roles by active status', () => {
      const result = SearchFilterHelper.filterRoles(mockRoles, { activeOnly: true });

      expect(result.length).toBe(1);
      expect(result[0].statusValue).toBe('Active');
    });
  });

  describe('filterBranches', () => {
    const makeBranch = (admBranchId: number, branchCode: string, branchName: string, statusValue: string): Branch => ({
      admBranchId,
      actCompanyId: 1,
      admLocationId: 1,
      admRegionId: 1,
      branchName,
      effectiveDate: '2024-01-01',
      statusId: statusValue === 'Active' ? 1 : 2,
      statusValue,
      branchCode,
    });

    it('should filter branches by search term', () => {
      const mockBranches = [
        makeBranch(1, 'BR001', 'Main Branch', 'Active'),
        makeBranch(2, 'BR002', 'Sub Branch', 'Inactive'),
      ];

      const result = SearchFilterHelper.filterBranches(mockBranches, 'main');

      expect(result.length).toBe(1);
      expect(result[0].branchName).toBe('Main Branch');
    });

    it('should return all branches when no search term', () => {
      const mockBranches = [
        makeBranch(1, 'BR001', 'Main Branch', 'Active'),
        makeBranch(2, 'BR002', 'Sub Branch', 'Inactive'),
      ];

      const result = SearchFilterHelper.filterBranches(mockBranches);

      expect(result.length).toBe(2);
    });
  });
});
