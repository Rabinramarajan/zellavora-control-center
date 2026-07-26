import { SearchFilterHelper } from './search-filter.helper';
import { User, Role, Resource } from '../models';

describe('SearchFilterHelper', () => {
  const mockUsers: User[] = [
    {
      userSerialId: 1,
      userLoginId: 'john.doe',
      firstName: 'John',
      lastName: 'Doe',
      emailId: 'john@example.com',
      statusValue: 'Active',
      statusDescription: 'Active',
    },
    {
      userSerialId: 2,
      userLoginId: 'jane.smith',
      firstName: 'Jane',
      lastName: 'Smith',
      emailId: 'jane@example.com',
      statusValue: 'Inactive',
      statusDescription: 'Inactive',
    },
  ];

  const mockRoles: Role[] = [
    {
      roleId: 1,
      roleName: 'Admin',
      roleDescription: 'Administrator role',
      roleActive: true,
    },
    {
      roleId: 2,
      roleName: 'User',
      roleDescription: 'Regular user role',
      roleActive: false,
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
      expect(result[0].roleActive).toBe(true);
    });
  });

  describe('filterBranches', () => {
    it('should filter branches by search term', () => {
      const mockBranches = [
        { admBranchId: 1, branchCode: 'BR001', branchName: 'Main Branch', isActive: true },
        { admBranchId: 2, branchCode: 'BR002', branchName: 'Sub Branch', isActive: false },
      ];

      const result = SearchFilterHelper.filterBranches(mockBranches, 'main');

      expect(result.length).toBe(1);
      expect(result[0].branchName).toBe('Main Branch');
    });

    it('should return all branches when no search term', () => {
      const mockBranches = [
        { admBranchId: 1, branchCode: 'BR001', branchName: 'Main Branch', isActive: true },
        { admBranchId: 2, branchCode: 'BR002', branchName: 'Sub Branch', isActive: false },
      ];

      const result = SearchFilterHelper.filterBranches(mockBranches);

      expect(result.length).toBe(2);
    });
  });
});
