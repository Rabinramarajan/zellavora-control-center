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
        (role.roleDescription?.toLowerCase().includes(term) || false)
      );
    }

    if (options.activeOnly !== undefined) {
      filtered = filtered.filter(role => role.roleActive === options.activeOnly);
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
        (resource.resourceType?.toLowerCase().includes(term) || false)
      );
    }

    if (options.typeFilter) {
      filtered = filtered.filter(resource => resource.resourceType === options.typeFilter);
    }

    return filtered;
  }

  static filterBranches(branches: Branch[], searchTerm?: string): Branch[] {
    if (!searchTerm) return branches;

    const term = searchTerm.toLowerCase();
    return branches.filter(branch =>
      branch.branchCode.toLowerCase().includes(term) ||
      branch.branchName.toLowerCase().includes(term) ||
      (branch.cityName?.toLowerCase().includes(term) || false) ||
      (branch.address?.toLowerCase().includes(term) || false)
    );
  }

  static filterConfigs(configs: Config[], searchTerm?: string): Config[] {
    if (!searchTerm) return configs;

    const term = searchTerm.toLowerCase();
    return configs.filter(config =>
      config.configCode?.toLowerCase().includes(term) ||
      (config.configValue?.toLowerCase().includes(term) || false) ||
      (config.description?.toLowerCase().includes(term) || false)
    );
  }

  static filterGroups(groups: Group[], searchTerm?: string): Group[] {
    if (!searchTerm) return groups;

    const term = searchTerm.toLowerCase();
    return groups.filter(group =>
      group.groupCode?.toLowerCase().includes(term) ||
      (group.groupDescription?.toLowerCase().includes(term) || false)
    );
  }
}
