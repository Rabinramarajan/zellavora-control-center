import { User, Role, Resource, Branch, Config, Group } from '../models';

export interface UserFilterOptions {
  searchTerm?: string;
  statusFilter?: string;
}

export interface RoleFilterOptions {
  searchTerm?: string;
  activeOnly?: boolean;
}

export interface ResourceFilterOptions {
  searchTerm?: string;
  typeFilter?: string;
}

export class SearchFilterHelper {
  static filterUsers(users: User[], options: UserFilterOptions = {}): User[] {
    let filtered = [...users];

    if (options.searchTerm) {
      const term = options.searchTerm.toLowerCase();
      filtered = filtered.filter(user =>
        user.userLoginId.toLowerCase().includes(term) ||
        user.firstName.toLowerCase().includes(term) ||
        user.lastName.toLowerCase().includes(term) ||
        user.emailId.toLowerCase().includes(term) ||
        (user.employeeCode?.toLowerCase().includes(term) || false)
      );
    }

    if (options.statusFilter) {
      filtered = filtered.filter(user => user.statusValue === options.statusFilter);
    }

    return filtered;
  }

  static filterRoles(roles: Role[], options: RoleFilterOptions = {}): Role[] {
    let filtered = [...roles];

    if (options.searchTerm) {
      const term = options.searchTerm.toLowerCase();
      filtered = filtered.filter(role =>
        role.roleName.toLowerCase().includes(term) ||
        (role.moduleDescription?.toLowerCase().includes(term) || false)
      );
    }

    if (options.activeOnly !== undefined) {
      filtered = filtered.filter(role => role.statusValue === (options.activeOnly ? 'Active' : 'Inactive'));
    }

    return filtered;
  }

  static filterResources(resources: Resource[], options: ResourceFilterOptions = {}): Resource[] {
    let filtered = [...resources];

    if (options.searchTerm) {
      const term = options.searchTerm.toLowerCase();
      filtered = filtered.filter(resource =>
        resource.resourceName.toLowerCase().includes(term) ||
        (resource.resourceDescription?.toLowerCase().includes(term) || false) ||
        (resource.resourceTypeValue?.toLowerCase().includes(term) || false)
      );
    }

    if (options.typeFilter) {
      filtered = filtered.filter(resource => resource.resourceTypeValue === options.typeFilter);
    }

    return filtered;
  }

  static filterBranches(branches: Branch[], searchTerm?: string): Branch[] {
    if (!searchTerm) return branches;

    const term = searchTerm.toLowerCase();
    return branches.filter(branch =>
      branch.branchCode.toLowerCase().includes(term) ||
      branch.branchName.toLowerCase().includes(term) ||
      (branch.statusValue?.toLowerCase().includes(term) || false)
    );
  }

  static filterConfigs(configs: Config[], searchTerm?: string): Config[] {
    if (!searchTerm) return configs;

    const term = searchTerm.toLowerCase();
    return configs.filter(config =>
      config.configValue?.toLowerCase().includes(term) ||
      (config.configDescription?.toLowerCase().includes(term) || false)
    );
  }

  static filterGroups(groups: Group[], searchTerm?: string): Group[] {
    if (!searchTerm) return groups;

    const term = searchTerm.toLowerCase();
    return groups.filter(group =>
      group.groupName.toLowerCase().includes(term) ||
      (group.statusValue?.toLowerCase().includes(term) || false)
    );
  }
}
