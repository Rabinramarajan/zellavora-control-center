/**
 * Admin Store Service - Centralized state management using Angular Signals
 */
import { Injectable, inject, signal, computed } from '@angular/core';
import { AdminApiService } from './admin-api.service';
import {
  User,
  UserSearchCriteria,
  Role,
  RoleSearchCriteria,
  Resource,
  ResourceSearchCriteria,
  Branch,
  BranchSearchCriteria,
  AuditLog,
  AuditLogSearchCriteria,
  Config,
  Group,
} from '../models/admin.models';

interface AdminState {
  users: User[];
  roles: Role[];
  resources: Resource[];
  branches: Branch[];
  auditLogs: AuditLog[];
  configs: Config[];
  groups: Group[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

const initialState: AdminState = {
  users: [],
  roles: [],
  resources: [],
  branches: [],
  auditLogs: [],
  configs: [],
  groups: [],
  loading: false,
  error: null,
  lastUpdated: null,
};

@Injectable({
  providedIn: 'root',
})
export class AdminStoreService {
  private api = inject(AdminApiService);

  // State signals
  private readonly state = signal<AdminState>(initialState);

  // Selectors
  readonly users = computed(() => this.state().users);
  readonly roles = computed(() => this.state().roles);
  readonly resources = computed(() => this.state().resources);
  readonly branches = computed(() => this.state().branches);
  readonly auditLogs = computed(() => this.state().auditLogs);
  readonly configs = computed(() => this.state().configs);
  readonly groups = computed(() => this.state().groups);
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly lastUpdated = computed(() => this.state().lastUpdated);

  private setLoading(loading: boolean): void {
    this.state.update((s) => ({ ...s, loading }));
  }

  private setError(error: string | null): void {
    this.state.update((s) => ({ ...s, error }));
  }

  // ==================== USER OPERATIONS ====================

  async loadUsers(criteria: UserSearchCriteria): Promise<User[]> {
    return this.runOperation(async () => {
      const result = await this.api.searchUsers(criteria);
      const users = (result.searchResult || []) as any[];
      this.state.update((s) => ({
        ...s,
        users: users as User[],
        lastUpdated: new Date(),
      }));
      return users as User[];
    }, 'Failed to load users');
  }

  async createUser(): Promise<User> {
    return this.runOperation(async () => {
      return await this.api.createNewUser();
    }, 'Failed to create user');
  }

  async openUser(userSerialId: number): Promise<User> {
    return this.runOperation(async () => {
      return await this.api.openUser(userSerialId);
    }, 'Failed to open user');
  }

  async saveUser(user: User): Promise<User> {
    return this.runOperation(async () => {
      const saved = await this.api.saveUser(user);
      this.state.update((s) => {
        const index = s.users.findIndex((u) => u.userSerialId === user.userSerialId);
        const users = [...s.users];
        if (index >= 0) {
          users[index] = saved;
        } else {
          users.push(saved);
        }
        return { ...s, users, lastUpdated: new Date() };
      });
      return saved;
    }, 'Failed to save user');
  }

  // ==================== ROLE OPERATIONS ====================

  async loadRoles(criteria: RoleSearchCriteria): Promise<Role[]> {
    return this.runOperation(async () => {
      const result = await this.api.searchRoles(criteria);
      const roles = (result.searchResult || []) as any[];
      this.state.update((s) => ({
        ...s,
        roles: roles as Role[],
        lastUpdated: new Date(),
      }));
      return roles as Role[];
    }, 'Failed to load roles');
  }

  async createRole(): Promise<Role> {
    return this.runOperation(async () => {
      return await this.api.createNewRole();
    }, 'Failed to create role');
  }

  async openRole(roleId: number): Promise<Role> {
    return this.runOperation(async () => {
      return await this.api.openRole(roleId);
    }, 'Failed to open role');
  }

  async saveRole(role: Role): Promise<Role> {
    return this.runOperation(async () => {
      const saved = await this.api.saveRole(role);
      this.state.update((s) => {
        const index = s.roles.findIndex((r) => r.roleId === role.roleId);
        const roles = [...s.roles];
        if (index >= 0) {
          roles[index] = saved;
        } else {
          roles.push(saved);
        }
        return { ...s, roles, lastUpdated: new Date() };
      });
      return saved;
    }, 'Failed to save role');
  }

  async deleteRole(roleId: number): Promise<void> {
    return this.runOperation(async () => {
      await this.api.deleteRole(roleId);
      this.state.update((s) => ({
        ...s,
        roles: s.roles.filter((r) => r.roleId !== roleId),
        lastUpdated: new Date(),
      }));
    }, 'Failed to delete role');
  }

  // ==================== RESOURCE OPERATIONS ====================

  async loadResources(criteria: ResourceSearchCriteria): Promise<Resource[]> {
    return this.runOperation(async () => {
      const result = await this.api.searchResources(criteria);
      const resources = (result.searchResult || []) as any[];
      this.state.update((s) => ({
        ...s,
        resources: resources as Resource[],
        lastUpdated: new Date(),
      }));
      return resources as Resource[];
    }, 'Failed to load resources');
  }

  async createResource(): Promise<Resource> {
    return this.runOperation(async () => {
      return await this.api.createNewResource();
    }, 'Failed to create resource');
  }

  async saveResource(resource: Resource): Promise<Resource> {
    return this.runOperation(async () => {
      const saved = await this.api.saveResource(resource);
      this.state.update((s) => {
        const index = s.resources.findIndex((r) => r.resourceId === resource.resourceId);
        const resources = [...s.resources];
        if (index >= 0) {
          resources[index] = saved;
        } else {
          resources.push(saved);
        }
        return { ...s, resources, lastUpdated: new Date() };
      });
      return saved;
    }, 'Failed to save resource');
  }

  async deleteResource(resourceId: number): Promise<void> {
    return this.runOperation(async () => {
      await this.api.deleteResource(resourceId);
      this.state.update((s) => ({
        ...s,
        resources: s.resources.filter((r) => r.resourceId !== resourceId),
        lastUpdated: new Date(),
      }));
    }, 'Failed to delete resource');
  }

  // ==================== BRANCH OPERATIONS ====================

  async loadBranches(criteria: BranchSearchCriteria): Promise<Branch[]> {
    return this.runOperation(async () => {
      const result = await this.api.searchBranches(criteria);
      const branches = (result.searchResultSet || []) as any[];
      this.state.update((s) => ({
        ...s,
        branches: branches as Branch[],
        lastUpdated: new Date(),
      }));
      return branches as Branch[];
    }, 'Failed to load branches');
  }

  async openBranch(branchId: number): Promise<Branch> {
    return this.runOperation(async () => {
      return await this.api.openBranch(branchId);
    }, 'Failed to open branch');
  }

  async saveBranch(branch: Branch): Promise<Branch> {
    return this.runOperation(async () => {
      const saved = await this.api.saveBranch(branch);
      this.state.update((s) => {
        const index = s.branches.findIndex((b) => b.admBranchId === branch.admBranchId);
        const branches = [...s.branches];
        if (index >= 0) {
          branches[index] = saved;
        } else {
          branches.push(saved);
        }
        return { ...s, branches, lastUpdated: new Date() };
      });
      return saved;
    }, 'Failed to save branch');
  }

  async deleteBranch(branchId: number): Promise<void> {
    return this.runOperation(async () => {
      await this.api.deleteBranch(branchId);
      this.state.update((s) => ({
        ...s,
        branches: s.branches.filter((b) => b.admBranchId !== branchId),
        lastUpdated: new Date(),
      }));
    }, 'Failed to delete branch');
  }

  // ==================== AUDIT LOG OPERATIONS ====================

  async loadAuditLogs(criteria: AuditLogSearchCriteria): Promise<AuditLog[]> {
    return this.runOperation(async () => {
      const result = await this.api.searchAuditLogs(criteria);
      const auditLogs = (result.plstAuditLogDetail || []) as any[];
      this.state.update((s) => ({
        ...s,
        auditLogs: auditLogs as AuditLog[],
        lastUpdated: new Date(),
      }));
      return auditLogs as AuditLog[];
    }, 'Failed to load audit logs');
  }

  // ==================== CONFIG OPERATIONS ====================

  async openConfig(configId: number): Promise<Config> {
    return this.runOperation(async () => {
      return await this.api.openConfig(configId);
    }, 'Failed to open config');
  }

  async saveConfig(config: Config): Promise<Config> {
    return this.runOperation(async () => {
      const saved = await this.api.saveConfig(config);
      this.state.update((s) => {
        const index = s.configs.findIndex((c) => c.configId === config.configId);
        const configs = [...s.configs];
        if (index >= 0) {
          configs[index] = saved;
        } else {
          configs.push(saved);
        }
        return { ...s, configs, lastUpdated: new Date() };
      });
      return saved;
    }, 'Failed to save config');
  }

  private async runOperation<T>(operation: () => Promise<T>, fallbackMessage: string): Promise<T> {
    this.setLoading(true);
    this.setError(null);
    try {
      return await operation();
    } catch (error) {
      this.setError(error instanceof Error ? error.message : fallbackMessage);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  // ==================== UTILITY ====================

  clearError(): void {
    this.setError(null);
  }

  reset(): void {
    this.state.set(initialState);
  }
}
