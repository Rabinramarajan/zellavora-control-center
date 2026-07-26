/**
 * Admin Store Service - Centralized state management using Angular Signals
 */
import {
  Injectable,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
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
  ConfigSearchCriteria,
  Group,
  GroupSearchCriteria,
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

  constructor() {
    // Auto-refresh logic can be added here with effect()
  }

  private setLoading(loading: boolean): void {
    this.state.update((s) => ({ ...s, loading }));
  }

  private setError(error: string | null): void {
    this.state.update((s) => ({ ...s, error }));
  }

  private updateLastUpdated(): void {
    this.state.update((s) => ({ ...s, lastUpdated: new Date() }));
  }

  // ==================== USER OPERATIONS ====================

  async loadUsers(criteria: UserSearchCriteria): Promise<User[]> {
    try {
      this.setLoading(true);
      this.setError(null);
      const result = await this.api.searchUsers(criteria);
      const users = (result.searchResult || []) as any[];
      this.state.update((s) => ({
        ...s,
        users: users as User[],
        lastUpdated: new Date(),
      }));
      return users as User[];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load users';
      this.setError(message);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  async createUser(): Promise<User> {
    try {
      this.setLoading(true);
      this.setError(null);
      return await this.api.createNewUser();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create user';
      this.setError(message);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  async openUser(userSerialId: number): Promise<User> {
    try {
      this.setLoading(true);
      this.setError(null);
      return await this.api.openUser(userSerialId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open user';
      this.setError(message);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  async saveUser(user: User): Promise<User> {
    try {
      this.setLoading(true);
      this.setError(null);
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save user';
      this.setError(message);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  // ==================== ROLE OPERATIONS ====================

  async loadRoles(criteria: RoleSearchCriteria): Promise<Role[]> {
    try {
      this.setLoading(true);
      this.setError(null);
      const result = await this.api.searchRoles(criteria);
      const roles = (result.searchResult || []) as any[];
      this.state.update((s) => ({
        ...s,
        roles: roles as Role[],
        lastUpdated: new Date(),
      }));
      return roles as Role[];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load roles';
      this.setError(message);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  async createRole(): Promise<Role> {
    try {
      this.setLoading(true);
      this.setError(null);
      return await this.api.createNewRole();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create role';
      this.setError(message);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  async openRole(roleId: number): Promise<Role> {
    try {
      this.setLoading(true);
      this.setError(null);
      return await this.api.openRole(roleId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open role';
      this.setError(message);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  async saveRole(role: Role): Promise<Role> {
    try {
      this.setLoading(true);
      this.setError(null);
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save role';
      this.setError(message);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  async deleteRole(roleId: number): Promise<void> {
    try {
      this.setLoading(true);
      this.setError(null);
      await this.api.deleteRole(roleId);
      this.state.update((s) => ({
        ...s,
        roles: s.roles.filter((r) => r.roleId !== roleId),
        lastUpdated: new Date(),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete role';
      this.setError(message);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  // ==================== RESOURCE OPERATIONS ====================

  async loadResources(criteria: ResourceSearchCriteria): Promise<Resource[]> {
    try {
      this.setLoading(true);
      this.setError(null);
      const result = await this.api.searchResources(criteria);
      const resources = (result.searchResult || []) as any[];
      this.state.update((s) => ({
        ...s,
        resources: resources as Resource[],
        lastUpdated: new Date(),
      }));
      return resources as Resource[];
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load resources';
      this.setError(message);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  async createResource(): Promise<Resource> {
    try {
      this.setLoading(true);
      this.setError(null);
      return await this.api.createNewResource();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create resource';
      this.setError(message);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  async saveResource(resource: Resource): Promise<Resource> {
    try {
      this.setLoading(true);
      this.setError(null);
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
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save resource';
      this.setError(message);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  async deleteResource(resourceId: number): Promise<void> {
    try {
      this.setLoading(true);
      this.setError(null);
      await this.api.deleteResource(resourceId);
      this.state.update((s) => ({
        ...s,
        resources: s.resources.filter((r) => r.resourceId !== resourceId),
        lastUpdated: new Date(),
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete resource';
      this.setError(message);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  // ==================== BRANCH OPERATIONS ====================

  async loadBranches(criteria: BranchSearchCriteria): Promise<Branch[]> {
    try {
      this.setLoading(true);
      this.setError(null);
      const result = await this.api.searchBranches(criteria);
      const branches = (result.searchResultSet || []) as any[];
      this.state.update((s) => ({
        ...s,
        branches: branches as Branch[],
        lastUpdated: new Date(),
      }));
      return branches as Branch[];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load branches';
      this.setError(message);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  async createBranch(): Promise<Branch> {
    try {
      this.setLoading(true);
      this.setError(null);
      return await this.api.createNewBranch();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create branch';
      this.setError(message);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  async openBranch(branchId: number): Promise<Branch> {
    try {
      this.setLoading(true);
      this.setError(null);
      return await this.api.openBranch(branchId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open branch';
      this.setError(message);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  async saveBranch(branch: Branch): Promise<Branch> {
    try {
      this.setLoading(true);
      this.setError(null);
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save branch';
      this.setError(message);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  async deleteBranch(branchId: number): Promise<void> {
    try {
      this.setLoading(true);
      this.setError(null);
      await this.api.deleteBranch(branchId);
      this.state.update((s) => ({
        ...s,
        branches: s.branches.filter((b) => b.admBranchId !== branchId),
        lastUpdated: new Date(),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete branch';
      this.setError(message);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  // ==================== AUDIT LOG OPERATIONS ====================

  async loadAuditLogs(criteria: AuditLogSearchCriteria): Promise<AuditLog[]> {
    try {
      this.setLoading(true);
      this.setError(null);
      const result = await this.api.searchAuditLogs(criteria);
      const auditLogs = (result.plstAuditLogDetail || []) as any[];
      this.state.update((s) => ({
        ...s,
        auditLogs: auditLogs as AuditLog[],
        lastUpdated: new Date(),
      }));
      return auditLogs as AuditLog[];
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load audit logs';
      this.setError(message);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  async openAuditLog(auditLogId: number): Promise<AuditLog> {
    try {
      this.setLoading(true);
      this.setError(null);
      return await this.api.loadAuditLogDetails(auditLogId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to open audit log';
      this.setError(message);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  // ==================== CONFIG OPERATIONS ====================

  async loadConfigs(criteria: ConfigSearchCriteria): Promise<Config[]> {
    try {
      this.setLoading(true);
      this.setError(null);
      const result = await this.api.searchConfigs(criteria);
      const configs = (result.searchResult || []) as any[];
      this.state.update((s) => ({
        ...s,
        configs: configs as Config[],
        lastUpdated: new Date(),
      }));
      return configs as Config[];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load configs';
      this.setError(message);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  async openConfig(configId: number): Promise<Config> {
    try {
      this.setLoading(true);
      this.setError(null);
      return await this.api.openConfig(configId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open config';
      this.setError(message);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  async saveConfig(config: Config): Promise<Config> {
    try {
      this.setLoading(true);
      this.setError(null);
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save config';
      this.setError(message);
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
